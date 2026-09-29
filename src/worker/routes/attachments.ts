import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { attachments } from '../db/schema';
import { notFound } from '../lib/db';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

export const attachmentRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/:id', async (c) => {
		// R2 bucket 不公開：每次都先確認照片屬於目前使用者，再由 Worker 轉送
		const att = await c.var.db
			.select()
			.from(attachments)
			.where(and(eq(attachments.id, c.req.param('id')), eq(attachments.userId, c.var.user.id)))
			.get();
		if (!att) notFound('照片');
		const obj = await c.env.BUCKET.get(att.r2Key);
		if (!obj) notFound('照片');
		return new Response(obj.body, {
			headers: {
				'Content-Type': att.contentType,
				'Content-Length': String(obj.size),
				// 同一個 ID 的照片內容不會變，可以在瀏覽器快取
				'Cache-Control': 'private, max-age=86400, immutable',
				'Content-Disposition': 'inline',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	})
	.delete('/:id', async (c) => {
		const att = await c.var.db
			.delete(attachments)
			.where(and(eq(attachments.id, c.req.param('id')), eq(attachments.userId, c.var.user.id)))
			.returning()
			.get();
		if (!att) notFound('照片');
		await c.env.BUCKET.delete(att.r2Key);
		return c.json({ ok: true });
	});
