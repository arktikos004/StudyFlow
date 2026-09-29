import { and, asc, count, eq, gte, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { dateString, eventSchema, eventUpdateSchema } from '../../shared/schemas';
import { events, subjects, tasks } from '../db/schema';
import { assertOwned, notFound } from '../lib/db';
import { eventItemFields } from '../lib/events';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { EventItem } from '../../shared/api-types';
import type { AppEnv } from '../types';

const listQuery = z.object({ from: dateString.optional(), to: dateString.optional() });

export const eventRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/', validate('query', listQuery), async (c) => {
		const { from, to } = c.req.valid('query');
		const userId = c.var.user.id;
		// 每筆都帶「相關任務完成幾項」
		const rows: EventItem[] = await c.var.db
			.select(eventItemFields())
			.from(events)
			.where(and(eq(events.userId, userId), from ? gte(events.date, from) : undefined, to ? lte(events.date, to) : undefined))
			.orderBy(asc(events.date), asc(events.time));
		return c.json({ events: rows });
	})
	.post('/', validate('json', eventSchema), async (c) => {
		const input = c.req.valid('json');
		await assertOwned(c.var.db, subjects, input.subjectId, c.var.user.id, '科目');
		const row = await c.var.db
			.insert(events)
			.values({ ...input, userId: c.var.user.id })
			.returning()
			.get();
		return c.json({ event: { ...row, taskTotal: 0, taskDone: 0 } }, 201);
	})
	.patch('/:id', validate('json', eventUpdateSchema), async (c) => {
		const input = c.req.valid('json');
		await assertOwned(c.var.db, subjects, input.subjectId, c.var.user.id, '科目');
		const row = await c.var.db
			.update(events)
			.set({ ...input, updatedAt: Date.now() })
			.where(and(eq(events.id, c.req.param('id')), eq(events.userId, c.var.user.id)))
			.returning()
			.get();
		if (!row) notFound('考試或截止日');
		const [stats] = await c.var.db
			.select({ total: count(), done: sql<number>`sum(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)` })
			.from(tasks)
			.where(eq(tasks.eventId, row.id));
		return c.json({ event: { ...row, taskTotal: stats?.total ?? 0, taskDone: stats?.done ?? 0 } });
	})
	.delete('/:id', async (c) => {
		const row = await c.var.db
			.delete(events)
			.where(and(eq(events.id, c.req.param('id')), eq(events.userId, c.var.user.id)))
			.returning({ id: events.id })
			.get();
		if (!row) notFound('考試或截止日');
		return c.json({ ok: true });
	});
