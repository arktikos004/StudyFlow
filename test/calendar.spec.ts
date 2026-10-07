import { describe, expect, it } from 'vitest';
import {
	layoutColumns,
	minutesByDate,
	monthGrid,
	moveDate,
	shiftMonthKeepDay,
	splitByDay,
	weekDays,
} from '../src/react-app/components/calendar/layout';
import { MINUTE_MS as MIN } from '../src/shared/time';

/** 台北時間（UTC+8，沒有夏令時間） */
const tpe = (date: string, hhmm: string) => {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = hhmm.split(':').map(Number);
	return Date.UTC(y, m - 1, d, hh - 8, mm);
};

describe('學習紀錄切成每天的時段（splitByDay）', () => {
	it('同一天：一段，分鐘數是使用者時區的牆上時間', () => {
		expect(splitByDay(tpe('2026-09-29', '09:00'), tpe('2026-09-29', '09:25'), 'Asia/Taipei')).toEqual([
			{ date: '2026-09-29', startMin: 540, endMin: 565, continuesFromPrev: false, continuesToNext: false },
		]);
	});

	it('跨午夜：分成兩段', () => {
		expect(splitByDay(tpe('2026-09-28', '23:30'), tpe('2026-09-29', '00:40'), 'Asia/Taipei')).toEqual([
			{ date: '2026-09-28', startMin: 1410, endMin: 1440, continuesFromPrev: false, continuesToNext: true },
			{ date: '2026-09-29', startMin: 0, endMin: 40, continuesFromPrev: true, continuesToNext: false },
		]);
	});

	it('剛好在午夜結束：不會多出長度 0 的一段', () => {
		expect(splitByDay(tpe('2026-09-28', '23:00'), tpe('2026-09-29', '00:00'), 'Asia/Taipei')).toEqual([
			{ date: '2026-09-28', startMin: 1380, endMin: 1440, continuesFromPrev: false, continuesToNext: false },
		]);
	});

	it('依使用者時區，不是裝置時區：同一段在紐約是前一天晚上', () => {
		const start = tpe('2026-09-29', '09:00'); // = 紐約 9/28 21:00（EDT）
		expect(splitByDay(start, start + 4 * 60 * MIN, 'America/New_York')).toEqual([
			{ date: '2026-09-28', startMin: 1260, endMin: 1440, continuesFromPrev: false, continuesToNext: true },
			{ date: '2026-09-29', startMin: 0, endMin: 60, continuesFromPrev: true, continuesToNext: false },
		]);
	});

	it('夏令時間結束那天（紐約 11/1）照牆上時間畫', () => {
		// 00:30 EDT 開始、3 小時後是 02:30 EST（牆上只過了 2 小時）
		const start = Date.UTC(2026, 10, 1, 4, 30);
		expect(splitByDay(start, start + 3 * 60 * MIN, 'America/New_York')).toEqual([
			{ date: '2026-11-01', startMin: 30, endMin: 150, continuesFromPrev: false, continuesToNext: false },
		]);
	});

	it('夏令時間結束那天，牆上時間的結束早於或等於開始：改用實際經過的分鐘數', () => {
		// 01:30 EDT（05:30Z）開始、1 小時後是 01:30 EST：牆上時間沒有前進
		const start = Date.UTC(2026, 10, 1, 5, 30);
		expect(splitByDay(start, start + 60 * MIN, 'America/New_York')).toEqual([
			{ date: '2026-11-01', startMin: 90, endMin: 150, continuesFromPrev: false, continuesToNext: false },
		]);
		// 01:50 EDT 開始、20 分鐘後是 01:10 EST：牆上時間倒退
		const later = Date.UTC(2026, 10, 1, 5, 50);
		expect(splitByDay(later, later + 20 * MIN, 'America/New_York')[0]).toMatchObject({ startMin: 110, endMin: 130 });
	});

	it('跨午夜進入夏令時間結束那天：仍然切成兩段', () => {
		const start = Date.UTC(2026, 10, 1, 3, 50); // 10/31 23:50 EDT
		const segs = splitByDay(start, start + 2 * 60 * MIN, 'America/New_York'); // 11/1 01:50 EDT（02:00 才撥回）
		expect(segs.map((s) => [s.date, s.startMin, s.endMin])).toEqual([
			['2026-10-31', 1430, 1440],
			['2026-11-01', 0, 110],
		]);
	});
});

describe('重疊時段的欄位（layoutColumns）', () => {
	it('不重疊：各自一欄', () => {
		const r = layoutColumns([
			{ id: 'a', startMin: 60, endMin: 120 },
			{ id: 'b', startMin: 120, endMin: 180 },
		]);
		expect(r.map((x) => [x.id, x.col, x.cols])).toEqual([
			['a', 0, 1],
			['b', 0, 1],
		]);
	});

	it('遞移重疊的一群平分寬度，空出來的欄會重複使用', () => {
		const r = layoutColumns([
			{ id: 'a', startMin: 0, endMin: 60 },
			{ id: 'b', startMin: 30, endMin: 90 },
			{ id: 'c', startMin: 60, endMin: 120 },
			{ id: 'd', startMin: 200, endMin: 210 },
		]);
		expect(r.map((x) => [x.id, x.col, x.cols])).toEqual([
			['a', 0, 2],
			['b', 1, 2],
			['c', 0, 2],
			['d', 0, 1],
		]);
	});

	it('太短的時段用畫出來的最小長度判斷重疊', () => {
		const items = [
			{ id: 'a', startMin: 600, endMin: 605 },
			{ id: 'b', startMin: 610, endMin: 640 },
		];
		expect(layoutColumns(items).every((x) => x.cols === 1)).toBe(true);
		expect(layoutColumns(items, 20).map((x) => [x.id, x.col, x.cols])).toEqual([
			['a', 0, 2],
			['b', 1, 2],
		]);
	});
});

describe('月格與鍵盤移動', () => {
	it('月格 42 天、從週一開始；週檢視是週一到週日', () => {
		const grid = monthGrid('2026-09');
		expect(grid).toHaveLength(42);
		expect(grid[0]).toBe('2026-08-31');
		expect(grid[41]).toBe('2026-10-11');
		expect(weekDays('2026-09-30')).toEqual([
			'2026-09-28',
			'2026-09-29',
			'2026-09-30',
			'2026-10-01',
			'2026-10-02',
			'2026-10-03',
			'2026-10-04',
		]);
	});

	it('方向鍵 ±1／±7 天、Home／End 到週一／週日、PageUp／PageDown 換月', () => {
		expect(moveDate('2026-09-30', 'ArrowRight')).toBe('2026-10-01');
		expect(moveDate('2026-09-30', 'ArrowUp')).toBe('2026-09-23');
		expect(moveDate('2026-09-30', 'Home')).toBe('2026-09-28');
		expect(moveDate('2026-09-30', 'End')).toBe('2026-10-04');
		expect(moveDate('2026-09-30', 'PageDown')).toBe('2026-10-30');
		expect(moveDate('2026-01-31', 'PageDown')).toBe('2026-02-28');
		expect(moveDate('2026-03-31', 'PageUp')).toBe('2026-02-28');
		expect(moveDate('2028-02-29', 'PageUp', true)).toBe('2027-02-28');
		expect(moveDate('2026-09-30', 'Enter')).toBeNull();
		expect(shiftMonthKeepDay('2026-12-15', 1)).toBe('2027-01-15');
	});

	it('每天的讀書分鐘數依開始時間的日期（和統計一致）', () => {
		const map = minutesByDate(
			[
				{ startedAt: tpe('2026-09-28', '23:30'), durationSec: 70 * 60 },
				{ startedAt: tpe('2026-09-29', '07:30'), durationSec: 30 * 60 },
			],
			'Asia/Taipei',
		);
		expect(Object.fromEntries(map)).toEqual({ '2026-09-28': 70, '2026-09-29': 30 });
	});
});
