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
	/**
	 * 頭像最後更新的時間（UTC 毫秒）；null = 沒有上傳。
	 * 前端用 lib/api.ts 的 avatarUrl() 組出 /api/auth/avatar?v=<這個值>：每次更換都會變，不會用到快取的舊圖。
	 * R2 的儲存位置（avatarKey）只在後端使用，不會出現在任何回應裡。
	 */
	avatarUpdatedAt: number | null;
};

export type EventItem = StudyEvent & { taskTotal: number; taskDone: number };

/** 任務加上實際投入時間：本人連結到此任務的學習紀錄加總（分鐘，小數 1 位） */
export type TaskItem = Task & { spentMinutes: number };

/** GET /api/subjects/:id/overview：單科總覽，一次取得 */
export type SubjectOverview = {
	subject: Subject;
	/** 這一科今天以後的考試與截止日，依日期、時間排序 */
	upcomingEvents: EventItem[];
	/** 這一科還沒完成的任務，排序同任務列表 */
	openTasks: TaskItem[];
	/** 本週（週一起算）與近 30 天（含今天）的讀書分鐘數，依使用者時區 */
	minutes: { week: number; last30: number };
	/** 這一科的錯題：總數、已掌握、今天以前到期待複習 */
	mistakes: { total: number; mastered: number; due: number };
};

export type PublicAttachment = Pick<Attachment, 'id' | 'noteId' | 'contentType' | 'size' | 'createdAt'>;

export type NoteItem = Note & { attachments: PublicAttachment[] };

export type DashboardResponse = {
	today: string;
	/** 今天以後的 5 筆考試／截止日，帶相關任務的完成進度（DASH-1） */
	upcomingEvents: EventItem[];
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

/** GET /api/summary：頁首、導覽與快速搜尋用的輕量摘要 */
export type SummaryResponse = {
	today: string;
	/** 未完成、期限是今天的任務數 */
	dueTodayCount: number;
	/** 未完成、期限已過的任務數 */
	overdueCount: number;
	/** 還沒掌握、複習日在今天以前的筆記數（同 dashboard.reviewDueCount） */
	reviewDueCount: number;
	/** 下一場考試：kind = 'exam'、date >= 今天，依日期、時間排序的第一筆 */
	nextExam: { id: string; title: string; date: string; time: string | null; subjectId: string | null } | null;
};

/** GET /api/search?q=：每類最多 5 筆，只含本人的資料 */
export type SearchResponse = {
	/** 比對標題與說明；未完成的排前面，其次是最近更新的 */
	tasks: Pick<Task, 'id' | 'title' | 'subjectId' | 'dueDate' | 'status'>[];
	/** 比對標題、地點、備註；今天以後的依日期排前面，其次是最近過去的 */
	events: Pick<StudyEvent, 'id' | 'title' | 'date' | 'kind' | 'subjectId'>[];
	/** 比對標題、內容、題目；釘選的排前面，其次是最近更新的 */
	notes: Pick<Note, 'id' | 'title' | 'kind' | 'subjectId'>[];
	/** 比對名稱；未封存的排前面，其次依科目順序 */
	subjects: Pick<Subject, 'id' | 'name' | 'color' | 'icon'>[];
};

/** 成就：由現有資料即時計算，只有本人看得到 */
export type Achievement = {
	id: string;
	title: string;
	description: string;
	/** lucide 圖示名稱（kebab-case），例如 'flame'、'calendar-check' */
	icon: string;
	unlocked: boolean;
	/** 目前進度，不會超過 target；單位同 description（小時、天、個、題） */
	progress: number;
	target: number;
};

/** GET /api/achievements：固定順序的成就清單 */
export type AchievementsResponse = { achievements: Achievement[] };

/** GET /api/profile/summary：個人檔案的累積數字，只有本人；和 GET /api/achievements 用同一份計算 */
export type ProfileSummary = {
	/** 全部學習紀錄的分鐘數（四捨五入到分鐘）與筆數 */
	totalMinutes: number;
	totalSessions: number;
	/**
	 * 目前連續天數（和 dashboard.streak 相同的算法：今天還沒讀書時從昨天算起）與最長連續天數，依使用者時區。
	 * 這裡看全部歷史；總覽只讀近一年，只有連續超過 366 天時兩邊才會不同。
	 */
	currentStreak: number;
	longestStreak: number;
	/** 已完成的任務數、已掌握的錯題數（一般筆記不算） */
	tasksDone: number;
	mistakesMastered: number;
	/** 成就：已解鎖數、總數，以及已解鎖的成就（順序同 GET /api/achievements；icon 是 lucide 圖示名稱） */
	achievements: { unlocked: number; total: number; badges: { id: string; title: string; icon: string }[] };
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
