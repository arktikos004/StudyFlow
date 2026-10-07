import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { TASK_STATUSES, taskSchema, taskUpdateSchema } from '../../shared/schemas';
import { events, subjects, tasks } from '../db/schema';
import { assertOwned, notFound, ownedBy, type DB } from '../lib/db';
import { completedAtAfter, taskItemFields, taskListOrder } from '../lib/tasks';
import { validate } from '../middleware/validate';
import { recordAchievementUnlocks } from '../middleware/achievement-unlocks';
import { requireAuth } from '../middleware/auth';
import type { TaskItem } from '../../shared/api-types';
import type { AppEnv } from '../types';

const listQuery = z.object({
	status: z.enum(TASK_STATUSES).optional(),
	subjectId: z.uuid().optional(),
	eventId: z.uuid().optional(),
});

async function assertRefs(db: DB, userId: string, input: { subjectId?: string | null; eventId?: string | null }) {
	await assertOwned(db, subjects, input.subjectId, userId);
	await assertOwned(db, events, input.eventId, userId);
}

export const taskRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.use(recordAchievementUnlocks('tasks'))
	.get('/', validate('query', listQuery), async (c) => {
		const q = c.req.valid('query');
		const rows: TaskItem[] = await c.var.db
			.select(taskItemFields())
			.from(tasks)
			.where(
				and(
					eq(tasks.userId, c.var.user.id),
					q.status ? eq(tasks.status, q.status) : undefined,
					q.subjectId ? eq(tasks.subjectId, q.subjectId) : undefined,
					q.eventId ? eq(tasks.eventId, q.eventId) : undefined,
				),
			)
			.orderBy(...taskListOrder());
		return c.json({ tasks: rows });
	})
	.post('/', validate('json', taskSchema), async (c) => {
		const input = c.req.valid('json');
		await assertRefs(c.var.db, c.var.user.id, input);
		const row = await c.var.db
			.insert(tasks)
			.values({ ...input, userId: c.var.user.id, completedAt: completedAtAfter(input.status, null, Date.now()) })
			.returning()
			.get();
		const task: TaskItem = { ...row, spentMinutes: 0 };
		return c.json({ task }, 201);
	})
	.patch('/:id', validate('json', taskUpdateSchema), async (c) => {
		const input = c.req.valid('json');
		const db = c.var.db;
		const userId = c.var.user.id;
		await assertRefs(db, userId, input);

		const current = await db
			.select()
			.from(tasks)
			.where(ownedBy(tasks, c.req.param('id'), userId))
			.get();
		if (!current) notFound(tasks);

		const now = Date.now();
		// 回應和列表一樣帶 spentMinutes，前端可以直接換掉快取裡的那一筆
		const task: TaskItem = await db
			.update(tasks)
			.set({ ...input, completedAt: completedAtAfter(input.status, current, now), updatedAt: now })
			.where(eq(tasks.id, current.id))
			.returning(taskItemFields())
			.get();
		return c.json({ task });
	})
	.delete('/:id', async (c) => {
		const row = await c.var.db
			.delete(tasks)
			.where(ownedBy(tasks, c.req.param('id'), c.var.user.id))
			.returning({ id: tasks.id })
			.get();
		if (!row) notFound(tasks);
		return c.json({ ok: true });
	});
