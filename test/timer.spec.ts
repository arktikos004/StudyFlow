import { describe, expect, it } from 'vitest';
import { localDate } from '../src/shared/dates';
import {
	advance,
	clampOptions,
	defaultState,
	describeEvents,
	isDuplicate,
	LATE_MS,
	normalizeState,
	optionError,
	queueAction,
	roundInfo,
	sendRecord,
	targetMs,
	type QueuedRecord,
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

/** 和 ApiError 一樣帶 status 的錯誤 */
const apiError = (status: number, message = '請求失敗') => Object.assign(new Error(message), { status });

/** 假的 post：依序丟出 errors 裡的錯誤（undefined 代表成功），並記下每次送出的內容 */
function fakePost(...results: (Error | undefined)[]) {
	const sent: QueuedRecord[] = [];
	return {
		sent,
		post: async (r: QueuedRecord) => {
			sent.push(r);
			const e = results.shift();
			if (e) throw e;
		},
	};
}

describe('補送佇列：送不出去時不會靜默丟掉（sendRecord）', () => {
	const record: QueuedRecord = { mode: 'pomodoro', startedAt: T0, endedAt: T0 + 25 * MIN, subjectId: 'subject-1', taskId: 'task-1' };
	const none = async () => [];

	it('計時途中科目被刪除（400）：改成不掛科目再送一次，成功就算記錄', async () => {
		const f = fakePost(apiError(400, '找不到此科目'), undefined);
		const r = await sendRecord(record, { existing: none, post: f.post });
		expect(r).toEqual({ kind: 'saved', record: { ...record, subjectId: null, taskId: null }, unlinked: true });
		expect(f.sent.map((x) => x.subjectId)).toEqual(['subject-1', null]);
	});

	it('不掛科目重試時離線（0）或未登入（401）：留在佇列', async () => {
		for (const status of [0, 401]) {
			const f = fakePost(apiError(400), apiError(status));
			expect(await sendRecord(record, { existing: none, post: f.post })).toEqual({ kind: 'keep' });
		}
	});

	it('確定無效的 400（不掛科目也被拒絕）才移除，並帶出原因', async () => {
		const f = fakePost(apiError(400), apiError(400, '單次學習不可超過 24 小時'));
		expect(await sendRecord(record, { existing: none, post: f.post })).toEqual({ kind: 'dropped', reason: '單次學習不可超過 24 小時' });
		const bare = fakePost(apiError(400, '結束時間必須晚於開始時間'));
		expect(await sendRecord({ ...record, subjectId: null, taskId: null }, { existing: none, post: bare.post })).toEqual({
			kind: 'dropped',
			reason: '結束時間必須晚於開始時間',
		});
		expect(bare.sent).toHaveLength(1);
	});

	it('伺服器錯誤（500）、未登入（401）、不明錯誤：留在佇列，不會丟掉', async () => {
		for (const e of [apiError(500), apiError(401), new Error('不明')]) {
			const f = fakePost(e);
			expect(await sendRecord(record, { existing: none, post: f.post })).toEqual({ kind: 'keep' });
			expect(f.sent).toHaveLength(1);
		}
	});

	it('queueAction：只有 400 會改送或移除', () => {
		expect(queueAction(400, record)).toBe('unlink');
		expect(queueAction(400, { ...record, subjectId: null, taskId: null })).toBe('drop');
		for (const status of [0, 401, 403, 404, 429, 500, 503, undefined]) expect(queueAction(status, record)).toBe('keep');
	});
});

describe('補送去重：上次已經送出成功的不再送一次', () => {
	const record: QueuedRecord = { mode: 'pomodoro', startedAt: T0, endedAt: T0 + 25 * MIN, subjectId: null, taskId: null };
	const onServer = (r: QueuedRecord) => [
		{ mode: 'manual', startedAt: T0 - 60 * MIN, endedAt: T0 - 30 * MIN },
		{ mode: r.mode, startedAt: r.startedAt, endedAt: r.endedAt },
	];

	it('模式與起訖時間完全相同：跳過，不會送出', async () => {
		expect(isDuplicate(record, onServer(record))).toBe(true);
		const f = fakePost();
		expect(await sendRecord(record, { existing: async (r) => onServer(r), post: f.post })).toEqual({ kind: 'duplicate' });
		expect(f.sent).toEqual([]);
	});

	it('起訖差 1 毫秒（或模式不同）：不算重複，照常送出', async () => {
		const later = { ...record, endedAt: record.endedAt + 1 };
		expect(isDuplicate(later, onServer(record))).toBe(false);
		expect(isDuplicate({ ...record, startedAt: record.startedAt - 1 }, onServer(record))).toBe(false);
		expect(isDuplicate({ ...record, mode: 'stopwatch' }, onServer(record))).toBe(false);
		const f = fakePost(undefined);
		expect(await sendRecord(later, { existing: async () => onServer(record), post: f.post })).toEqual({
			kind: 'saved',
			record: later,
			unlinked: false,
		});
		expect(f.sent).toEqual([later]);
	});

	it('離線：查詢或送出時是 status 0，都留在佇列', async () => {
		const offline = async (): Promise<never> => {
			throw apiError(0, '目前離線，請確認網路連線');
		};
		const f = fakePost();
		expect(await sendRecord(record, { existing: offline, post: f.post })).toEqual({ kind: 'keep' });
		expect(f.sent).toEqual([]);
		const g = fakePost(apiError(0));
		expect(await sendRecord(record, { existing: async () => [], post: g.post })).toEqual({ kind: 'keep' });
	});

	it('查詢失敗但不是離線（例如 500）：不擋住，照常送出（後端仍會檢查）', async () => {
		const f = fakePost(undefined);
		const r = await sendRecord(record, {
			existing: async () => {
				throw apiError(500);
			},
			post: f.post,
		});
		expect(r.kind).toBe('saved');
		expect(f.sent).toHaveLength(1);
	});
});
