import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { addDays, today } from '../../shared/dates';
import { dateString, studySessionSchema, studySessionUpdateSchema } from '../../shared/schemas';
import { studySessions, subjects, tasks, type StudySession } from '../db/schema';
import { assertOwned, notFound, ownedBy, type DB } from '../lib/db';
import { startedBetween } from '../lib/stats';
import { recordAchievementUnlocks } from '../middleware/achievement-unlocks';
import { requireAuth } from '../middleware/auth';
import { firstIssueMessage, validate } from '../middleware/validate';
import type { AppEnv } from '../types';

const listQuery = z.object({ from: dateString.optional(), to: dateString.optional() });

/** 沒有指定 from 時列出最近幾天（含 to 當天） */
const DEFAULT_LIST_DAYS = 7;

/** 沒給秒數時由起訖時間推算，至少 1 秒（和 schema 的下限一致） */
const durationFromSpan = (startedAt: number, endedAt: number) => Math.max(1, Math.round((endedAt - startedAt) / 1000));

/**
 * 把要修改的欄位和原紀錄合併成整筆，之後套用和新增時同一組規則。
 * 沒給秒數但改了起訖時間：依新的起訖時間重新計算；起訖顛倒時不帶秒數，留給檢查回報錯誤。
 */
function mergeSessionUpdate(current: StudySession, input: z.infer<typeof studySessionUpdateSchema>) {
	const startedAt = input.startedAt ?? current.startedAt;
	const endedAt = input.endedAt ?? current.endedAt;
	const timesChanged = startedAt !== current.startedAt || endedAt !== current.endedAt;

	let durationSec = input.durationSec;
	if (durationSec === undefined && !timesChanged) durationSec = current.durationSec;
	if (durationSec === undefined && endedAt > startedAt) durationSec = durationFromSpan(startedAt, endedAt);

	return {
		mode: input.mode ?? current.mode,
		startedAt,
		endedAt,
		durationSec,
		subjectId: input.subjectId === undefined ? current.subjectId : input.subjectId,
		taskId: input.taskId === undefined ? current.taskId : input.taskId,
		note: input.note === undefined ? current.note : input.note,
	};
}

async function assertRefs(db: DB, userId: string, input: { subjectId?: string | null; taskId?: string | null }) {
	await assertOwned(db, subjects, input.subjectId, userId);
	await assertOwned(db, tasks, input.taskId, userId);
}

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
		await assertRefs(c.var.db, userId, input);
		const durationSec = input.durationSec ?? durationFromSpan(input.startedAt, input.endedAt);
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
			.where(ownedBy(studySessions, c.req.param('id'), userId))
			.get();
		if (!current) notFound(studySessions);

		const merged = studySessionSchema.safeParse(mergeSessionUpdate(current, input));
		if (!merged.success) throw new HTTPException(400, { message: firstIssueMessage(merged.error) });
		await assertRefs(db, userId, input);

		const row = await db.update(studySessions).set(merged.data).where(eq(studySessions.id, current.id)).returning().get();
		return c.json({ session: row });
	})
	.delete('/:id', async (c) => {
		const row = await c.var.db
			.delete(studySessions)
			.where(ownedBy(studySessions, c.req.param('id'), c.var.user.id))
			.returning({ id: studySessions.id })
			.get();
		if (!row) notFound(studySessions);
		return c.json({ ok: true });
	});
