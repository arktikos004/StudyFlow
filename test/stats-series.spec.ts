import { describe, expect, it } from 'vitest';
import { NO_SUBJECT_KEY } from '../src/shared/api-types';
import {
	buildSeries,
	foldSeries,
	MAX_STACK_SERIES,
	OTHER_KEY,
	type DailyMinutes,
	type StackSeries,
} from '../src/react-app/components/dashboard/series';

// 統計頁每日堆疊圖的系列：顏色跟著科目走、圖上最多 8 種顏色（「未分類」也算一個系列）

const color = (hex: string | null | undefined) => (hex ? `mark(${hex})` : 'gray');
const subject = (i: number) => ({ id: `s${i}`, name: `科目${i}`, color: `#00000${i}` });
const subjects = (n: number) => Array.from({ length: n }, (_, i) => subject(i + 1));

/** n 個科目的系列（依科目順序），可選擇加上「未分類」 */
function makeSeries(n: number, withNone = false): StackSeries[] {
	const keys = subjects(n).map((s) => s.id);
	return buildSeries(withNone ? [...keys, NO_SUBJECT_KEY] : keys, subjects(n), color);
}

const totalsOf = (entries: [string, number][]) => new Map(entries);

describe('buildSeries', () => {
	it('依科目順序排列、未分類在最後，找不到的科目顯示成「已刪除的科目」', () => {
		const s = buildSeries([NO_SUBJECT_KEY, 's2', 'gone', 's1'], subjects(3), color);
		expect(s.map((x) => x.label)).toEqual(['科目1', '科目2', '已刪除的科目', '未分類']);
		expect(s[0].color).toBe('mark(#000001)');
		expect(s[2].color).toBe('gray');
		expect(s[3]).toEqual({ key: NO_SUBJECT_KEY, label: '未分類', color: 'gray' });
	});

	it('只列出區間內有學習時間的科目', () => {
		expect(buildSeries(['s3'], subjects(5), color).map((x) => x.key)).toEqual(['s3']);
	});
});

describe('foldSeries', () => {
	const day: DailyMinutes = { date: '2026-09-30', minutes: 0, bySubject: {} };

	it('8 個科目、沒有未分類：不併入', () => {
		const series = makeSeries(8);
		const r = foldSeries(series, totalsOf([]), [day], 'rest');
		expect(r.series).toEqual(series);
		expect(r.others).toEqual([]);
	});

	it('7 個科目加上未分類剛好 8 個系列：不併入，未分類保留', () => {
		const series = makeSeries(7, true);
		const r = foldSeries(series, totalsOf([]), [day], 'rest');
		expect(r.series).toHaveLength(MAX_STACK_SERIES);
		expect(r.series.at(-1)?.key).toBe(NO_SUBJECT_KEY);
		expect(r.others).toEqual([]);
	});

	it('8 個科目加上未分類（9 個系列）：取前 7 科，第 8 科與未分類併入「其他」', () => {
		const series = makeSeries(8, true);
		// s8 分鐘數最少；未分類分鐘數最多也一樣併入「其他」
		const totals = totalsOf([
			['s1', 70],
			['s2', 60],
			['s3', 50],
			['s4', 40],
			['s5', 30],
			['s6', 20],
			['s7', 10],
			['s8', 5],
			[NO_SUBJECT_KEY, 500],
		]);
		const daily: DailyMinutes[] = [
			{ date: '2026-09-29', minutes: 35.5, bySubject: { s1: 20, s8: 5.2, [NO_SUBJECT_KEY]: 10.3 } },
			{ date: '2026-09-30', minutes: 12, bySubject: { s2: 12 } },
		];
		const r = foldSeries(series, totals, daily, 'rest');

		expect(r.series).toHaveLength(MAX_STACK_SERIES);
		expect(r.series.map((s) => s.key)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', OTHER_KEY]);
		expect(r.series.at(-1)).toEqual({ key: OTHER_KEY, label: '其他', color: 'rest' });
		expect(r.others.map((s) => s.label)).toEqual(['科目8', '未分類']);
		// 每天的「其他」＝併入的科目與未分類加總；沒有的那天不出現「其他」
		expect(r.daily[0].bySubject).toEqual({ s1: 20, [OTHER_KEY]: 15.5 });
		expect(r.daily[0].minutes).toBe(35.5);
		expect(r.daily[1].bySubject).toEqual({ s2: 12 });
		// 不改動傳入的資料（表格檢視用完整資料）
		expect(daily[0].bySubject).toEqual({ s1: 20, s8: 5.2, [NO_SUBJECT_KEY]: 10.3 });
	});

	it('留下來的科目維持科目順序與顏色，不依排名重排', () => {
		const series = makeSeries(9);
		const totals = totalsOf([
			['s9', 900],
			['s1', 1],
			['s5', 500],
			['s2', 200],
			['s3', 300],
			['s4', 400],
			['s6', 600],
			['s7', 0],
			['s8', 800],
		]);
		const r = foldSeries(series, totals, [day], 'rest');
		expect(r.series.map((s) => s.key)).toEqual(['s2', 's3', 's4', 's5', 's6', 's8', 's9', OTHER_KEY]);
		expect(r.series.find((s) => s.key === 's9')?.color).toBe('mark(#000009)');
		expect(r.others.map((s) => s.key)).toEqual(['s1', 's7']);
	});

	it('分鐘數相同時照科目順序取前 7 科', () => {
		const series = makeSeries(9);
		const totals = totalsOf(series.map((s) => [s.key, 60] as [string, number]));
		const r = foldSeries(series, totals, [day], 'rest');
		expect(r.series.map((s) => s.key)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', OTHER_KEY]);
		expect(r.others.map((s) => s.key)).toEqual(['s8', 's9']);
	});
});
