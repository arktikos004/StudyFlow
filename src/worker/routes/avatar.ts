import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AVATAR_MAX_BYTES } from '../../shared/schemas';
import { removeAvatar, replaceAvatar } from '../lib/avatar';
import { imageResponse } from '../lib/image';
import { publicUser } from '../lib/users';
import { requireAuth } from '../middleware/auth';
import { imageUploadLimit, readImageUpload } from '../middleware/upload';
import type { AppEnv } from '../types';

/** 目前這一版的頭像（網址帶著最新的 ?v=）內容不會再變，讓瀏覽器快取一年 */
const CACHE_CURRENT_VERSION = 'private, max-age=31536000, immutable';
/** 沒帶 v 或用了舊的 v：每次都要重新驗證，否則換了頭像之後，同一個網址會一直拿到快取裡的舊圖 */
const CACHE_REVALIDATE = 'private, no-cache';

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
		const object = user.avatarKey ? await c.env.BUCKET.get(user.avatarKey) : null;
		if (!object) throw new HTTPException(404, { message: '找不到頭像' });
		const isCurrentVersion = c.req.query('v') === String(user.avatarUpdatedAt);
		return imageResponse(
			object,
			object.httpMetadata?.contentType ?? 'application/octet-stream',
			isCurrentVersion ? CACHE_CURRENT_VERSION : CACHE_REVALIDATE,
		);
	})
	.put('/', imageUploadLimit(AVATAR_MAX_BYTES), async (c) => {
		const { bytes, contentType } = await readImageUpload(c, AVATAR_MAX_BYTES);
		const user = await finishEvenIfDisconnected(c, replaceAvatar(c.env.BUCKET, c.var.db, c.var.user.id, bytes, contentType));
		return c.json({ user: publicUser(user) });
	})
	.delete('/', async (c) => {
		const user = await finishEvenIfDisconnected(c, removeAvatar(c.env.BUCKET, c.var.db, c.var.user.id));
		return c.json({ user: publicUser(user) });
	});
