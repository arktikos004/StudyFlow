import { describe, expect, it } from 'vitest';
import { dueInfo, formatTaskTime, spentOf } from '../src/react-app/lib/task-format';
import type { Task, TaskItem } from '../src/shared/api-types';

describe('已投入／預估時間（TSK-4）', () => {
	it('「已投入 45 分／預估 60 分」：兩者都不到 2 小時時都用「分」', () => {
		expect(formatTaskTime(45, 60)).toEqual({ text: '已投入 45 分／預估 60 分', spentText: '已投入 45 分', over: 0, overText: null });
		expect(formatTaskTime(44.6, 60).text).toBe('已投入 45 分／預估 60 分');
		expect(formatTaskTime(90, 100).text).toBe('已投入 90 分／預估 100 分');
	});

	it('只有其中一個時只顯示那一個；都沒有時是 null', () => {
		expect(formatTaskTime(0, 60).text).toBe('預估 60 分');
		expect(formatTaskTime(0, 60).spentText).toBeNull();
		expect(formatTaskTime(30, null).text).toBe('已投入 30 分');
		expect(formatTaskTime(0, null).text).toBeNull();
		expect(formatTaskTime(0, undefined).text).toBeNull();
		// 有投入但不到 1 分鐘
		expect(formatTaskTime(0.3, 25).text).toBe('已投入 不到 1 分／預估 25 分');
	});

	it('較大的一個達 2 小時，兩個都改用「小時 分」', () => {
		expect(formatTaskTime(45, 120).text).toBe('已投入 45 分／預估 2 小時');
		expect(formatTaskTime(150, 90).text).toBe('已投入 2 小時 30 分／預估 1 小時 30 分');
	});

	it('超過預估時回傳超過的量，用來顯示警示', () => {
		expect(formatTaskTime(75, 60)).toEqual({ text: '已投入 75 分／預估 60 分', spentText: '已投入 75 分', over: 15, overText: '15 分' });
		expect(formatTaskTime(60, 60).over).toBe(0);
		// 四捨五入後才比較：60.4 分不算超過
		expect(formatTaskTime(60.4, 60).over).toBe(0);
		expect(formatTaskTime(300, 60).overText).toBe('4 小時');
		expect(formatTaskTime(75, null).over).toBe(0);
	});

	it('spentOf：TaskItem 取 spentMinutes，沒有這個欄位的 Task 當成 0', () => {
		expect(spentOf({ spentMinutes: 12.5 } as TaskItem)).toBe(12.5);
		expect(spentOf({} as Task)).toBe(0);
	});
});

describe('期限', () => {
	const TODAY = '2026-10-06';
	it('未完成：逾期幾天、今天到期、明天到期；其他日期由呼叫端顯示日期', () => {
		expect(dueInfo('2026-10-04', TODAY, false)).toEqual({ kind: 'overdue', days: 2, label: '逾期 2 天' });
		expect(dueInfo(TODAY, TODAY, false)).toEqual({ kind: 'today', label: '今天到期' });
		expect(dueInfo('2026-10-07', TODAY, false)).toEqual({ kind: 'tomorrow', label: '明天到期' });
		expect(dueInfo('2026-10-20', TODAY, false).kind).toBe('later');
	});

	it('已完成的任務不算逾期或今天到期', () => {
		expect(dueInfo('2026-10-04', TODAY, true).kind).toBe('later');
		expect(dueInfo(TODAY, TODAY, true).kind).toBe('later');
	});

	it('跨月、跨年也算得對', () => {
		expect(dueInfo('2026-09-30', '2026-10-01', false)).toMatchObject({ kind: 'overdue', days: 1 });
		expect(dueInfo('2027-01-01', '2026-12-31', false).kind).toBe('tomorrow');
	});
});
