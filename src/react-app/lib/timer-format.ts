import { addDays, localDateTime } from '../../shared/dates';
import { formatDate, formatMonthDay } from './format';

// 依使用者時區（user.timezone）顯示時間。lib/format.ts 的 formatTime 用的是裝置時區，計時與月曆一律改用這裡。

/** 某個瞬間在該時區的日期與時間：{ date: 'YYYY-MM-DD', time: 'HH:mm' } */
export function zonedParts(epochMs: number, timeZone: string): { date: string; time: string } {
	const [date, time] = localDateTime(epochMs, timeZone).split(' ');
	return { date, time };
}

/** 'HH:mm'（24 小時制） */
export function formatClock(epochMs: number, timeZone: string): string {
	return zonedParts(epochMs, timeZone).time;
}

/** '09:00–09:25'；結束在另一天時加上日期：'23:30–9/29 00:40' */
export function formatClockRange(start: number, end: number, timeZone: string): string {
	const a = zonedParts(start, timeZone);
	const b = zonedParts(end, timeZone);
	return a.date === b.date ? `${a.time}–${b.time}` : `${a.time}–${formatMonthDay(b.date)} ${b.time}`;
}

/** 今天、昨天、明天，其他日期用 9/27（日）；不同年份加上年份 */
export function relativeDateLabel(date: string, today: string): string {
	if (date === today) return '今天';
	if (date === addDays(today, -1)) return '昨天';
	if (date === addDays(today, 1)) return '明天';
	return formatDate(date, date.slice(0, 4) !== today.slice(0, 4));
}

/** 報讀用的完整日期：9月29日 星期二 */
export function spokenDate(date: string): string {
	const [y, m, d] = date.split('-').map(Number);
	const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	return `${m}月${d}日 星期${'日一二三四五六'[dow]}`;
}

/** 分鐘數的精簡寫法（月曆格子）：45 分、2 小時、2 小時 5 分 */
export function formatStudyMinutes(min: number): string {
	const m = Math.round(min);
	if (m < 60) return `${m} 分`;
	const h = Math.floor(m / 60);
	return m % 60 ? `${h} 小時 ${m % 60} 分` : `${h} 小時`;
}

/** 裝置時區；和使用者設定不同時，時間欄位旁提示「依設定的時區」 */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
