import { and, count, eq, inArray } from 'drizzle-orm';
import { today } from '../../shared/dates';
import type { Achievement, ProfileBadge } from '../../shared/api-types';
import { achievementUnlocks, notes, studySessions, tasks, type User } from '../db/schema';
import type { DB } from './db';
import { metDailyGoal, minutesByDate, streaks } from './stats';

/** 番茄鐘成就只計入至少 10 分鐘的番茄紀錄，提早結束的 1 分鐘紀錄不算（PO 決定） */
const POMODORO_MIN_SEC = 600;

/** 小時數無條件捨去到小數 1 位：9.99 小時顯示 9.9，不會看起來已達成卻沒解鎖 */
const floor1 = (n: number) => Math.floor(n * 10) / 10;

// ---- 累積值：全部歷史、只有本人的資料 ----

/** 從學習紀錄算出來的累積值 */
export type StudyTotals = {
	/** 學習紀錄的筆數與總秒數 */
	sessions: number;
	seconds: number;
	/** 合格的番茄鐘數：mode = 'pomodoro' 而且至少 10 分鐘 */
	pomodoros: number;
	/**
	 * 連續讀書天數，依使用者時區的當地日期分組（和 dashboard.streak 同一個 streaks()）。
	 * 這裡用全部歷史；總覽只讀近一年（ACTIVITY_LOOKBACK_DAYS），連續很久時總覽的數字會比較少：
	 * - 今天已經讀書：連續 367 天以上才不同（總覽最多 366）。
	 * - 今天還沒讀書（從昨天算起）：連續 366 天以上就不同（總覽最多 365）。
	 */
	currentStreak: number;
	longestStreak: number;
	/** 最長連續達成每日目標的天數；沒有設定目標時為 0 */
	longestGoalStreak: number;
};

/** 成就（GET /api/achievements）與個人檔案（GET /api/profile/summary）共用的累積值 */
export type LifetimeTotals = StudyTotals & {
	tasksDone: number;
	/** 已掌握的錯題（kind = 'mistake'）；一般筆記不算 */
	mistakesMastered: number;
};

const NO_STUDY: StudyTotals = { sessions: 0, seconds: 0, pomodoros: 0, currentStreak: 0, longestStreak: 0, longestGoalStreak: 0 };

/** 學習紀錄只取三個欄位，筆數、秒數、番茄數與連續天數都在記憶體裡算（依使用者的時區與每日目標） */
async function loadStudyTotals(db: DB, user: User): Promise<StudyTotals> {
	const rows = await db
		.select({ startedAt: studySessions.startedAt, durationSec: studySessions.durationSec, mode: studySessions.mode })
		.from(studySessions)
		.where(eq(studySessions.userId, user.id));

	let seconds = 0;
	let pomodoros = 0;
	for (const row of rows) {
		seconds += row.durationSec;
		if (row.mode === 'pomodoro' && row.durationSec >= POMODORO_MIN_SEC) pomodoros++;
	}

	const todayStr = today(user.timezone);
	const minutesPerDay = minutesByDate(rows, user.timezone);
	const streak = streaks(new Set(minutesPerDay.keys()), todayStr);
	const goal = user.dailyGoalMinutes;
	const goalDays = goal ? [...minutesPerDay].filter(([, minutes]) => metDailyGoal(minutes, goal)).map(([date]) => date) : [];

	return {
		sessions: rows.length,
		seconds,
		pomodoros,
		currentStreak: streak.current,
		longestStreak: streak.longest,
		longestGoalStreak: streaks(new Set(goalDays), todayStr).longest,
	};
}

async function countTasksDone(db: DB, userId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(tasks)
		.where(and(eq(tasks.userId, userId), eq(tasks.status, 'done')));
	return row.n;
}

async function countMistakesMastered(db: DB, userId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(notes)
		.where(and(eq(notes.userId, userId), eq(notes.kind, 'mistake'), eq(notes.mastered, true)));
	return row.n;
}

/** 全部的累積值：每張表只查一次，都用 WHERE user_id = ? 限定本人 */
async function loadLifetimeTotals(db: DB, user: User): Promise<LifetimeTotals> {
	const [study, tasksDone, mistakesMastered] = await Promise.all([
		loadStudyTotals(db, user),
		countTasksDone(db, user.id),
		countMistakesMastered(db, user.id),
	]);
	return { ...study, tasksDone, mistakesMastered };
}

// ---- 成就 ----

/**
 * 成就的資料來源。一次寫入只會改變其中一種，記錄解鎖時間時只需要重算那一種：
 * 完成任務不必重讀全部的學習紀錄。
 */
export type AchievementSource = 'study' | 'tasks' | 'notes';

/** 成就的定義與目前的進度，還沒加上解鎖時間 */
type AchievementState = Omit<Achievement, 'unlockedAt'>;

type AchievementDef = Omit<AchievementState, 'unlocked' | 'progress'> & {
	source: AchievementSource;
	/** 目前的值（單位同 target）；達到 target 就解鎖 */
	value: number;
};

/**
 * 固定順序的成就定義（GET /api/achievements 的順序）。
 * 成就不另外存表，每次都從現有資料即時計算：
 * - 刪除學習紀錄、任務或錯題後，已經解鎖的徽章可能會被收回（PO 已接受）。
 * - goal-streak-7 用「目前」的每日目標判斷全部的歷史紀錄：改了目標結果就會跟著變，
 *   沒有設定目標時不計算（進度 0）。
 */
function achievementDefs(totals: LifetimeTotals): AchievementDef[] {
	const hours = floor1(totals.seconds / 3600);
	const pomodoroNote = `（每個至少 ${POMODORO_MIN_SEC / 60} 分鐘）`;
	return [
		{
			id: 'first-session',
			title: '踏出第一步',
			description: '記錄第一次讀書時間',
			icon: 'sparkles',
			source: 'study',
			target: 1,
			value: totals.sessions,
		},
		{ id: 'hours-10', title: '起步 10 小時', description: '累積讀書 10 小時', icon: 'clock', source: 'study', target: 10, value: hours },
		{
			id: 'hours-50',
			title: '累積 50 小時',
			description: '累積讀書 50 小時',
			icon: 'hourglass',
			source: 'study',
			target: 50,
			value: hours,
		},
		{
			id: 'hours-100',
			title: '百小時里程碑',
			description: '累積讀書 100 小時',
			icon: 'trophy',
			source: 'study',
			target: 100,
			value: hours,
		},
		{
			id: 'streak-7',
			title: '連續一週',
			description: '連續 7 天都有讀書',
			icon: 'flame',
			source: 'study',
			target: 7,
			value: totals.longestStreak,
		},
		{
			id: 'streak-30',
			title: '連續一個月',
			description: '連續 30 天都有讀書',
			icon: 'calendar-check',
			source: 'study',
			target: 30,
			value: totals.longestStreak,
		},
		{
			id: 'pomodoro-25',
			title: '番茄新手',
			description: `完成 25 個番茄鐘${pomodoroNote}`,
			icon: 'timer',
			source: 'study',
			target: 25,
			value: totals.pomodoros,
		},
		{
			id: 'pomodoro-100',
			title: '番茄達人',
			description: `完成 100 個番茄鐘${pomodoroNote}`,
			icon: 'alarm-clock',
			source: 'study',
			target: 100,
			value: totals.pomodoros,
		},
		{
			id: 'mastered-10',
			title: '錯題剋星',
			description: '掌握 10 題錯題',
			icon: 'brain',
			source: 'notes',
			target: 10,
			value: totals.mistakesMastered,
		},
		{
			id: 'mastered-50',
			title: '錯題大師',
			description: '掌握 50 題錯題',
			icon: 'graduation-cap',
			source: 'notes',
			target: 50,
			value: totals.mistakesMastered,
		},
		{
			id: 'tasks-50',
			title: '使命必達',
			description: '完成 50 個任務',
			icon: 'list-checks',
			source: 'tasks',
			target: 50,
			value: totals.tasksDone,
		},
		{
			id: 'goal-streak-7',
			title: '說到做到',
			description: '連續 7 天達成每日讀書目標',
			icon: 'target',
			source: 'study',
			target: 7,
			value: totals.longestGoalStreak,
		},
	];
}

const isUnlocked = (def: AchievementDef) => def.value >= def.target;

function achievementStates(totals: LifetimeTotals): AchievementState[] {
	return achievementDefs(totals).map((def) => ({
		id: def.id,
		title: def.title,
		description: def.description,
		icon: def.icon,
		target: def.target,
		unlocked: isUnlocked(def),
		progress: Math.min(def.value, def.target),
	}));
}

// ---- 解鎖時間 ----

/** 本人每個成就的解鎖時間：成就 id → UTC 毫秒 */
async function loadUnlockTimes(db: DB, userId: string): Promise<Map<string, number>> {
	const rows = await db
		.select({ id: achievementUnlocks.achievementId, at: achievementUnlocks.unlockedAt })
		.from(achievementUnlocks)
		.where(eq(achievementUnlocks.userId, userId));
	return new Map(rows.map((r) => [r.id, r.at]));
}

/**
 * 成就清單加上解鎖時間（GET /api/achievements 與個人檔案共用）：累積值與解鎖紀錄平行讀取，只讀不寫。
 * 已解鎖卻沒有紀錄的（開始記錄解鎖時間之前就解鎖）是 null。
 */
export async function loadAchievements(db: DB, user: User): Promise<{ totals: LifetimeTotals; achievements: Achievement[] }> {
	const [totals, unlockTimes] = await Promise.all([loadLifetimeTotals(db, user), loadUnlockTimes(db, user.id)]);
	const achievements = achievementStates(totals).map((a) => ({ ...a, unlockedAt: a.unlocked ? (unlockTimes.get(a.id) ?? null) : null }));
	return { totals, achievements };
}

/** 個人檔案的徽章：已解鎖的成就，最近解鎖的在前；時間不明的排在最後，依成就的固定順序（sort 是穩定排序） */
export function recentBadges(achievements: readonly Achievement[]): ProfileBadge[] {
	return achievements
		.filter((a) => a.unlocked)
		.map(({ id, title, icon, unlockedAt }) => ({ id, title, icon, unlockedAt }))
		.sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0));
}

/** 只讀某一種來源需要的資料，其他來源當成 0（它們的成就不在這次比對的範圍內） */
async function totalsFrom(db: DB, user: User, source: AchievementSource): Promise<LifetimeTotals> {
	const none: LifetimeTotals = { ...NO_STUDY, tasksDone: 0, mistakesMastered: 0 };
	switch (source) {
		case 'study':
			return { ...none, ...(await loadStudyTotals(db, user)) };
		case 'tasks':
			return { ...none, tasksDone: await countTasksDone(db, user.id) };
		case 'notes':
			return { ...none, mistakesMastered: await countMistakesMastered(db, user.id) };
	}
}

/** 某一種來源的成就裡，目前已解鎖的 id */
export async function unlockedIdsFrom(db: DB, user: User, source: AchievementSource): Promise<Set<string>> {
	const defs = achievementDefs(await totalsFrom(db, user, source));
	return new Set(defs.filter((def) => def.source === source && isUnlocked(def)).map((def) => def.id));
}

/**
 * 依一次寫入前後的已解鎖成就，更新解鎖紀錄：新解鎖的記下 now；被收回的刪掉，之後再解鎖會得到新的時間。
 * 成就 id 來自固定的清單（十幾個），不是使用者的資料，inArray 不會碰到 D1 每個查詢 100 個參數的上限。
 */
export async function recordUnlockChanges(db: DB, userId: string, before: ReadonlySet<string>, after: ReadonlySet<string>, now: number) {
	const unlocked = [...after].filter((id) => !before.has(id));
	const revoked = [...before].filter((id) => !after.has(id));
	// 同時送出的兩個請求可能都判斷為新解鎖：保留先寫入的那個時間
	const insertUnlocked = () =>
		db
			.insert(achievementUnlocks)
			.values(unlocked.map((achievementId) => ({ userId, achievementId, unlockedAt: now })))
			.onConflictDoNothing();
	const deleteRevoked = () =>
		db.delete(achievementUnlocks).where(and(eq(achievementUnlocks.userId, userId), inArray(achievementUnlocks.achievementId, revoked)));

	if (unlocked.length && revoked.length) await db.batch([insertUnlocked(), deleteRevoked()]);
	else if (unlocked.length) await insertUnlocked();
	else if (revoked.length) await deleteRevoked();
}
