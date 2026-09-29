import { and, count, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { addDays, today } from '../../shared/dates';
import {
	ATTACHMENT_MAX_BYTES,
	ATTACHMENT_MAX_PER_NOTE,
	NOTE_KINDS,
	REVIEW_INTERVALS,
	noteSchema,
	noteUpdateSchema,
	reviewSchema,
} from '../../shared/schemas';
import { attachments, notes, subjects, type Attachment, type Note } from '../db/schema';
import { assertOwned, notFound, type DB } from '../lib/db';
import { validate } from '../lib/validator';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';

const listQuery = z.object({
	kind: z.enum(NOTE_KINDS).optional(),
	subjectId: z.uuid().optional(),
	q: z.string().trim().max(100).optional(),
	tag: z.string().trim().max(20).optional(),
	review: z.enum(['due']).optional(),
	mastered: z.enum(['true', 'false']).optional(),
});

function publicAttachment(a: Attachment) {
	return { id: a.id, noteId: a.noteId, contentType: a.contentType, size: a.size, createdAt: a.createdAt };
}

async function withAttachments(db: DB, rows: Note[]) {
	if (rows.length === 0) return [];
	const atts = await db
		.select()
		.from(attachments)
		.where(
			inArray(
				attachments.noteId,
				rows.map((r) => r.id),
			),
		)
		.orderBy(attachments.createdAt);
	return rows.map((n) => ({ ...n, attachments: atts.filter((a) => a.noteId === n.id).map(publicAttachment) }));
}

async function getOwnedNote(db: DB, id: string, userId: string) {
	const note = await db
		.select()
		.from(notes)
		.where(and(eq(notes.id, id), eq(notes.userId, userId)))
		.get();
	if (!note) notFound('筆記');
	return note;
}

/** 用檔案開頭的 magic bytes 判斷真正的圖片格式，不相信瀏覽器送來的 Content-Type */
function sniffImageType(bytes: Uint8Array): string | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
	return null;
}

export const noteRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.get('/', validate('query', listQuery), async (c) => {
		const q = c.req.valid('query');
		const user = c.var.user;
		const pattern = q.q ? `%${q.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
		const rows = await c.var.db
			.select()
			.from(notes)
			.where(
				and(
					eq(notes.userId, user.id),
					q.kind ? eq(notes.kind, q.kind) : undefined,
					q.subjectId ? eq(notes.subjectId, q.subjectId) : undefined,
					q.mastered ? eq(notes.mastered, q.mastered === 'true') : undefined,
					q.review === 'due' ? and(eq(notes.mastered, false), lte(notes.nextReviewDate, today(user.timezone))) : undefined,
					q.tag ? sql`EXISTS (SELECT 1 FROM json_each(${notes.tags}) WHERE value = ${q.tag})` : undefined,
					pattern
						? sql`(${notes.title} LIKE ${pattern} ESCAPE '\\' OR ${notes.content} LIKE ${pattern} ESCAPE '\\' OR ${notes.question} LIKE ${pattern} ESCAPE '\\')`
						: undefined,
				),
			)
			.orderBy(desc(notes.updatedAt))
			.limit(500);
		return c.json({ notes: await withAttachments(c.var.db, rows) });
	})
	.get('/:id', async (c) => {
		const note = await getOwnedNote(c.var.db, c.req.param('id'), c.var.user.id);
		const [full] = await withAttachments(c.var.db, [note]);
		return c.json({ note: full });
	})
	.post('/', validate('json', noteSchema), async (c) => {
		const { scheduleReview, ...input } = c.req.valid('json');
		const user = c.var.user;
		await assertOwned(c.var.db, subjects, input.subjectId, user.id, '科目');
		const schedule = scheduleReview ?? input.kind === 'mistake';
		const row = await c.var.db
			.insert(notes)
			.values({ ...input, userId: user.id, nextReviewDate: schedule ? addDays(today(user.timezone), REVIEW_INTERVALS[0]) : null })
			.returning()
			.get();
		return c.json({ note: { ...row, attachments: [] } }, 201);
	})
	.patch('/:id', validate('json', noteUpdateSchema), async (c) => {
		const { scheduleReview, ...input } = c.req.valid('json');
		const db = c.var.db;
		const user = c.var.user;
		await assertOwned(db, subjects, input.subjectId, user.id, '科目');
		const current = await getOwnedNote(db, c.req.param('id'), user.id);

		const patch: Partial<Note> = { ...input, updatedAt: Date.now() };
		const firstReview = addDays(today(user.timezone), REVIEW_INTERVALS[0]);
		if (input.mastered === true) {
			patch.nextReviewDate = null;
		} else if (input.mastered === false && current.mastered) {
			// 取消「已掌握」＝重新開始複習
			patch.reviewStage = 0;
			patch.nextReviewDate = firstReview;
		}
		if (scheduleReview === true && !current.nextReviewDate && !current.mastered) patch.nextReviewDate = firstReview;
		if (scheduleReview === false) patch.nextReviewDate = null;

		const row = await db.update(notes).set(patch).where(eq(notes.id, current.id)).returning().get();
		const [full] = await withAttachments(db, [row]);
		return c.json({ note: full });
	})
	.post('/:id/review', validate('json', reviewSchema), async (c) => {
		const { result } = c.req.valid('json');
		const user = c.var.user;
		const current = await getOwnedNote(c.var.db, c.req.param('id'), user.id);
		const todayStr = today(user.timezone);

		let reviewStage = 0;
		let nextReviewDate: string | null = addDays(todayStr, REVIEW_INTERVALS[0]);
		let mastered = false;
		if (result === 'remembered') {
			reviewStage = current.reviewStage + 1;
			if (reviewStage >= REVIEW_INTERVALS.length) {
				mastered = true;
				nextReviewDate = null;
			} else {
				nextReviewDate = addDays(todayStr, REVIEW_INTERVALS[reviewStage]);
			}
		}
		const row = await c.var.db
			.update(notes)
			.set({ reviewStage, nextReviewDate, mastered, lastReviewedAt: Date.now(), updatedAt: Date.now() })
			.where(eq(notes.id, current.id))
			.returning()
			.get();
		const [full] = await withAttachments(c.var.db, [row]);
		return c.json({ note: full });
	})
	.delete('/:id', async (c) => {
		const db = c.var.db;
		const note = await getOwnedNote(db, c.req.param('id'), c.var.user.id);
		const atts = await db.select({ r2Key: attachments.r2Key }).from(attachments).where(eq(attachments.noteId, note.id));
		if (atts.length) await c.env.BUCKET.delete(atts.map((a) => a.r2Key));
		await db.delete(notes).where(eq(notes.id, note.id));
		return c.json({ ok: true });
	})
	.post('/:id/attachments', async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const note = await getOwnedNote(db, c.req.param('id'), user.id);

		const [{ n }] = await db.select({ n: count() }).from(attachments).where(eq(attachments.noteId, note.id));
		if (n >= ATTACHMENT_MAX_PER_NOTE) throw new HTTPException(400, { message: `每則筆記最多 ${ATTACHMENT_MAX_PER_NOTE} 張照片` });

		const length = Number(c.req.header('content-length') ?? 0);
		if (length > ATTACHMENT_MAX_BYTES + 64 * 1024) throw new HTTPException(413, { message: '照片太大（上限 5MB）' });

		const form = await c.req.formData();
		const file = form.get('file');
		if (!(file instanceof File)) throw new HTTPException(400, { message: '請選擇照片' });
		if (file.size > ATTACHMENT_MAX_BYTES) throw new HTTPException(413, { message: '照片太大（上限 5MB）' });

		const bytes = new Uint8Array(await file.arrayBuffer());
		const contentType = sniffImageType(bytes);
		if (!contentType) throw new HTTPException(415, { message: '只支援 JPEG、PNG、WebP 圖片' });

		const id = crypto.randomUUID();
		const r2Key = `users/${user.id}/${id}`;
		await c.env.BUCKET.put(r2Key, bytes, { httpMetadata: { contentType } });
		const row = await db
			.insert(attachments)
			.values({ id, userId: user.id, noteId: note.id, r2Key, contentType, size: bytes.byteLength })
			.returning()
			.get();
		await db.update(notes).set({ updatedAt: Date.now() }).where(eq(notes.id, note.id));
		return c.json({ attachment: publicAttachment(row) }, 201);
	});
