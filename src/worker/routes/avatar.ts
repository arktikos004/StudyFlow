import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AVATAR_MAX_BYTES } from '../../shared/schemas';
import { users } from '../db/schema';
import type { DB } from '../lib/db';
import { sniffImageType } from '../lib/image';
import { uploadLimit } from '../lib/upload';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { publicUser } from './auth';

const TOO_LARGE = `照片太大（上限 ${AVATAR_MAX_BYTES / (1024 * 1024)}MB）`;
/** multipart 的分隔線與欄位標頭只有幾百 bytes；整個 body 超過「上限 + 這個值」就不再讀取（uploadLimit） */
const MULTIPART_OVERHEAD = 16 * 1024;

function avatarNotFound(): never {
	throw new HTTPException(404, { message: '找不到頭像' });
}

/** 刪掉換下來或移除的頭像檔；失敗只會留下沒人引用的檔案，不影響回應 */
async function deleteQuietly(bucket: R2Bucket, key: string | null) {
	if (!key) return;
	try {
		await bucket.delete(key);
	} catch (e) {
		console.error('刪除頭像檔失敗', key, e);
	}
}

/**
 * 把頭像換成新的 R2 key（null = 移除），回傳被換掉的舊 key 與更新後的使用者。
 * 讀舊值與更新放在同一個 batch（D1 的 batch 是一個交易、依序執行）：同時送出兩次上傳時，
 * 每次拿到的都是真正被自己換掉的那一個，不會漏刪檔案。
 */
async function swapAvatar(db: DB, userId: string, key: string | null) {
	const [[old], [user]] = await db.batch([
		db.select({ key: users.avatarKey }).from(users).where(eq(users.id, userId)),
		db
			.update(users)
			.set({
				avatarKey: key,
				// 嚴格遞增：同一毫秒內連續更換也會得到不同的網址（?v=），瀏覽器不會拿快取裡的舊圖
				avatarUpdatedAt: key ? sql`max(${Date.now()}, coalesce(${users.avatarUpdatedAt}, 0) + 1)` : null,
			})
			.where(eq(users.id, userId))
			.returning(),
	]);
	return { previous: old?.key ?? null, user };
}

/**
 * 頭像（PRO-1）：和筆記照片一樣存在不公開的 R2 bucket，由 Worker 確認身分後轉送，只有本人讀得到。
 * 一律對應到目前登入的使用者，網址裡沒有任何 id，所以不會讀到或改到別人的頭像。
 */
export const avatarRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/', async (c) => {
		// c.var.user 是驗證 session 時讀出的整列資料，不必再查一次 D1
		const key = c.var.user.avatarKey;
		const obj = key ? await c.env.BUCKET.get(key) : null;
		if (!obj) avatarNotFound();
		return new Response(obj.body, {
			headers: {
				'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
				'Content-Length': String(obj.size),
				// 前端的網址帶 ?v=<avatarUpdatedAt>，更換頭像就會換網址：同一個網址的內容不會變
				'Cache-Control': 'private, max-age=31536000, immutable',
				'Content-Disposition': 'inline',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	})
	.put('/', uploadLimit(AVATAR_MAX_BYTES + MULTIPART_OVERHEAD, TOO_LARGE), async (c) => {
		const user = c.var.user;
		// 不是 multipart（例如送了 JSON 或沒有內容）時 formData() 會丟錯：一樣當作沒有選照片
		const form = await c.req.formData().catch(() => null);
		const file = form?.get('file');
		if (!(file instanceof File) || file.size === 0) throw new HTTPException(400, { message: '請選擇照片' });
		if (file.size > AVATAR_MAX_BYTES) throw new HTTPException(413, { message: TOO_LARGE });

		const bytes = new Uint8Array(await file.arrayBuffer());
		const contentType = sniffImageType(bytes);
		if (!contentType) throw new HTTPException(415, { message: '只支援 JPEG、PNG、WebP 圖片' });

		// 每次都用新的 key：先存新檔、資料庫改指向新檔，最後才刪舊檔，任何一步失敗都不會留下壞掉的頭像
		const key = `users/${user.id}/avatar-${crypto.randomUUID()}`;
		await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType } });
		const swapped = await swapAvatar(c.var.db, user.id, key).catch(async (e) => {
			// 資料庫沒有更新成功：剛存的新檔沒人引用，刪掉
			await deleteQuietly(c.env.BUCKET, key);
			throw e;
		});
		await deleteQuietly(c.env.BUCKET, swapped.previous);
		return c.json({ user: publicUser(swapped.user) });
	})
	.delete('/', async (c) => {
		// 先讓資料庫不再指向舊檔，再刪 R2；本來就沒有頭像也回 200
		const swapped = await swapAvatar(c.var.db, c.var.user.id, null);
		await deleteQuietly(c.env.BUCKET, swapped.previous);
		return c.json({ user: publicUser(swapped.user) });
	});
