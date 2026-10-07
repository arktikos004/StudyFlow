import { eq, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
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
 * 換上新的頭像檔：先存新檔、資料庫改指向新檔，最後才刪舊檔，任何一步失敗都不會留下壞掉的頭像。
 * 每次都用新的 key，瀏覽器快取裡的舊圖不會被當成新的。
 */
async function replaceAvatar(bucket: R2Bucket, db: DB, userId: string, bytes: Uint8Array, contentType: string) {
	const key = `users/${userId}/avatar-${crypto.randomUUID()}`;
	await bucket.put(key, bytes, { httpMetadata: { contentType } });
	const swapped = await swapAvatar(db, userId, key).catch(async (e) => {
		// 資料庫沒有更新成功：剛存的新檔沒人引用，刪掉
		await deleteQuietly(bucket, key);
		throw e;
	});
	await deleteQuietly(bucket, swapped.previous);
	return swapped.user;
}

/** 移除頭像：先讓資料庫不再指向舊檔，再刪 R2；本來就沒有頭像也算成功 */
async function removeAvatar(bucket: R2Bucket, db: DB, userId: string) {
	const swapped = await swapAvatar(db, userId, null);
	await deleteQuietly(bucket, swapped.previous);
	return swapped.user;
}

/**
 * 等工作做完再回應，而且用戶端中途斷線（例如按了取消）也會做完：斷線時 Worker 的這次執行會被取消，
 * 交給 waitUntil 才能再延長最多 30 秒，不會只做一半（存了新檔卻沒改指向，或改了指向卻沒刪舊檔）。
 */
function finishEvenIfDisconnected<T>(c: Context<AppEnv>, work: Promise<T>): Promise<T> {
	c.executionCtx.waitUntil(work.catch(() => {}));
	return work;
}

/**
 * 頭像（PRO-1）：和筆記照片一樣存在不公開的 R2 bucket，由 Worker 確認身分後轉送，只有本人讀得到。
 * 一律對應到目前登入的使用者，網址裡沒有任何 id，所以不會讀到或改到別人的頭像。
 */
export const avatarRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/', async (c) => {
		// c.var.user 是驗證 session 時讀出的整列資料，不必再查一次 D1
		const user = c.var.user;
		const obj = user.avatarKey ? await c.env.BUCKET.get(user.avatarKey) : null;
		if (!obj) avatarNotFound();
		// 只有 v 等於目前的 avatarUpdatedAt（avatarUrl() 組出的網址）才讓瀏覽器快取一年；沒帶 v 或用舊的 v
		// （例如過期的分頁）時每次都要重新驗證，否則換了頭像之後，同一個網址會一直拿到快取裡的舊圖
		const current = c.req.query('v') === String(user.avatarUpdatedAt);
		return new Response(obj.body, {
			headers: {
				'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
				'Content-Length': String(obj.size),
				'Cache-Control': current ? 'private, max-age=31536000, immutable' : 'private, no-cache',
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

		const updated = await finishEvenIfDisconnected(c, replaceAvatar(c.env.BUCKET, c.var.db, user.id, bytes, contentType));
		return c.json({ user: publicUser(updated) });
	})
	.delete('/', async (c) => {
		const updated = await finishEvenIfDisconnected(c, removeAvatar(c.env.BUCKET, c.var.db, c.var.user.id));
		return c.json({ user: publicUser(updated) });
	});
