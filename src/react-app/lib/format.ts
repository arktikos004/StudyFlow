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

/** 9/29（一）；和 today 不同年時加上年份（2025/9/29（一）） */
export function formatDateForToday(date: string, today: string): string {
	return formatDate(date, date.slice(0, 4) !== today.slice(0, 4));
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

/**
 * 文字的第一個字素：emoji（含膚色、ZWJ 組合、國旗）與組合字不會被切半（頭像、科目方塊的首字）。
 * 不支援 Intl.Segmenter 的環境退回以碼位切（Array.from），至少不會把代理對切開。
 * 前後空白先去掉；空字串回傳 ''。
 */
export function firstGrapheme(text: string): string {
	const s = text.trim();
	if (!s) return '';
	if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
		const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
		if (!first.done) return first.value.segment;
	}
	return Array.from(s)[0] ?? '';
}

/**
 * 日期範圍（跨頁慣例）：「9/7（一）至 10/6（二）」「10/5 至 10/11」，用「至」，不用破折號。
 * a、b 是已經格式化好的日期；「至」後面接數字時空一格，前面是全形括號就不空。
 */
export function formatRange(a: string, b: string): string {
	return `${a}${/[）)]$/.test(a) ? '' : ' '}至 ${b}`;
}

/** 分鐘數拆成小時與分鐘（四捨五入到整分），給「2 小時 30 分」這種數字與單位分開排版的地方 */
export function splitMinutes(min: number): { hours: number; minutes: number } {
	const m = Math.max(0, Math.round(min));
	return { hours: Math.floor(m / 60), minutes: m % 60 };
}
