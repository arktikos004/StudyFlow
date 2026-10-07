import { Hono } from 'hono';
import { attachments } from '../db/schema';
import { notFound, ownedBy } from '../lib/db';
import { imageResponse } from '../lib/image';
import { deleteObjectsQuietly } from '../lib/storage';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

/** 同一個 ID 的照片內容不會變，可以在瀏覽器快取 */
const CACHE_ONE_DAY = 'private, max-age=86400, immutable';

export const attachmentRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/:id', async (c) => {
		// R2 bucket 不公開：每次都先確認照片屬於目前使用者，再由 Worker 轉送
		const attachment = await c.var.db
			.select()
			.from(attachments)
			.where(ownedBy(attachments, c.req.param('id'), c.var.user.id))
			.get();
		if (!attachment) notFound(attachments);
		const object = await c.env.BUCKET.get(attachment.r2Key);
		if (!object) notFound(attachments);
		return imageResponse(object, attachment.contentType, CACHE_ONE_DAY);
	})
	.delete('/:id', async (c) => {
		const attachment = await c.var.db
			.delete(attachments)
			.where(ownedBy(attachments, c.req.param('id'), c.var.user.id))
			.returning()
			.get();
		if (!attachment) notFound(attachments);
		await deleteObjectsQuietly(c.env.BUCKET, [attachment.r2Key]);
		return c.json({ ok: true });
	});
