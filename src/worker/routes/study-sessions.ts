import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { addDays, today } from '../../shared/dates';
import { dateString, studySessionSchema, studySessionUpdateSchema } from '../../shared/schemas';
import { studySessions, subjects, tasks } from '../db/schema';
import { assertOwned, notFound } from '../lib/db';
import { startedBetween } from '../lib/stats';
import { validate } from '../lib/validator';
import { recordAchievementUnlocks } from '../middleware/achievement-unlocks';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

const listQuery = z.object({ from: dateString.optional(), to: dateString.optional() });

/** 沒有指定 from 時列出最近幾天（含 to 當天） */
const DEFAULT_LIST_DAYS = 7;

export const studySessionRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.use(recordAchievementUnlocks('study'))
	.get('/', validate('query', listQuery), async (c) => {
		const tz = c.var.user.timezone;
		const to = c.req.valid('query').to ?? today(tz);
		const from = c.req.valid('query').from ?? addDays(to, -(DEFAULT_LIST_DAYS - 1));
		const rows = await c.var.db
			.select()
			.from(studySessions)
			.where(and(eq(studySessions.userId, c.var.user.id), startedBetween(from, to, tz)))
			.orderBy(desc(studySessions.startedAt));
		return c.json({ sessions: rows });
	})
	.post('/', validate('json', studySessionSchema), async (c) => {
		const input = c.req.valid('json');
		const userId = c.var.user.id;
		await assertOwned(c.var.db, subjects, input.subjectId, userId, '科目');
		await assertOwned(c.var.db, tasks, input.taskId, userId, '任務');
		const durationSec = input.durationSec ?? Math.round((input.endedAt - input.startedAt) / 1000);
		const row = await c.var.db
			.insert(studySessions)
			.values({ ...input, durationSec, userId })
			.returning()
			.get();
		return c.json({ session: row }, 201);
	})
	.patch('/:id', validate('json', studySessionUpdateSchema), async (c) => {
		const input = c.req.valid('json');
		const db = c.var.db;
		const userId = c.var.user.id;
		const current = await db
			.select()
			.from(studySessions)
			.where(and(eq(studySessions.id, c.req.param('id')), eq(studySessions.userId, userId)))
			.get();
		if (!current) notFound('學習紀錄');

		const startedAt = input.startedAt ?? current.startedAt;
		const endedAt = input.endedAt ?? current.endedAt;
		const span = endedAt - startedAt;
		const timesChanged = startedAt !== current.startedAt || endedAt !== current.endedAt;
		// 沒給秒數但改了起訖時間：依新的起訖時間重新計算（起訖顛倒時留給檢查回報錯誤）
		const durationSec =
			input.durationSec ?? (!timesChanged ? current.durationSec : span > 0 ? Math.max(1, Math.round(span / 1000)) : undefined);

		// 和原紀錄合併成整筆，套用和新增時同一組規則
		const merged = studySessionSchema.safeParse({
			mode: input.mode ?? current.mode,
			startedAt,
			endedAt,
			durationSec,
			subjectId: input.subjectId === undefined ? current.subjectId : input.subjectId,
			taskId: input.taskId === undefined ? current.taskId : input.taskId,
			note: input.note === undefined ? current.note : input.note,
		});
		if (!merged.success) throw new HTTPException(400, { message: merged.error.issues[0]?.message ?? '輸入資料格式錯誤' });
		await assertOwned(db, subjects, input.subjectId, userId, '科目');
		await assertOwned(db, tasks, input.taskId, userId, '任務');

		const row = await db.update(studySessions).set(merged.data).where(eq(studySessions.id, current.id)).returning().get();
		return c.json({ session: row });
	})
	.delete('/:id', async (c) => {
		const row = await c.var.db
			.delete(studySessions)
			.where(and(eq(studySessions.id, c.req.param('id')), eq(studySessions.userId, c.var.user.id)))
			.returning({ id: studySessions.id })
			.get();
		if (!row) notFound('學習紀錄');
		return c.json({ ok: true });
	});
