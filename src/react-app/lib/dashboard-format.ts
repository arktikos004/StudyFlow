import { diffDays, weekStart, zonedTime } from '../../shared/dates';

// 總覽與統計頁（s2/dashboard）專用的格式化與時間工具。
// 日期時間一律依使用者的時區（user.timezone）計算，不用裝置的時區。

/** 使用者時區現在是幾點（0–23）；時區字串有問題時退回裝置時間，不讓整頁壞掉 */
export function hourIn(timeZone: string, now = Date.now()): number {
	try {
		return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now)) % 24;
	} catch {
		return new Date(now).getHours();
	}
}

/** 問候語，依使用者時區的時刻 */
export function greetingFor(timeZone: string, now = Date.now()): string {
	const h = hourIn(timeZone, now);
	if (h < 5) return '夜深了';
	if (h < 12) return '早安';
	if (h < 18) return '午安';
	return '晚安';
}

/** 考試開始的時間點（epoch 毫秒，依使用者時區解讀日期與時間）；沒有時間的考試回傳 null */
export function eventStartMs(date: string, time: string | null | undefined, timeZone: string): number | null {
	if (!time) return null;
	try {
		return zonedTime(date, time, timeZone);
	} catch {
		return null;
	}
}

/** 本週（週一起算）到今天為止過了幾天，含今天（1–7） */
export function daysIntoWeek(today: string): number {
	return diffDays(weekStart(today), today) + 1;
}

/** 分鐘數拆成數字與單位，和 formatMinutes 的文字一致：45 分鐘／1 小時 20 分／2 小時 */
export function minuteParts(min: number): { value: number; unit: string }[] {
	const m = Math.round(min);
	if (m < 60) return [{ value: m, unit: '分鐘' }];
	const h = Math.floor(m / 60);
	const rest = m % 60;
	return rest ? [{ value: h, unit: '小時' }, { value: rest, unit: '分' }] : [{ value: h, unit: '小時' }];
}
