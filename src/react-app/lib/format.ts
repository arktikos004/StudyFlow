import { diffDays } from '../../shared/dates';

export function formatMinutes(min: number): string {
	const m = Math.round(min);
	if (m < 60) return `${m} 分鐘`;
	const h = Math.floor(m / 60);
	const rest = m % 60;
	return rest ? `${h} 小時 ${rest} 分` : `${h} 小時`;
}

/** 精簡版：1.5h / 45m，給圖表軸線和小空間使用 */
export function formatMinutesShort(min: number): string {
	if (min < 60) return `${Math.round(min)}m`;
	const h = min / 60;
	return `${h >= 10 ? Math.round(h) : Math.round(h * 10) / 10}h`;
}

export function formatDuration(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);
	const mm = String(m).padStart(2, '0');
	const ss = String(s).padStart(2, '0');
	return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function parts(date: string) {
	const [y, m, d] = date.split('-').map(Number);
	const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
	return { y, m, d, dow };
}

/** 9/29（一） */
export function formatDate(date: string, withYear = false): string {
	const { y, m, d, dow } = parts(date);
	return `${withYear ? `${y}/` : ''}${m}/${d}（${WEEKDAYS[dow]}）`;
}

export function formatMonthDay(date: string): string {
	const { m, d } = parts(date);
	return `${m}/${d}`;
}

export function weekdayLabel(date: string): string {
	return WEEKDAYS[parts(date).dow];
}

export function formatTime(epochMs: number): string {
	return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(epochMs);
}

/** 考試倒數：今天 / 明天 / 3 天後 / 已過 2 天 */
export function relativeDay(date: string, today: string): { label: string; days: number } {
	const days = diffDays(today, date);
	if (days === 0) return { label: '今天', days };
	if (days === 1) return { label: '明天', days };
	if (days > 1) return { label: `${days} 天後`, days };
	return { label: `已過 ${-days} 天`, days };
}

export function dDay(date: string, today: string): string {
	const days = diffDays(today, date);
	if (days === 0) return 'D-Day';
	return days > 0 ? `D-${days}` : `D+${-days}`;
}

export const PRIORITY_LABEL = { high: '高', medium: '中', low: '低' } as const;
export const STATUS_LABEL = { todo: '待辦', doing: '進行中', done: '已完成' } as const;
export const EVENT_KIND_LABEL = { exam: '考試', deadline: '截止日' } as const;
export const MODE_LABEL = { pomodoro: '番茄鐘', stopwatch: '碼錶', manual: '手動補登' } as const;
