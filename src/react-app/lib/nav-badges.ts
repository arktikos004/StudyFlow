import type { SummaryResponse } from '../../shared/api-types';

// 導覽的數量標籤：由頁首摘要（GET /api/summary）算出，純函式，test/nav-badges.spec.ts 直接測。

export type NavBadge = {
	count: number;
	/** danger：有逾期（現在就要處理）；warning：今天到期、待複習（DESIGN.md §2 的語意色） */
	tone: 'danger' | 'warning';
	/** 接在項目名稱後面給螢幕報讀器的說明，例如「，3 項待處理，其中 1 項逾期」 */
	srText: string;
};

/** 畫面上的數字：超過 99 顯示 99+ */
export const badgeLabel = (n: number) => (n > 99 ? '99+' : String(n));

/**
 * 導覽項目（nav.ts 的 to）→ 數量標籤；0 時不顯示（不在回傳結果裡）。
 * - 學習任務：逾期＋今天到期。
 * - 筆記與錯題：待複習（還沒掌握、複習日在今天以前）。
 */
export function navBadges(
	summary: Pick<SummaryResponse, 'overdueCount' | 'dueTodayCount' | 'reviewDueCount'> | undefined,
): Record<string, NavBadge> {
	const out: Record<string, NavBadge> = {};
	if (!summary) return out;
	const overdue = Math.max(0, summary.overdueCount);
	const tasks = overdue + Math.max(0, summary.dueTodayCount);
	if (tasks > 0)
		out['/tasks'] = {
			count: tasks,
			tone: overdue > 0 ? 'danger' : 'warning',
			srText: `，${tasks} 項待處理${overdue > 0 ? `，其中 ${overdue} 項逾期` : ''}`,
		};
	const review = Math.max(0, summary.reviewDueCount);
	if (review > 0) out['/notes'] = { count: review, tone: 'warning', srText: `，${review} 項待複習` };
	return out;
}
