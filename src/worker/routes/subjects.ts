import { and, asc, count, desc, eq, gte, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { addDays, startOfLocalDay, today, weekStart } from '../../shared/dates';
import { subjectOrderSchema, subjectSchema, subjectUpdateSchema } from '../../shared/schemas';
import { events, notes, studySessions, subjects, tasks } from '../db/schema';
import { hasValues, notFound, type DB } from '../lib/db';
import { eventItemFields } from '../lib/events';
import { round1 } from '../lib/stats';
import { taskItemFields } from '../lib/tasks';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { SubjectOverview } from '../../shared/api-types';
import type { AppEnv } from '../types';

async function assertNameFree(db: DB, userId: string, name: string, exceptId?: string) {
	const clash = await db
		.select({ id: subjects.id })
		.from(subjects)
		.where(and(eq(subjects.userId, userId), eq(subjects.name, name), exceptId ? ne(subjects.id, exceptId) : undefined))
		.get();
	if (clash) throw new HTTPException(409, { message: '已經有同名的科目' });
}

const listSubjects = (db: DB, userId: string) =>
	db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(asc(subjects.sortOrder), asc(subjects.createdAt));

export const subjectRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/', async (c) => {
		return c.json({ subjects: await listSubjects(c.var.db, c.var.user.id) });
	})
	.post('/', validate('json', subjectSchema), async (c) => {
		const input = c.req.valid('json');
		const userId = c.var.user.id;
		await assertNameFree(c.var.db, userId, input.name);
		const row = await c.var.db
			.insert(subjects)
			.values({
				...input,
				userId,
				// 新科目排在最後：本人目前最大的 sort_order + 1
				sortOrder: sql`(SELECT coalesce(max(sort_order), -1) + 1 FROM subjects WHERE user_id = ${userId})`,
			})
			.returning()
			.get();
		return c.json({ subject: row }, 201);
	})
	.put('/order', validate('json', subjectOrderSchema), async (c) => {
		const { ids } = c.req.valid('json');
		const db = c.var.db;
		const userId = c.var.user.id;
		// 必須剛好是本人全部的科目：數量相同、每個都是本人的（schema 已擋掉重複）
		const own = new Set((await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.userId, userId))).map((s) => s.id));
		if (ids.length !== own.size || !ids.every((id) => own.has(id))) {
			throw new HTTPException(400, { message: '科目清單不正確' });
		}
		// 一條 SQL、只有 2 個參數（D1 每個查詢最多 100 個）：json_each 的 key 就是新的順序。
		// coalesce：檢查之後才新增的科目不在清單裡，保留原本的順序，不會違反 NOT NULL。
		const [, rows] = await db.batch([
			db
				.update(subjects)
				.set({ sortOrder: sql`coalesce((SELECT key FROM json_each(${JSON.stringify(ids)}) WHERE value = subjects.id), sort_order)` })
				.where(eq(subjects.userId, userId)),
			listSubjects(db, userId),
		]);
		return c.json({ subjects: rows });
	})
	.get('/:id/overview', async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const id = c.req.param('id');
		const tz = user.timezone;
		const todayStr = today(tz);
		const weekFrom = startOfLocalDay(weekStart(todayStr), tz);
		const last30From = startOfLocalDay(addDays(todayStr, -29), tz);

		// 每個查詢都限定本人，所以可以一起送出，最後再確認科目存在
		const [subject, upcomingEvents, openTasks, [minutes], [mistakes]] = await Promise.all([
			db
				.select()
				.from(subjects)
				.where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
				.get(),
			db
				.select(eventItemFields())
				.from(events)
				.where(and(eq(events.userId, user.id), eq(events.subjectId, id), gte(events.date, todayStr)))
				.orderBy(asc(events.date), asc(events.time)),
			db
				.select(taskItemFields())
				.from(tasks)
				.where(and(eq(tasks.userId, user.id), eq(tasks.subjectId, id), ne(tasks.status, 'done')))
				.orderBy(
					sql`${tasks.dueDate} IS NULL`,
					asc(tasks.dueDate),
					sql`CASE ${tasks.priority} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
					desc(tasks.createdAt),
				),
			// 近 30 天的已包含本週（週一最早是 6 天前）
			db
				.select({
					weekSec: sql<number>`coalesce(sum(CASE WHEN ${studySessions.startedAt} >= ${weekFrom} THEN ${studySessions.durationSec} ELSE 0 END), 0)`,
					last30Sec: sql<number>`coalesce(sum(${studySessions.durationSec}), 0)`,
				})
				.from(studySessions)
				.where(and(eq(studySessions.userId, user.id), eq(studySessions.subjectId, id), gte(studySessions.startedAt, last30From))),
			db
				.select({
					total: count(),
					mastered: sql<number>`coalesce(sum(CASE WHEN ${notes.mastered} THEN 1 ELSE 0 END), 0)`,
					due: sql<number>`coalesce(sum(CASE WHEN NOT ${notes.mastered} AND ${notes.nextReviewDate} <= ${todayStr} THEN 1 ELSE 0 END), 0)`,
				})
				.from(notes)
				.where(and(eq(notes.userId, user.id), eq(notes.kind, 'mistake'), eq(notes.subjectId, id))),
		]);
		if (!subject) notFound('科目');

		const body: SubjectOverview = {
			subject,
			upcomingEvents,
			openTasks,
			minutes: { week: round1(minutes.weekSec / 60), last30: round1(minutes.last30Sec / 60) },
			mistakes,
		};
		return c.json(body);
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
