import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { addDays, startOfLocalDay, today } from '../../shared/dates';
import { dateString, studySessionSchema } from '../../shared/schemas';
import { studySessions, subjects, tasks } from '../db/schema';
import { assertOwned, notFound } from '../lib/db';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

const listQuery = z.object({ from: dateString.optional(), to: dateString.optional() });

export const studySessionRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/', validate('query', listQuery), async (c) => {
		const tz = c.var.user.timezone;
		const to = c.req.valid('query').to ?? today(tz);
		const from = c.req.valid('query').from ?? addDays(to, -6);
		const rows = await c.var.db
			.select()
			.from(studySessions)
			.where(
				and(
					eq(studySessions.userId, c.var.user.id),
					gte(studySessions.startedAt, startOfLocalDay(from, tz)),
					lt(studySessions.startedAt, startOfLocalDay(addDays(to, 1), tz)),
				),
			)
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
	.delete('/:id', async (c) => {
		const row = await c.var.db
			.delete(studySessions)
			.where(and(eq(studySessions.id, c.req.param('id')), eq(studySessions.userId, c.var.user.id)))
			.returning({ id: studySessions.id })
			.get();
		if (!row) notFound('學習紀錄');
		return c.json({ ok: true });
	});
