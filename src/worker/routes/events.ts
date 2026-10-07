import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { dateString, eventSchema, eventUpdateSchema } from '../../shared/schemas';
import { events, subjects } from '../db/schema';
import { assertOwned, notFound, ownedBy } from '../lib/db';
import { eventItemFields } from '../lib/events';
import { validate } from '../middleware/validate';
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
		await assertOwned(c.var.db, subjects, input.subjectId, c.var.user.id);
		const row = await c.var.db
			.insert(events)
			.values({ ...input, userId: c.var.user.id })
			.returning()
			.get();
		return c.json({ event: { ...row, taskTotal: 0, taskDone: 0 } }, 201);
	})
	.patch('/:id', validate('json', eventUpdateSchema), async (c) => {
		const input = c.req.valid('json');
		await assertOwned(c.var.db, subjects, input.subjectId, c.var.user.id);
		// 回應和列表一樣帶相關任務的完成進度（eventItemFields）
		const event: EventItem | undefined = await c.var.db
			.update(events)
			.set({ ...input, updatedAt: Date.now() })
			.where(ownedBy(events, c.req.param('id'), c.var.user.id))
			.returning(eventItemFields())
			.get();
		if (!event) notFound(events);
		return c.json({ event });
	})
	.delete('/:id', async (c) => {
		const row = await c.var.db
			.delete(events)
			.where(ownedBy(events, c.req.param('id'), c.var.user.id))
			.returning({ id: events.id })
			.get();
		if (!row) notFound(events);
		return c.json({ ok: true });
	});
