import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { attachments } from '../db/schema';
import { notFound } from '../lib/db';
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
			.where(and(eq(attachments.id, c.req.param('id')), eq(attachments.userId, c.var.user.id)))
			.get();
		if (!attachment) notFound('照片');
		const object = await c.env.BUCKET.get(attachment.r2Key);
		if (!object) notFound('照片');
		return imageResponse(object, attachment.contentType, CACHE_ONE_DAY);
	})
	.delete('/:id', async (c) => {
		const attachment = await c.var.db
			.delete(attachments)
			.where(and(eq(attachments.id, c.req.param('id')), eq(attachments.userId, c.var.user.id)))
			.returning()
			.get();
		if (!attachment) notFound('照片');
		await deleteObjectsQuietly(c.env.BUCKET, [attachment.r2Key]);
		return c.json({ ok: true });
	});
