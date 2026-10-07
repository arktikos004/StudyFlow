import { MINUTE_MS } from '../../shared/time';
import { formatMinutes } from './format';
import { breakMinutes, roundInfo, type TimerReading, type TimerState } from './timer-core';

// 計時頁的文字：計時環中間的階段與說明、報讀用的狀態與進度、頁首的今日摘要。

/**
 * 計時頁顯示用的階段。
 * 休息不能暫停：沒在跑的休息（break-ready）是「專注結束後自動開始休息」關閉時，等使用者按開始。
 */
export type TimerStage = 'idle' | 'running' | 'paused' | 'break-ready' | 'break';

export function timerStage(s: TimerState): TimerStage {
	if (s.phase === 'idle') return 'idle';
	if (s.phase === 'break') return s.running ? 'break' : 'break-ready';
	return s.running ? 'running' : 'paused';
}

export const breakName = (s: TimerState) => (s.breakKind === 'long' ? '長休息' : '短休息');

/** 計時環中間、數字上方的階段名稱 */
export function phaseLabel(s: TimerState): string {
	const pomodoro = s.mode === 'pomodoro';
	switch (timerStage(s)) {
		case 'idle':
			return pomodoro ? '準備專注' : '碼錶';
		case 'running':
			return pomodoro ? '專注中' : '計時中';
		case 'paused':
			return '已暫停';
		case 'break-ready':
			return `準備${breakName(s)}`;
		case 'break':
			return breakName(s);
	}
}

/** 計時環中間、數字下方的說明：這一輪有多長；碼錶說明環的意思 */
export function dialCaption(s: TimerState): string {
	if (s.mode === 'stopwatch') return '每小時繞一圈';
	return s.phase === 'break' ? `${breakName(s)} ${breakMinutes(s)} 分鐘` : `專注 ${s.focusMin} 分鐘`;
}

/** 階段改變時報讀的狀態（role="status"）；數字本身是 role="timer"，不會每秒報讀 */
export function statusText(s: TimerState, today: string): string {
	const pomodoro = s.mode === 'pomodoro';
	switch (timerStage(s)) {
		case 'idle':
			return pomodoro ? `準備專注，${s.focusMin} 分鐘` : '碼錶已停止';
		case 'running': {
			if (!pomodoro) return '碼錶計時中';
			const { round, of } = roundInfo(s, today);
			return `專注中，第 ${round}／${of} 輪，共 ${s.focusMin} 分鐘`;
		}
		case 'paused':
			return '已暫停';
		case 'break-ready':
			return `專注完成，準備${breakName(s)} ${breakMinutes(s)} 分鐘`;
		case 'break':
			return `專注完成，${breakName(s)} ${breakMinutes(s)} 分鐘`;
	}
}

/** 計時環的 aria-valuetext：以分鐘報讀 */
export function progressText(s: TimerState, { elapsed, shown }: TimerReading): string {
	if (s.phase === 'idle') return '尚未開始';
	if (s.phase === 'break') return `${breakName(s)}剩 ${Math.ceil(shown / MINUTE_MS)} 分鐘`;
	const minutes = Math.floor(elapsed / MINUTE_MS);
	return s.mode === 'pomodoro' ? `已專注 ${minutes} 分鐘，共 ${s.focusMin} 分鐘` : `已計時 ${minutes} 分鐘`;
}

/** 頁首的今日摘要：今天讀了多久、完成幾個番茄 */
export function todaySummary(minutes: number, pomodoros: number): string {
	if (minutes > 0 || pomodoros > 0) return `今天已讀 ${formatMinutes(minutes)}，完成 ${pomodoros} 個番茄`;
	return '今天還沒有學習紀錄';
}
