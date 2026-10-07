import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { TASK_STATUSES, taskSchema, taskUpdateSchema } from '../../shared/schemas';
import { events, subjects, tasks } from '../db/schema';
import { assertOwned, notFound, type DB } from '../lib/db';
import { taskItemFields } from '../lib/tasks';
import { validate } from '../lib/validator';
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
	await assertOwned(db, subjects, input.subjectId, userId, '科目');
	await assertOwned(db, events, input.eventId, userId, '考試或截止日');
}

export const taskRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	// 寫入後記下新解鎖成就的時間（PRO-2）；讀取不經過
	.use(recordAchievementUnlocks)
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
			// 有期限的排前面、期限近的優先，再依優先度
			.orderBy(
				sql`${tasks.dueDate} IS NULL`,
				asc(tasks.dueDate),
				sql`CASE ${tasks.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
				desc(tasks.createdAt),
			);
		return c.json({ tasks: rows });
	})
	.post('/', validate('json', taskSchema), async (c) => {
		const input = c.req.valid('json');
		await assertRefs(c.var.db, c.var.user.id, input);
		const row = await c.var.db
			.insert(tasks)
			.values({ ...input, userId: c.var.user.id, completedAt: input.status === 'done' ? Date.now() : null })
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
			.where(and(eq(tasks.id, c.req.param('id')), eq(tasks.userId, userId)))
			.get();
		if (!current) notFound('任務');

		let completedAt = current.completedAt;
		if (input.status && input.status !== current.status) {
			completedAt = input.status === 'done' ? Date.now() : null;
		}
		// 回應和列表一樣帶 spentMinutes，前端可以直接換掉快取裡的那一筆
		const task: TaskItem = await db
			.update(tasks)
			.set({ ...input, completedAt, updatedAt: Date.now() })
			.where(eq(tasks.id, current.id))
			.returning(taskItemFields())
			.get();
		return c.json({ task });
	})
	.delete('/:id', async (c) => {
		const row = await c.var.db
			.delete(tasks)
			.where(and(eq(tasks.id, c.req.param('id')), eq(tasks.userId, c.var.user.id)))
			.returning({ id: tasks.id })
			.get();
		if (!row) notFound('任務');
		return c.json({ ok: true });
	});
