import { diffDays } from '../../shared/dates';
import { eventStartMs } from './dashboard-format';

// 倒數磚（考試、截止日、任務期限的「還有幾天」）的狀態判斷：考試頁、總覽、單科頁共用。
// 規則在 DESIGN.md §7「跨頁慣例」的倒數磚：
// - 紅色（urgent）只給 3 天內（含今天）的考試，一定加鬧鐘圖示。
// - 截止日與任務期限在 3 天內（含今天）用 warning（soon），加 CalendarClock 圖示。
// - 其他是中性（normal）；已經過去的整塊淡化（past）。
// - 文案全站統一：「今天」「明天」「N 天後」「已結束」；24 小時內而且有時間的改成即時倒數（「後開始」「後截止」）。
// 「今天」與時間都依使用者時區（user.timezone）。

const DAY_MS = 86_400_000;
/** 幾天內算「快到了」（含今天） */
export const SOON_DAYS = 3;

export type CountdownKind = 'exam' | 'deadline' | 'task';
export type CountdownTone = 'urgent' | 'soon' | 'normal' | 'past';

export type CountdownInfo = {
	tone: CountdownTone;
	/** 距離今天幾天（負數是已經過去） */
	days: number;
	/** 24 小時內而且有時間、還沒開始：還剩幾秒（即時倒數）；其他情況 null */
	secondsLeft: number | null;
	/** 單行版（清單裡的小倒數）：「今天」「明天」「3 天後」「已結束」 */
	text: string;
	/** 大磚的主要內容：天數（數字）或「今天」「明天」「已結束」；即時倒數時看 secondsLeft */
	value: number | string;
	/** 大磚下方的說明：「天後」「考試日」「已開始」「後開始」「09:10」…；沒有時 null */
	label: string | null;
};

/** 語氣只看種類與距離今天幾天 */
export function countdownTone(kind: CountdownKind, days: number): CountdownTone {
	if (days < 0) return 'past';
	if (days > SOON_DAYS) return 'normal';
	return kind === 'exam' ? 'urgent' : 'soon';
}

const DAY_LABEL: Record<CountdownKind, string> = { exam: '考試日', deadline: '截止日', task: '到期日' };
const TOMORROW_LABEL: Record<CountdownKind, string> = { exam: '考試', deadline: '截止', task: '到期' };

/**
 * 倒數的狀態與文案。
 * - item.time：有時間的考試、截止日（HH:mm，依 timeZone）；沒有時間的只看日期。
 * - now：現在（毫秒），只用來判斷即時倒數與「已開始」。
 */
export function countdown(
	item: { kind: CountdownKind; date: string; time?: string | null },
	today: string,
	now: number,
	timeZone: string,
): CountdownInfo {
	const days = diffDays(today, item.date);
	const tone = countdownTone(item.kind, days);
	const start = eventStartMs(item.date, item.time, timeZone);
	const left = start === null ? null : start - now;
	const exam = item.kind === 'exam';

	if (days < 0) return { tone, days, secondsLeft: null, text: '已結束', value: '已結束', label: null };
	const text = days === 0 ? '今天' : days === 1 ? '明天' : `${days} 天後`;
	if (left !== null && left > 0 && left < DAY_MS)
		return { tone, days, secondsLeft: Math.floor(left / 1000), text, value: text, label: exam ? '後開始' : '後截止' };
	if (days === 0) {
		const started = left !== null && left <= 0;
		return { tone, days, secondsLeft: null, text, value: '今天', label: started ? (exam ? '已開始' : '已截止') : DAY_LABEL[item.kind] };
	}
	if (days === 1) return { tone, days, secondsLeft: null, text, value: '明天', label: item.time ?? TOMORROW_LABEL[item.kind] };
	return { tone, days, secondsLeft: null, text, value: days, label: '天後' };
}
