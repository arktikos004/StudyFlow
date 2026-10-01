import { addDays, localDate, localDateTime, weekStart } from '../../../shared/dates';

// 月曆的純函式（有測試）：月格、鍵盤移動、學習紀錄依使用者時區切成每天的時段、重疊時段的欄位配置。

export const DAY_MINUTES = 24 * 60;
/** 考試沒有結束時間：時間軸上固定畫 30 分鐘高 */
export const EVENT_SPAN_MIN = 30;

/** 考試有時間（'HH:mm'）時畫在時間軸，沒有時間的放全天列 */
export function eventStartMinute(time: string | null | undefined): number | null {
	if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
}

/** 'YYYY-MM' 這個月的 6 週月格（42 天，從週一開始） */
export function monthGrid(month: string): string[] {
	const start = weekStart(`${month}-01`);
	return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** 從 date 所在週的週一開始的 7 天 */
export function weekDays(date: string): string[] {
	const start = weekStart(date);
	return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function shiftMonth(month: string, delta: number): string {
	const [y, m] = month.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const daysInMonth = (month: string) => {
	const [y, m] = month.split('-').map(Number);
	return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** 換月但保留「幾號」，超過那個月的天數時取月底（1/31 的下個月是 2/28） */
export function shiftMonthKeepDay(date: string, delta: number): string {
	const month = shiftMonth(date.slice(0, 7), delta);
	const day = Math.min(Number(date.slice(8)), daysInMonth(month));
	return `${month}-${String(day).padStart(2, '0')}`;
}

/**
 * 月格的鍵盤移動（WAI-ARIA grid / date picker）：
 * 左右方向鍵 ±1 天、上下方向鍵 ±7 天、Home／End 到這週的週一／週日、PageUp／PageDown ±1 個月（加 Shift ±1 年）。
 * 不是移動鍵時回傳 null。
 */
export function moveDate(date: string, key: string, shift = false): string | null {
	switch (key) {
		case 'ArrowLeft':
			return addDays(date, -1);
		case 'ArrowRight':
			return addDays(date, 1);
		case 'ArrowUp':
			return addDays(date, -7);
		case 'ArrowDown':
			return addDays(date, 7);
		case 'Home':
			return weekStart(date);
		case 'End':
			return addDays(weekStart(date), 6);
		case 'PageUp':
			return shiftMonthKeepDay(date, shift ? -12 : -1);
		case 'PageDown':
			return shiftMonthKeepDay(date, shift ? 12 : 1);
		default:
			return null;
	}
}

const toMinutes = (hhmm: string) => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
};

/** 某個瞬間在該時區的日期與「當天第幾分鐘」 */
export function wallMinute(epochMs: number, timeZone: string): { date: string; minute: number } {
	const [date, time] = localDateTime(epochMs, timeZone).split(' ');
	return { date, minute: toMinutes(time) };
}

export type DaySegment = { date: string; startMin: number; endMin: number; continuesFromPrev: boolean; continuesToNext: boolean };

/**
 * 把一段時間依使用者時區切成每天的時段（跨午夜的紀錄分成兩段）。
 * 分鐘數是牆上時間（夏令時間切換當天也照牆上時間畫）；剛好在午夜結束的不會多出長度 0 的一段。
 */
export function splitByDay(startedAt: number, endedAt: number, timeZone: string): DaySegment[] {
	const a = wallMinute(startedAt, timeZone);
	const b = wallMinute(Math.max(startedAt, endedAt), timeZone);
	const out: DaySegment[] = [];
	let date = a.date;
	let startMin = a.minute;
	while (date < b.date) {
		out.push({ date, startMin, endMin: DAY_MINUTES, continuesFromPrev: out.length > 0, continuesToNext: true });
		date = addDays(date, 1);
		startMin = 0;
	}
	if (out.length === 0 && b.minute <= startMin && endedAt > startedAt) {
		// 夏令時間結束當天（牆上時間倒退一小時）：結束的牆上時間可能早於或等於開始，改用實際經過的分鐘數
		const endMin = Math.min(DAY_MINUTES, startMin + Math.ceil((endedAt - startedAt) / 60_000));
		out.push({ date, startMin, endMin, continuesFromPrev: false, continuesToNext: false });
	} else if (out.length === 0 || b.minute > 0) {
		out.push({ date, startMin, endMin: Math.max(startMin, b.minute), continuesFromPrev: out.length > 0, continuesToNext: false });
	} else {
		out[out.length - 1].continuesToNext = false;
	}
	return out;
}

/**
 * 同一天裡重疊的時段並排：互相重疊（可遞移）的一群平分寬度，每個時段放在最左邊空著的欄。
 * minSpan：畫面上的最小長度（分鐘），太短的時段會畫得比實際長，重疊判斷也要用畫出來的長度。
 */
export function layoutColumns<T extends { startMin: number; endMin: number }>(
	items: readonly T[],
	minSpan = 0,
): (T & { col: number; cols: number })[] {
	const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
	const out: (T & { col: number; cols: number })[] = [];
	let cluster: { item: T; col: number }[] = [];
	let colEnds: number[] = [];
	let clusterEnd = -Infinity;
	const flush = () => {
		for (const { item, col } of cluster) out.push({ ...item, col, cols: colEnds.length });
		cluster = [];
		colEnds = [];
	};
	for (const item of sorted) {
		const end = Math.max(item.endMin, item.startMin + minSpan);
		if (item.startMin >= clusterEnd) {
			flush();
			clusterEnd = -Infinity;
		}
		let col = colEnds.findIndex((e) => e <= item.startMin);
		if (col === -1) {
			col = colEnds.length;
			colEnds.push(end);
		} else colEnds[col] = end;
		cluster.push({ item, col });
		clusterEnd = Math.max(clusterEnd, end);
	}
	flush();
	return out;
}

/**
 * 每天的讀書分鐘數：和統計、目標一樣依「開始時間」在使用者時區的日期計算
 * （跨午夜的紀錄算在開始那天；週檢視只是把方塊畫成兩段）。
 */
export function minutesByDate(sessions: readonly { startedAt: number; durationSec: number }[], timeZone: string): Map<string, number> {
	const map = new Map<string, number>();
	for (const s of sessions) {
		const d = localDate(s.startedAt, timeZone);
		map.set(d, (map.get(d) ?? 0) + s.durationSec / 60);
	}
	return map;
}
