// API 回應的資料型別。資料表欄位直接由 Drizzle schema 推導，前後端永遠一致。
import type { Attachment, Note, StudyEvent, StudySession, Subject, Task } from '../worker/db/schema';

export type { StudySession, Subject, Task };

export type PublicUser = { id: string; email: string; displayName: string; timezone: string; createdAt: number };

export type EventItem = StudyEvent & { taskTotal: number; taskDone: number };

export type PublicAttachment = Pick<Attachment, 'id' | 'noteId' | 'contentType' | 'size' | 'createdAt'>;

export type NoteItem = Note & { attachments: PublicAttachment[] };

export type DashboardResponse = {
	today: string;
	upcomingEvents: StudyEvent[];
	focusTasks: Task[];
	openTaskCount: number;
	reviewDueCount: number;
	todayMinutes: number;
	weekMinutes: number;
	streak: number;
	last7: { date: string; minutes: number }[];
};

export type StatsResponse = {
	range: { from: string; to: string; days: number };
	totals: {
		minutes: number;
		sessions: number;
		activeDays: number;
		avgMinutesPerDay: number;
		currentStreak: number;
		longestStreak: number;
	};
	daily: { date: string; minutes: number; bySubject: Record<string, number> }[];
	bySubject: { subjectId: string | null; minutes: number }[];
	heatmap: { date: string; minutes: number }[];
	weekly: { weekStart: string; due: number; done: number }[];
	tasks: { total: number; done: number; overdue: number };
	mistakes: { total: number; mastered: number; due: number };
};
