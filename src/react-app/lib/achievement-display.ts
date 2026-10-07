import type { Achievement } from '../../shared/api-types';
import { localDate } from '../../shared/dates';

// 成就（APP-2）的純邏輯：已看過的紀錄、新解鎖的判斷、單位與分組、下一個目標。
// 不碰 DOM 與 React（localStorage 由呼叫端傳入），test/achievement-display.spec.ts 直接測。

/** localStorage 的 key：依使用者分開，同一台電腦換帳號登入不會互相影響 */
export const seenKey = (userId: string) => `studyflow:achievements-seen:${userId}`;

/** 讀回已看過（已跳過 toast）的成就 id；沒有紀錄或格式不對時回傳 null（視為第一次使用） */
export function parseSeen(raw: string | null | undefined): string[] | null {
	if (!raw) return null;
	try {
		const v: unknown = JSON.parse(raw);
		return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null;
	} catch {
		return null;
	}
}

/**
 * 比對目前已解鎖的成就與已看過的紀錄：
 * - 第一次使用（seen 為 null）：靜默記下目前已解鎖的，不跳 toast。
 *   既有使用者第一次載到這個功能時，不會一口氣跳出好幾個「新解鎖」。
 * - 之後：只對「沒看過」的跳 toast。已看過的紀錄只增不減：
 *   徽章因為刪除資料被收回、之後又解鎖時不會再跳（toast 只在第一次解鎖時出現一次，成就頁仍顯示目前的真實狀態）。
 */
export function diffUnlocked(seen: readonly string[] | null, unlockedIds: readonly string[]): { announce: string[]; next: string[] } {
	if (seen === null) return { announce: [], next: [...new Set(unlockedIds)] };
	const known = new Set(seen);
	const announce = [...new Set(unlockedIds)].filter((id) => !known.has(id));
	return { announce, next: announce.length ? [...seen, ...announce] : [...seen] };
}

/**
 * 解鎖日期（PRO-2），依使用者時區：「10 月 7 日」；不是今年時加上年份（「2025 年 12 月 31 日」）。
 * dateTime 給 <time dateTime>（YYYY-MM-DD）。
 */
export function unlockedDate(unlockedAt: number, timeZone: string, now: number = Date.now()): { text: string; dateTime: string } {
	const dateTime = localDate(unlockedAt, timeZone);
	const [year, month, day] = dateTime.split('-').map(Number);
	const thisYear = Number(localDate(now, timeZone).slice(0, 4));
	return { text: `${year === thisYear ? '' : `${year} 年 `}${month} 月 ${day} 日`, dateTime };
}

/** 進度的單位（同 description）：依成就 id 的前綴判斷，新的成就沒有對應時回傳空字串 */
export function achievementUnit(id: string): string {
	if (id === 'first-session') return '次';
	if (id.startsWith('hours-')) return '小時';
	if (id.startsWith('streak-') || id.startsWith('goal-streak-')) return '天';
	if (id.startsWith('pomodoro-')) return '個';
	if (id.startsWith('mastered-')) return '題';
	if (id.startsWith('tasks-')) return '個';
	return '';
}

/** 成就頁的分組（依後端的固定順序）；新的成就歸到「其他」 */
export const ACHIEVEMENT_GROUPS = [
	{ key: 'time', label: '讀書時數', match: (id: string) => id === 'first-session' || id.startsWith('hours-') },
	{ key: 'streak', label: '連續天數', match: (id: string) => id.startsWith('streak-') || id.startsWith('goal-streak-') },
	{ key: 'pomodoro', label: '番茄鐘', match: (id: string) => id.startsWith('pomodoro-') },
	{ key: 'practice', label: '錯題與任務', match: (id: string) => id.startsWith('mastered-') || id.startsWith('tasks-') },
] as const;

export function groupAchievements<T extends Pick<Achievement, 'id'>>(list: readonly T[]): { key: string; label: string; items: T[] }[] {
	const groups = ACHIEVEMENT_GROUPS.map((g) => ({ key: g.key as string, label: g.label as string, items: [] as T[] }));
	const other: T[] = [];
	for (const a of list) {
		const i = ACHIEVEMENT_GROUPS.findIndex((g) => g.match(a.id));
		if (i >= 0) groups[i].items.push(a);
		else other.push(a);
	}
	if (other.length) groups.push({ key: 'other', label: '其他', items: other });
	return groups.filter((g) => g.items.length > 0);
}

/**
 * 把依序排列的區塊分成左右兩欄，各欄自己往下堆疊（兩欄的卡片不必等高，不會留白）。
 * 左欄是前面連續的幾個、右欄是其餘的，所以單欄（手機）時照原本的順序讀；
 * 切點選讓兩欄的估計高度最接近的位置（weight 是每個區塊的估計高度，例如列數＋標題）。
 */
export function splitColumns<T>(items: readonly T[], weight: (item: T) => number): [T[], T[]] {
	if (items.length < 2) return [[...items], []];
	const w = items.map(weight);
	const total = w.reduce((a, b) => a + b, 0);
	let best = 1;
	let bestDiff = Infinity;
	let left = 0;
	for (let k = 1; k < items.length; k++) {
		left += w[k - 1];
		const diff = Math.abs(total - 2 * left);
		// 差距一樣時讓左欄多一些（左欄是先讀的那一欄）
		if (diff <= bestDiff) {
			best = k;
			bestDiff = diff;
		}
	}
	return [items.slice(0, best), items.slice(best)];
}

/** 進度數字：小時數保留一位小數（後端已無條件捨去），其他是整數 */
export function formatProgress(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * 下一個目標：還沒解鎖的成就裡完成比例最高的（同比例取清單順序在前的）；全部解鎖時回傳 null。
 */
export function nextMilestone<T extends Pick<Achievement, 'unlocked' | 'progress' | 'target'>>(list: readonly T[]): T | null {
	let best: T | null = null;
	let bestRatio = -1;
	for (const a of list) {
		if (a.unlocked) continue;
		const ratio = a.target > 0 ? a.progress / a.target : 0;
		if (ratio > bestRatio) {
			best = a;
			bestRatio = ratio;
		}
	}
	return best;
}
