import type { EventItem } from '../../shared/api-types';
import { diffDays } from '../../shared/dates';

// 考試與截止日頁的文字。「今天」依使用者時區（user.timezone）。

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
