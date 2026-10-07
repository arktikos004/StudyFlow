import { and, count, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { today } from '../../shared/dates';
import {
	ATTACHMENT_MAX_BYTES,
	ATTACHMENT_MAX_PER_NOTE,
	NOTE_KINDS,
	noteSchema,
	noteUpdateSchema,
	reviewSchema,
} from '../../shared/schemas';
import { attachments, notes, subjects, type Attachment, type Note } from '../db/schema';
import { assertOwned, hasValues, notFound, ownedBy, type DB } from '../lib/db';
import { noteMatches, reviewDue } from '../lib/notes';
import { afterReview, firstReviewDate, reviewPatch } from '../lib/review';
import { deleteObjectsQuietly } from '../lib/storage';
import { validate } from '../middleware/validate';
import { recordAchievementUnlocks } from '../middleware/achievement-unlocks';
import { requireAuth } from '../middleware/auth';
import { imageUploadLimit, readImageUpload } from '../middleware/upload';
import type { NoteItem, PublicAttachment } from '../../shared/api-types';
import type { AppEnv } from '../types';

const listQuery = z.object({
	kind: z.enum(NOTE_KINDS).optional(),
	subjectId: z.uuid().optional(),
	q: z.string().trim().max(100).optional(),
	tag: z.string().trim().max(20).optional(),
	review: z.enum(['due']).optional(),
	mastered: z.enum(['true', 'false']).optional(),
});

function publicAttachment(a: Attachment): PublicAttachment {
	return { id: a.id, noteId: a.noteId, contentType: a.contentType, size: a.size, createdAt: a.createdAt };
}

/**
 * 列表：D1 每個查詢最多 100 個參數，不能用 inArray(筆記 id)（BUG-1），
 * 改成一次取出本人全部照片（attachments_user_idx），在記憶體裡依筆記分組。
 */
async function listWithAttachments(db: DB, userId: string, rows: Note[]): Promise<NoteItem[]> {
	if (rows.length === 0) return [];
	const atts = await db.select().from(attachments).where(eq(attachments.userId, userId)).orderBy(attachments.createdAt);
	const byNote = new Map<string, PublicAttachment[]>();
	for (const a of atts) {
		const list = byNote.get(a.noteId);
		if (list) list.push(publicAttachment(a));
		else byNote.set(a.noteId, [publicAttachment(a)]);
	}
	return rows.map((n) => ({ ...n, attachments: byNote.get(n.id) ?? [] }));
}

/** 單筆：依 note_id 查這則筆記的照片 */
async function withAttachments(db: DB, note: Note): Promise<NoteItem> {
	const atts = await db.select().from(attachments).where(eq(attachments.noteId, note.id)).orderBy(attachments.createdAt);
	return { ...note, attachments: atts.map(publicAttachment) };
}

async function getOwnedNote(db: DB, id: string, userId: string) {
	const note = await db
		.select()
		.from(notes)
		.where(ownedBy(notes, id, userId))
		.get();
	if (!note) notFound(notes);
	return note;
}

export const noteRoutes = new Hono<AppEnv>()
	.use(requireAuth)
	.use(recordAchievementUnlocks('notes'))
	.get('/', validate('query', listQuery), async (c) => {
		const q = c.req.valid('query');
		const user = c.var.user;
		const rows = await c.var.db
			.select()
			.from(notes)
			.where(
				and(
					eq(notes.userId, user.id),
					q.kind ? eq(notes.kind, q.kind) : undefined,
					q.subjectId ? eq(notes.subjectId, q.subjectId) : undefined,
					q.mastered ? eq(notes.mastered, q.mastered === 'true') : undefined,
					q.review === 'due' ? reviewDue(today(user.timezone)) : undefined,
					q.tag ? sql`EXISTS (SELECT 1 FROM json_each(${notes.tags}) WHERE value = ${q.tag})` : undefined,
					q.q ? noteMatches(q.q) : undefined,
				),
			)
			// 釘選的排最前面（篩選後也一樣），其次依更新時間
			.orderBy(desc(notes.pinned), desc(notes.updatedAt))
			.limit(500);
		return c.json({ notes: await listWithAttachments(c.var.db, user.id, rows) });
	})
	.get('/:id', async (c) => {
		const note = await getOwnedNote(c.var.db, c.req.param('id'), c.var.user.id);
		return c.json({ note: await withAttachments(c.var.db, note) });
	})
	.post('/', validate('json', noteSchema), async (c) => {
		const { scheduleReview, ...input } = c.req.valid('json');
		const user = c.var.user;
		await assertOwned(c.var.db, subjects, input.subjectId, user.id);
		// 錯題預設加入複習排程，一般筆記要明確選擇才加入
		const schedule = scheduleReview ?? input.kind === 'mistake';
		const row = await c.var.db
			.insert(notes)
			.values({ ...input, userId: user.id, nextReviewDate: schedule ? firstReviewDate(today(user.timezone)) : null })
			.returning()
			.get();
		return c.json({ note: { ...row, attachments: [] } }, 201);
	})
	.patch('/:id', validate('json', noteUpdateSchema), async (c) => {
		const { scheduleReview, pinned, ...input } = c.req.valid('json');
		const db = c.var.db;
		const user = c.var.user;
		await assertOwned(db, subjects, input.subjectId, user.id);
		const current = await getOwnedNote(db, c.req.param('id'), user.id);

		const patch: Partial<Note> = {
			...input,
			pinned,
			...reviewPatch(current, { mastered: input.mastered, scheduleReview }, today(user.timezone)),
		};
		// 只改釘選時不更新「最後更新」時間（NOTE-1）
		if (hasValues(input) || scheduleReview !== undefined) patch.updatedAt = Date.now();

		const row = hasValues(patch) ? await db.update(notes).set(patch).where(eq(notes.id, current.id)).returning().get() : current;
		return c.json({ note: await withAttachments(db, row) });
	})
	.post('/:id/review', validate('json', reviewSchema), async (c) => {
		const { result } = c.req.valid('json');
		const user = c.var.user;
		const current = await getOwnedNote(c.var.db, c.req.param('id'), user.id);
		const next = afterReview(current, result, today(user.timezone));
		const row = await c.var.db
			.update(notes)
			.set({ ...next, lastReviewedAt: Date.now(), updatedAt: Date.now() })
			.where(eq(notes.id, current.id))
			.returning()
			.get();
		return c.json({ note: await withAttachments(c.var.db, row) });
	})
	.delete('/:id', async (c) => {
		const db = c.var.db;
		const note = await getOwnedNote(db, c.req.param('id'), c.var.user.id);
		// 先刪筆記（照片的資料列跟著 CASCADE），再刪 R2 的檔案
		const photos = await db.select({ r2Key: attachments.r2Key }).from(attachments).where(eq(attachments.noteId, note.id));
		await db.delete(notes).where(eq(notes.id, note.id));
		await deleteObjectsQuietly(
			c.env.BUCKET,
			photos.map((photo) => photo.r2Key),
		);
		return c.json({ ok: true });
	})
	// 大小上限放在 handler 之前：沒有 Content-Length（chunked）的上傳也會在讀進記憶體前擋下
	.post('/:id/attachments', imageUploadLimit(ATTACHMENT_MAX_BYTES), async (c) => {
		const db = c.var.db;
		const user = c.var.user;
		const note = await getOwnedNote(db, c.req.param('id'), user.id);

		const [{ n }] = await db.select({ n: count() }).from(attachments).where(eq(attachments.noteId, note.id));
		if (n >= ATTACHMENT_MAX_PER_NOTE) throw new HTTPException(400, { message: `每則筆記最多 ${ATTACHMENT_MAX_PER_NOTE} 張照片` });

		const { bytes, contentType } = await readImageUpload(c, ATTACHMENT_MAX_BYTES);

		const id = crypto.randomUUID();
		const r2Key = `users/${user.id}/${id}`;
		await c.env.BUCKET.put(r2Key, bytes, { httpMetadata: { contentType } });
		// 照片的資料列與筆記的「最後更新」一起寫入（同一個交易）；沒寫成功的話，剛存的檔案沒人引用，刪掉
		const [[row]] = await db
			.batch([
				db.insert(attachments).values({ id, userId: user.id, noteId: note.id, r2Key, contentType, size: bytes.byteLength }).returning(),
				db.update(notes).set({ updatedAt: Date.now() }).where(eq(notes.id, note.id)),
			])
			.catch(async (e) => {
				await deleteObjectsQuietly(c.env.BUCKET, [r2Key]);
				throw e;
			});
		return c.json({ attachment: publicAttachment(row) }, 201);
	});
