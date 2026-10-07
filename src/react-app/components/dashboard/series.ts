import { NO_SUBJECT_KEY, type Subject } from '../../../shared/api-types';

// 統計頁每日堆疊圖的系列（DESIGN.md §3「堆疊圖：超過 8 個科目時，多的併入其他」、dataviz 的 8 色上限）。
// 純函式，不依賴 React 或瀏覽器：test/stats-series.spec.ts 直接測試。

export const OTHER_KEY = '__other';
/** 圖上最多幾種顏色（系列數，含「未分類」與「其他」） */
export const MAX_STACK_SERIES = 8;

/** 和 charts.tsx 的 SeriesDef 同形狀（這裡不 import charts.tsx，保持純函式、測試環境也能用） */
export type StackSeries = { key: string; label: string; color: string };
export type DailyMinutes = { date: string; minutes: number; bySubject: Record<string, number> };

/**
 * 區間內有學習時間的系列，依科目順序排列；顏色跟著科目走，不因排名或篩選改變。
 * 科目清單裡找不到的 id 顯示成「已刪除的科目」，「未分類」排在最後。
 */
export function buildSeries(
	used: Iterable<string>,
	subjects: readonly Pick<Subject, 'id' | 'name' | 'color'>[],
	colorOf: (hex: string | null | undefined) => string,
): StackSeries[] {
	const keys = new Set(used);
	const known = subjects.filter((s) => keys.has(s.id)).map((s) => ({ key: s.id, label: s.name, color: colorOf(s.color) }));
	const knownIds = new Set(known.map((s) => s.key));
	const unknown = [...keys]
		.filter((k) => k !== NO_SUBJECT_KEY && !knownIds.has(k))
		.map((k) => ({ key: k, label: '已刪除的科目', color: colorOf(null) }));
	const none = keys.has(NO_SUBJECT_KEY) ? [{ key: NO_SUBJECT_KEY, label: '未分類', color: colorOf(null) }] : [];
	return [...known, ...unknown, ...none];
}

/**
 * 系列（科目加上有分鐘數的「未分類」）超過 8 個時：依區間的分鐘數取前 7 個科目（同分時照科目順序），
 * 其餘科目與「未分類」一起併入「其他」，所以圖上最多 8 種顏色。
 * 留下來的科目維持原本的順序與顏色，「其他」用中性色、疊在最上面。
 * 回傳圖表用的系列與每日資料，以及併入「其他」的系列（給圖例說明用）；表格檢視請用原本完整的資料。
 */
export function foldSeries(
	series: readonly StackSeries[],
	totals: ReadonlyMap<string, number>,
	daily: readonly DailyMinutes[],
	otherColor: string,
): { series: StackSeries[]; daily: DailyMinutes[]; others: StackSeries[] } {
	if (series.length <= MAX_STACK_SERIES) return { series: [...series], daily: [...daily], others: [] };

	const keep = new Set(
		series
			.filter((s) => s.key !== NO_SUBJECT_KEY)
			.map((s, i) => ({ key: s.key, i, minutes: totals.get(s.key) ?? 0 }))
			.sort((a, b) => b.minutes - a.minutes || a.i - b.i)
			.slice(0, MAX_STACK_SERIES - 1)
			.map((s) => s.key),
	);
	const others = series.filter((s) => !keep.has(s.key));
	const folded = daily.map((d) => {
		const bySubject: Record<string, number> = {};
		let other = 0;
		for (const [k, v] of Object.entries(d.bySubject)) {
			if (keep.has(k)) bySubject[k] = v;
			else other += v;
		}
		if (other > 0) bySubject[OTHER_KEY] = Math.round(other * 10) / 10;
		return { ...d, bySubject };
	});
	return {
		series: [...series.filter((s) => keep.has(s.key)), { key: OTHER_KEY, label: '其他', color: otherColor }],
		daily: folded,
		others,
	};
}
