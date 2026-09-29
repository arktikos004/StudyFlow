// API 回應的資料型別。資料表欄位直接由 Drizzle schema 推導，前後端永遠一致。
import type { Attachment, ChecklistItem, Note, StudyEvent, StudySession, Subject, Task } from '../worker/db/schema';

export type { ChecklistItem, StudySession, Subject, Task };

export type PublicUser = {
	id: string;
	email: string;
	displayName: string;
	timezone: string;
	createdAt: number;
	/** 讀書目標（分鐘）；null = 沒有設定 */
	dailyGoalMinutes: number | null;
	weeklyGoalMinutes: number | null;
};

export type EventItem = StudyEvent & { taskTotal: number; taskDone: number };

/** 任務加上實際投入時間：本人連結到此任務的學習紀錄加總（分鐘，小數 1 位） */
export type TaskItem = Task & { spentMinutes: number };

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
	/** 讀書目標；今天與本週的進度用 todayMinutes、weekMinutes */
	goals: {
		dailyMinutes: number | null;
		weeklyMinutes: number | null;
		/** 有設定每週目標、沒有封存的科目，依科目順序排列；minutes 是本週（週一起算）的分鐘數 */
		subjects: { subjectId: string; goalMinutes: number; minutes: number }[];
	};
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
		/** 區間內達成每日目標的天數；沒有設定目標時為 0 */
		goalMetDays: number;
	};
	daily: { date: string; minutes: number; bySubject: Record<string, number> }[];
	bySubject: { subjectId: string | null; minutes: number }[];
	heatmap: { date: string; minutes: number }[];
	weekly: { weekStart: string; due: number; done: number }[];
	tasks: { total: number; done: number; overdue: number };
	mistakes: { total: number; mastered: number; due: number };
	dailyGoalMinutes: number | null;
};
