import { and, asc, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { subjectSchema, subjectUpdateSchema } from '../../shared/schemas';
import { subjects } from '../db/schema';
import { hasValues, notFound, type DB } from '../lib/db';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

async function assertNameFree(db: DB, userId: string, name: string, exceptId?: string) {
	const clash = await db
		.select({ id: subjects.id })
		.from(subjects)
		.where(and(eq(subjects.userId, userId), eq(subjects.name, name), exceptId ? ne(subjects.id, exceptId) : undefined))
		.get();
	if (clash) throw new HTTPException(409, { message: '已經有同名的科目' });
}

export const subjectRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/', async (c) => {
		const rows = await c.var.db.select().from(subjects).where(eq(subjects.userId, c.var.user.id)).orderBy(asc(subjects.createdAt));
		return c.json({ subjects: rows });
	})
	.post('/', validate('json', subjectSchema), async (c) => {
		const input = c.req.valid('json');
		await assertNameFree(c.var.db, c.var.user.id, input.name);
		const row = await c.var.db
			.insert(subjects)
			.values({ ...input, userId: c.var.user.id })
			.returning()
			.get();
		return c.json({ subject: row }, 201);
	})
	.patch('/:id', validate('json', subjectUpdateSchema), async (c) => {
		const input = c.req.valid('json');
		const id = c.req.param('id');
		if (input.name) await assertNameFree(c.var.db, c.var.user.id, input.name, id);
		const own = and(eq(subjects.id, id), eq(subjects.userId, c.var.user.id));
		const row = hasValues(input)
			? await c.var.db.update(subjects).set(input).where(own).returning().get()
			: await c.var.db.select().from(subjects).where(own).get();
		if (!row) notFound('科目');
		return c.json({ subject: row });
	})
	.delete('/:id', async (c) => {
		// 相關的考試、任務、筆記會保留，只是科目欄位變成空白（ON DELETE SET NULL）
		const row = await c.var.db
			.delete(subjects)
			.where(and(eq(subjects.id, c.req.param('id')), eq(subjects.userId, c.var.user.id)))
			.returning({ id: subjects.id })
			.get();
		if (!row) notFound('科目');
		return c.json({ ok: true });
	});
