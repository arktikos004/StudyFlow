import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 慣例：
// - 「瞬間」（登入、學習時段起訖）一律存 UTC epoch 毫秒（integer）
// - 「日曆日期」（考試日、任務期限、下次複習日）存使用者當地的 'YYYY-MM-DD' 字串，避免時區換算造成日期偏移

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
	integer('created_at')
		.notNull()
		.$defaultFn(() => Date.now());
const updatedAt = () =>
	integer('updated_at')
		.notNull()
		.$defaultFn(() => Date.now());

export const users = sqliteTable('users', {
	id: id(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	displayName: text('display_name').notNull(),
	timezone: text('timezone').notNull().default('Asia/Taipei'),
	createdAt: createdAt(),
});

export const sessions = sqliteTable(
	'sessions',
	{
		// session token 的 SHA-256；資料庫外洩也無法直接拿來登入
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at').notNull(),
		createdAt: createdAt(),
	},
	(t) => [index('sessions_user_idx').on(t.userId)],
);

export const loginAttempts = sqliteTable('login_attempts', {
	key: text('key').primaryKey(),
	count: integer('count').notNull().default(0),
	windowStart: integer('window_start').notNull(),
});

export const subjects = sqliteTable(
	'subjects',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color').notNull(),
		archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
		createdAt: createdAt(),
	},
	(t) => [index('subjects_user_idx').on(t.userId), uniqueIndex('subjects_user_name_uq').on(t.userId, t.name)],
);

export const events = sqliteTable(
	'events',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
		kind: text('kind', { enum: ['exam', 'deadline'] }).notNull(),
		title: text('title').notNull(),
		date: text('date').notNull(),
		time: text('time'),
		location: text('location'),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [index('events_user_date_idx').on(t.userId, t.date)],
);

export const tasks = sqliteTable(
	'tasks',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
		eventId: text('event_id').references(() => events.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		description: text('description'),
		dueDate: text('due_date'),
		priority: text('priority', { enum: ['low', 'medium', 'high'] })
			.notNull()
			.default('medium'),
		status: text('status', { enum: ['todo', 'doing', 'done'] })
			.notNull()
			.default('todo'),
		estimatedMinutes: integer('estimated_minutes'),
		completedAt: integer('completed_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [index('tasks_user_status_idx').on(t.userId, t.status), index('tasks_user_due_idx').on(t.userId, t.dueDate)],
);

export const studySessions = sqliteTable(
	'study_sessions',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
		taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
		mode: text('mode', { enum: ['pomodoro', 'stopwatch', 'manual'] }).notNull(),
		startedAt: integer('started_at').notNull(),
		endedAt: integer('ended_at').notNull(),
		durationSec: integer('duration_sec').notNull(),
		note: text('note'),
		createdAt: createdAt(),
	},
	(t) => [index('study_sessions_user_started_idx').on(t.userId, t.startedAt)],
);

export const notes = sqliteTable(
	'notes',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
		kind: text('kind', { enum: ['note', 'mistake'] }).notNull(),
		title: text('title').notNull(),
		content: text('content'),
		question: text('question'),
		wrongAnswer: text('wrong_answer'),
		correctAnswer: text('correct_answer'),
		reason: text('reason'),
		tags: text('tags', { mode: 'json' })
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'`),
		mastered: integer('mastered', { mode: 'boolean' }).notNull().default(false),
		reviewStage: integer('review_stage').notNull().default(0),
		nextReviewDate: text('next_review_date'),
		lastReviewedAt: integer('last_reviewed_at'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [index('notes_user_kind_idx').on(t.userId, t.kind), index('notes_user_review_idx').on(t.userId, t.nextReviewDate)],
);

export const attachments = sqliteTable(
	'attachments',
	{
		id: id(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		noteId: text('note_id')
			.notNull()
			.references(() => notes.id, { onDelete: 'cascade' }),
		r2Key: text('r2_key').notNull(),
		contentType: text('content_type').notNull(),
		size: integer('size').notNull(),
		createdAt: createdAt(),
	},
	(t) => [index('attachments_note_idx').on(t.noteId)],
);

export type User = typeof users.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type StudyEvent = typeof events.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
