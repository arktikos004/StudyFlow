import type { EventItem } from '../../shared/api-types';
import { diffDays } from '../../shared/dates';
import { eventStartMs } from './dashboard-format';

// 考試頁（s2/notes）的倒數磚與摘要。「今天」與考試時間都依使用者時區（user.timezone）。

const DAY_MS = 86_400_000;

/**
 * 倒數磚的語氣：
 * - urgent：3 天內（含今天）的考試，紅筆（DESIGN.md §1 第 5 條，紅色只給現在就要處理的事）
 * - today：今天截止的截止日，用 warning（今天到期）
 * - past：已經過去
 * - normal：其他
 */
export type CountdownTone = 'urgent' | 'today' | 'normal' | 'past';

export type CountdownState = {
	tone: CountdownTone;
	/** 距離今天幾天（負數是幾天前） */
	days: number;
	/** 24 小時內而且有時間：還剩幾秒（即時倒數）；其他情況 null */
	secondsLeft: number | null;
	/** 數字下面的說明，例如「天後」「後開始」「已開始」 */
	label: string;
};

export function countdownState(
	event: Pick<EventItem, 'kind' | 'date' | 'time'>,
	today: string,
	now: number,
	timeZone: string,
): CountdownState {
	const days = diffDays(today, event.date);
	const exam = event.kind === 'exam';
	const start = eventStartMs(event.date, event.time, timeZone);
	const left = start === null ? null : start - now;
	const tone: CountdownTone =
		days < 0 ? 'past' : exam && days <= 3 ? 'urgent' : !exam && days === 0 ? 'today' : 'normal';

	if (days < 0) return { tone, days, secondsLeft: null, label: '天前' };
	if (left !== null && left > 0 && left < DAY_MS) return { tone, days, secondsLeft: left / 1000, label: exam ? '後開始' : '後截止' };
	if (days === 0) {
		if (left !== null && left <= 0) return { tone, days, secondsLeft: null, label: exam ? '已開始' : '已截止' };
		return { tone, days, secondsLeft: null, label: exam ? '考試日' : '今天截止' };
	}
	return { tone, days, secondsLeft: null, label: '天後' };
}

/** 「在明天」「在 5 天後」：摘要裡的相對日期 */
function inDays(days: number): string {
	if (days <= 0) return '就在今天';
	if (days === 1) return '在明天';
	return `在 ${days} 天後`;
}

/** 頁首的即時摘要：接下來有幾場考試、幾個截止日，最近的考試在哪天 */
export function eventsSummary(upcoming: readonly Pick<EventItem, 'kind' | 'date'>[], today: string): string {
	const exams = upcoming.filter((e) => e.kind === 'exam');
	const deadlines = upcoming.length - exams.length;
	if (upcoming.length === 0) return '目前沒有排定的考試或截止日';
	const parts = [exams.length && `${exams.length} 場考試`, deadlines && `${deadlines} 個截止日`].filter(Boolean).join('、');
	const next = exams.reduce<string | null>((min, e) => (min === null || e.date < min ? e.date : min), null);
	return next === null ? `接下來有 ${parts}` : `接下來有 ${parts}，最近的考試${inDays(diffDays(today, next))}`;
}
