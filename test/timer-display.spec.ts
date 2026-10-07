import { describe, expect, it } from 'vitest';
import { defaultState, timerReading, type TimerState } from '../src/react-app/lib/timer-core';
import { dialCaption, phaseLabel, progressText, statusText, timerStage, todaySummary } from '../src/react-app/lib/timer-display';
import { MINUTE_MS as MIN } from '../src/shared/time';

const TODAY = '2026-10-07';
const NOW = Date.UTC(2026, 9, 7, 4, 0);

/** 在 NOW 之前 minutes 分鐘開始、一直在跑的狀態；running: false 時改成累積了 minutes 分鐘後停下 */
function at(patch: Partial<TimerState>, minutes = 0): TimerState {
	const running = patch.running ?? patch.phase !== 'idle';
	return {
		...defaultState(TODAY),
		running,
		segmentStart: running ? NOW - minutes * MIN : null,
		accumulatedMs: running ? 0 : minutes * MIN,
		...patch,
	};
}

const idle = at({ phase: 'idle' });
const focusing = at({ phase: 'focus', cycles: 5, cyclesDate: TODAY }, 10);
const paused = at({ phase: 'focus', running: false }, 7);
const breakReady = at({ phase: 'break', running: false, breakKind: 'long', cycles: 4 });
const resting = at({ phase: 'break', breakKind: 'short', cycles: 1 }, 2.5);
const stopwatch = (patch: Partial<TimerState>, minutes?: number) => at({ mode: 'stopwatch', ...patch }, minutes);

describe('計時頁的階段（timerStage）', () => {
	it('休息不能暫停：沒在跑的休息是「準備休息」', () => {
		expect([idle, focusing, paused, breakReady, resting].map(timerStage)).toEqual(['idle', 'running', 'paused', 'break-ready', 'break']);
	});
});

describe('計時環中間的文字', () => {
	it('階段名稱：番茄鐘與碼錶的說法不同，暫停與休息相同', () => {
		expect(phaseLabel(idle)).toBe('準備專注');
		expect(phaseLabel(focusing)).toBe('專注中');
		expect(phaseLabel(paused)).toBe('已暫停');
		expect(phaseLabel(breakReady)).toBe('準備長休息');
		expect(phaseLabel(resting)).toBe('短休息');
		expect(phaseLabel(stopwatch({ phase: 'idle' }))).toBe('碼錶');
		expect(phaseLabel(stopwatch({ phase: 'focus' }, 3))).toBe('計時中');
	});

	it('數字下方：番茄鐘是這一輪的長度，碼錶說明環的意思', () => {
		expect(dialCaption(focusing)).toBe('專注 25 分鐘');
		expect(dialCaption(breakReady)).toBe('長休息 15 分鐘');
		expect(dialCaption(resting)).toBe('短休息 5 分鐘');
		expect(dialCaption(stopwatch({ phase: 'focus' }, 3))).toBe('每小時繞一圈');
	});
});

describe('報讀', () => {
	it('狀態：專注中報第幾輪，休息報剛完成專注與休息多久', () => {
		expect(statusText(idle, TODAY)).toBe('準備專注，25 分鐘');
		expect(statusText(focusing, TODAY)).toBe('專注中，第 2／4 輪，共 25 分鐘');
		expect(statusText(paused, TODAY)).toBe('已暫停');
		expect(statusText(breakReady, TODAY)).toBe('專注完成，準備長休息 15 分鐘');
		expect(statusText(resting, TODAY)).toBe('專注完成，短休息 5 分鐘');
		expect(statusText(stopwatch({ phase: 'idle' }), TODAY)).toBe('碼錶已停止');
		expect(statusText(stopwatch({ phase: 'focus' }, 3), TODAY)).toBe('碼錶計時中');
	});

	it('進度：專注與碼錶報已經過幾分鐘（無條件捨去），休息報還剩幾分鐘（無條件進位）', () => {
		const text = (s: TimerState) => progressText(s, timerReading(s, NOW));
		expect(text(idle)).toBe('尚未開始');
		expect(text(focusing)).toBe('已專注 10 分鐘，共 25 分鐘');
		expect(text(paused)).toBe('已專注 7 分鐘，共 25 分鐘');
		expect(text(resting)).toBe('短休息剩 3 分鐘');
		expect(text(stopwatch({ phase: 'focus' }, 90.9))).toBe('已計時 90 分鐘');
	});
});

describe('頁首的今日摘要（todaySummary）', () => {
	it('有讀書或完成番茄才報數字', () => {
		expect(todaySummary(0, 0)).toBe('今天還沒有學習紀錄');
		expect(todaySummary(95, 3)).toBe('今天已讀 1 小時 35 分，完成 3 個番茄');
		expect(todaySummary(0, 1)).toBe('今天已讀 0 分鐘，完成 1 個番茄');
	});
});
