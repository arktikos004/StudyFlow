import { describe, expect, it } from 'vitest';
import { localDate } from '../src/shared/dates';
import {
	advance,
	clampOptions,
	defaultState,
	describeEvents,
	LATE_MS,
	normalizeState,
	optionError,
	roundInfo,
	targetMs,
	type TimerState,
} from '../src/react-app/lib/timer-core';

const TZ = 'Asia/Taipei';
const dayOf = (ms: number) => localDate(ms, TZ);
const MIN = 60_000;
// 2026-09-29 10:00 台北
const T0 = Date.UTC(2026, 8, 29, 2, 0);
const TODAY = dayOf(T0);

/** 從 at 開始專注的番茄鐘狀態 */
function focusing(at: number, patch: Partial<TimerState> = {}): TimerState {
	return {
		...defaultState(TODAY),
		phase: 'focus',
		running: true,
		segmentStart: at,
		sessionStartedAt: at,
		subjectId: 'subject-1',
		taskId: 'task-1',
		...patch,
	};
}

describe('番茄鐘到點切換（advance）', () => {
	it('專注到點：記錄這一輪（起訖是真正到點的時刻），進入短休息', () => {
		const s = focusing(T0);
		const now = T0 + 25 * MIN + 400; // tick 晚了 0.4 秒
		const { state, records, events } = advance(s, now, dayOf);
		expect(records).toEqual([
			{ mode: 'pomodoro', startedAt: T0, endedAt: T0 + 25 * MIN, durationSec: 25 * 60, subjectId: 'subject-1', taskId: 'task-1' },
		]);
		expect(state).toMatchObject({
			phase: 'break',
			breakKind: 'short',
			running: true,
			segmentStart: T0 + 25 * MIN,
			cycles: 1,
			cyclesDate: TODAY,
		});
		expect(events).toEqual([{ type: 'focus-done', at: T0 + 25 * MIN, count: 1, breakKind: 'short', autoStarted: true }]);
		expect(targetMs(state)).toBe(5 * MIN);
	});

	it('還沒到點、暫停中、碼錶、閒置都不會切換', () => {
		expect(advance(focusing(T0), T0 + 25 * MIN - 1, dayOf).events).toEqual([]);
		const paused = focusing(T0, { running: false, segmentStart: null, accumulatedMs: 24 * MIN });
		expect(advance(paused, T0 + 10 * 3_600_000, dayOf).events).toEqual([]);
		expect(advance(focusing(T0, { mode: 'stopwatch' }), T0 + 5 * 3_600_000, dayOf).events).toEqual([]);
		expect(advance(defaultState(TODAY), T0, dayOf).events).toEqual([]);
	});

	it('當天第 N、2N 個番茄完成後進入長休息，長度用 longBreakMin', () => {
		const kinds: string[] = [];
		let s = focusing(T0, { longBreakEvery: 3, longBreakMin: 20 });
		let now = T0;
		for (let i = 0; i < 7; i++) {
			now = (s.segmentStart ?? now) + 25 * MIN;
			const r = advance(s, now, dayOf);
			kinds.push(r.state.breakKind);
			expect(r.state.cycles).toBe(i + 1);
			expect(targetMs(r.state)).toBe((r.state.breakKind === 'long' ? 20 : 5) * MIN);
			// 休息完直接開始下一輪
			s = { ...r.state, phase: 'focus', breakKind: 'short', running: true, segmentStart: now + 30 * MIN, sessionStartedAt: now + 30 * MIN };
		}
		expect(kinds).toEqual(['short', 'short', 'long', 'short', 'short', 'long', 'short']);
	});

	it('輪數跨日歸零：前一天完成 3 個，今天的第一個仍是短休息', () => {
		const yesterday = dayOf(T0 - 86_400_000);
		const s = focusing(T0, { cycles: 3, cyclesDate: yesterday });
		const { state, events } = advance(s, T0 + 25 * MIN, dayOf);
		expect(state).toMatchObject({ cycles: 1, cyclesDate: TODAY, breakKind: 'short' });
		expect(events[0]).toMatchObject({ count: 1 });
	});

	it('跨日依使用者時區：台北 23:50 開始的番茄在隔天 00:15 完成，算隔天的第 1 個', () => {
		const lateNight = Date.UTC(2026, 8, 29, 15, 50); // 台北 9/29 23:50
		const s = focusing(lateNight, { cycles: 5, cyclesDate: dayOf(lateNight) });
		const { state } = advance(s, lateNight + 25 * MIN, dayOf);
		expect(state.cyclesDate).toBe('2026-09-30');
		expect(state.cycles).toBe(1);
	});

	it('關閉自動開始休息：到點後停在「準備休息」，不論過多久都不會自己開始', () => {
		const s = focusing(T0, { autoStartBreak: false });
		const { state, events } = advance(s, T0 + 25 * MIN, dayOf);
		expect(state).toMatchObject({ phase: 'break', running: false, segmentStart: null, accumulatedMs: 0 });
		expect(events).toEqual([{ type: 'focus-done', at: T0 + 25 * MIN, count: 1, breakKind: 'short', autoStarted: false }]);
		expect(advance(state, T0 + 10 * 3_600_000, dayOf).events).toEqual([]);
	});

	it('休息結束後自動專注：從休息結束的時刻開始下一輪', () => {
		const breakStart = T0;
		const s: TimerState = {
			...focusing(T0),
			phase: 'break',
			segmentStart: breakStart,
			sessionStartedAt: null,
			autoStartFocus: true,
			cycles: 1,
		};
		const end = breakStart + 5 * MIN;
		const { state, records, events } = advance(s, end + 30_000, dayOf);
		expect(records).toEqual([]);
		expect(state).toMatchObject({ phase: 'focus', running: true, segmentStart: end, sessionStartedAt: end, breakKind: 'short' });
		expect(events).toEqual([{ type: 'break-done', at: end, breakKind: 'short', autoStarted: true, late: false }]);
	});

	it('關閉自動專注：休息到點就停下（回到閒置）', () => {
		const s: TimerState = { ...focusing(T0), phase: 'break', segmentStart: T0, sessionStartedAt: null, cycles: 1 };
		const { state, events } = advance(s, T0 + 5 * MIN, dayOf);
		expect(state).toMatchObject({ phase: 'idle', running: false, segmentStart: null, accumulatedMs: 0 });
		expect(events).toEqual([{ type: 'break-done', at: T0 + 5 * MIN, breakKind: 'short', autoStarted: false, late: false }]);
	});

	it('延遲超過 1 分鐘才偵測到休息結束：不自動開始下一輪（剛好 1 分鐘仍會開始）', () => {
		const s: TimerState = { ...focusing(T0), phase: 'break', segmentStart: T0, sessionStartedAt: null, autoStartFocus: true, cycles: 1 };
		const end = T0 + 5 * MIN;
		expect(advance(s, end + LATE_MS, dayOf).state.phase).toBe('focus');
		const late = advance(s, end + LATE_MS + 1, dayOf);
		expect(late.state.phase).toBe('idle');
		expect(late.records).toEqual([]);
		expect(late.events).toEqual([{ type: 'break-done', at: end, breakKind: 'short', autoStarted: false, late: true }]);
	});

	it('電腦睡了 3 小時：只記錄睡著前已經在跑的那一輪，絕不補記不在時的番茄', () => {
		const s = focusing(T0, { autoStartBreak: true, autoStartFocus: true });
		const { state, records, events } = advance(s, T0 + 3 * 3_600_000, dayOf);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ startedAt: T0, endedAt: T0 + 25 * MIN });
		expect(state).toMatchObject({ phase: 'idle', running: false, cycles: 1 });
		expect(events.map((e) => e.type)).toEqual(['focus-done', 'break-done']);
		expect(events[1]).toMatchObject({ late: true, autoStarted: false });
		// 醒來後再 tick 也不會多出紀錄
		expect(advance(state, T0 + 3 * 3_600_000 + 1000, dayOf).records).toEqual([]);
	});

	it('休息中電腦睡著、醒來時休息剛結束不到 1 分鐘：照常自動開始', () => {
		const s = focusing(T0, { autoStartFocus: true });
		const breakEnd = T0 + 30 * MIN;
		const { state, records } = advance(s, breakEnd + 20_000, dayOf);
		expect(records).toHaveLength(1);
		expect(state).toMatchObject({ phase: 'focus', running: true, segmentStart: breakEnd, sessionStartedAt: breakEnd });
	});

	it('長休息結束後回到閒置，breakKind 重設為 short', () => {
		const s: TimerState = { ...focusing(T0), phase: 'break', breakKind: 'long', segmentStart: T0, sessionStartedAt: null, cycles: 4 };
		expect(advance(s, T0 + 14 * MIN, dayOf).events).toEqual([]);
		const { state, events } = advance(s, T0 + 15 * MIN, dayOf);
		expect(state).toMatchObject({ phase: 'idle', breakKind: 'short' });
		expect(events[0]).toMatchObject({ breakKind: 'long' });
	});
});

describe('舊版 localStorage 狀態（normalizeState）', () => {
	it('Sprint 1 的狀態缺少新欄位：用預設值補上，原本的欄位保留', () => {
		const old = {
			mode: 'pomodoro',
			phase: 'focus',
			running: true,
			segmentStart: T0,
			accumulatedMs: 0,
			sessionStartedAt: T0,
			subjectId: 'subject-1',
			taskId: null,
			focusMin: 50,
			breakMin: 10,
			cycles: 2,
			cyclesDate: new Date(2026, 8, 29).toDateString(),
		};
		expect(normalizeState(old, TODAY)).toEqual({
			...old,
			longBreakMin: 15,
			longBreakEvery: 4,
			autoStartBreak: true,
			autoStartFocus: false,
			breakKind: 'short',
			cyclesDate: '2026-09-29',
		});
	});

	it('壞掉或超出範圍的值換成預設值或夾進範圍', () => {
		expect(normalizeState(null, TODAY)).toEqual(defaultState(TODAY));
		expect(normalizeState('oops', TODAY)).toEqual(defaultState(TODAY));
		const s = normalizeState(
			{
				mode: 'x',
				phase: 'nope',
				running: true,
				focusMin: 999,
				breakMin: 0,
				longBreakMin: 'a',
				longBreakEvery: 1.4,
				accumulatedMs: -5,
				breakKind: 'long',
			},
			TODAY,
		);
		expect(s).toMatchObject({
			mode: 'pomodoro',
			phase: 'idle',
			running: false,
			focusMin: 180,
			breakMin: 1,
			longBreakMin: 15,
			longBreakEvery: 2,
		});
		expect(s.accumulatedMs).toBe(0);
		expect(s.breakKind).toBe('short');
	});

	it('clampOptions 只夾數字設定，其他欄位不動', () => {
		expect(clampOptions({ focusMin: 0, longBreakMin: 90, subjectId: 'x' })).toEqual({ focusMin: 1, longBreakMin: 60, subjectId: 'x' });
	});
});

describe('第 k／N 輪（roundInfo）', () => {
	it('閒置與專注顯示正在進行的那一輪；休息顯示剛完成的那一輪', () => {
		const idle = { ...defaultState(TODAY), cycles: 5, longBreakEvery: 4 };
		expect(roundInfo(idle, TODAY)).toEqual({ done: 5, round: 2, of: 4, filled: 1 });
		const longBreak: TimerState = { ...idle, phase: 'break', breakKind: 'long', running: true, cycles: 8 };
		expect(roundInfo(longBreak, TODAY)).toEqual({ done: 8, round: 4, of: 4, filled: 4 });
	});

	it('跨日歸零，但跨午夜的休息仍算前一天那一輪', () => {
		const yesterday = dayOf(T0 - 86_400_000);
		expect(roundInfo({ ...defaultState(yesterday), cycles: 3 }, TODAY)).toEqual({ done: 0, round: 1, of: 4, filled: 0 });
		const breakOverMidnight: TimerState = { ...defaultState(yesterday), phase: 'break', running: true, cycles: 3 };
		expect(roundInfo(breakOverMidnight, TODAY)).toMatchObject({ done: 0, round: 3, filled: 3 });
	});
});

describe('設定檢查與通知文字', () => {
	it('optionError：範圍外、非整數、空白都有 zh-TW 錯誤', () => {
		expect(optionError('focusMin', '25')).toBeNull();
		expect(optionError('focusMin', '181')).toBe('專注時間要介於 1–180 分鐘，請重新輸入');
		expect(optionError('breakMin', '0')).toBe('短休息要介於 1–60 分鐘，請重新輸入');
		expect(optionError('longBreakMin', '4')).toBe('長休息要介於 5–60 分鐘，請重新輸入');
		expect(optionError('longBreakEvery', '9')).toBe('長休息間隔要介於 2–8 輪，請重新輸入');
		expect(optionError('focusMin', '2.5')).toBe('專注時間請輸入整數分鐘數');
		expect(optionError('longBreakEvery', '')).toBe('請輸入長休息間隔（2–8 輪）');
	});

	it('describeEvents：一次發生好幾件事時合併成一則', () => {
		const s = defaultState(TODAY);
		expect(describeEvents([], s)).toBeNull();
		expect(describeEvents([{ type: 'focus-done', at: T0, count: 4, breakKind: 'long', autoStarted: true }], s)).toEqual({
			title: '完成第 4 個番茄',
			body: '開始長休息 15 分鐘',
		});
		expect(
			describeEvents(
				[
					{ type: 'focus-done', at: T0, count: 1, breakKind: 'short', autoStarted: true },
					{ type: 'break-done', at: T0, breakKind: 'short', autoStarted: false, late: true },
				],
				{ ...s, autoStartFocus: true },
			),
		).toEqual({ title: '完成第 1 個番茄', body: '休息時間也結束了，準備好就開始下一輪' });
		expect(
			describeEvents([{ type: 'break-done', at: T0, breakKind: 'short', autoStarted: false, late: true }], { ...s, autoStartFocus: true }),
		).toEqual({
			title: '休息結束',
			body: '離開超過 1 分鐘，這次沒有自動開始下一輪',
		});
	});
});
