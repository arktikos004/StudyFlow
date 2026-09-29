import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api } from './api';
import { formatMinutes } from './format';
import type { SessionInput } from './queries';

// 計時器狀態存在 localStorage，並以「開始時間戳」計算經過時間：
// 重新整理、切換分頁、手機鎖屏都不會讓計時中斷或變慢。

export type TimerMode = 'pomodoro' | 'stopwatch';
export type TimerPhase = 'idle' | 'focus' | 'break';

export type TimerState = {
	mode: TimerMode;
	phase: TimerPhase;
	running: boolean;
	/** 目前這段連續計時的開始時間（暫停時為 null） */
	segmentStart: number | null;
	/** 此階段在暫停前累積的毫秒數 */
	accumulatedMs: number;
	/** 本次專注第一次按下開始的時間，寫入學習紀錄用 */
	sessionStartedAt: number | null;
	subjectId: string | null;
	taskId: string | null;
	focusMin: number;
	breakMin: number;
	/** 今天完成的番茄數（顯示用） */
	cycles: number;
	cyclesDate: string;
};

const KEY = 'studyflow:timer';
const QUEUE_KEY = 'studyflow:pending-sessions';
const MIN_RECORD_MS = 60_000;

const todayKey = () => new Date().toDateString();

const DEFAULT: TimerState = {
	mode: 'pomodoro',
	phase: 'idle',
	running: false,
	segmentStart: null,
	accumulatedMs: 0,
	sessionStartedAt: null,
	subjectId: null,
	taskId: null,
	focusMin: 25,
	breakMin: 5,
	cycles: 0,
	cyclesDate: todayKey(),
};

function load(): TimerState {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
	} catch {
		// 讀不到就用預設值
	}
	return { ...DEFAULT };
}

let state = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setState(patch: Partial<TimerState>) {
	state = { ...state, ...patch };
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// 無法儲存時仍可在本頁使用
	}
	emit();
}

// 多個分頁同步同一個計時器
window.addEventListener('storage', (e) => {
	if (e.key === KEY) {
		state = load();
		emit();
	}
});

export function elapsedMs(s: TimerState, now = Date.now()) {
	return Math.max(0, s.accumulatedMs + (s.running && s.segmentStart ? now - s.segmentStart : 0));
}

export function targetMs(s: TimerState): number | null {
	if (s.mode === 'stopwatch' || s.phase === 'idle') return s.mode === 'pomodoro' ? s.focusMin * 60_000 : null;
	return (s.phase === 'break' ? s.breakMin : s.focusMin) * 60_000;
}

// ---- 操作 ----

export const timer = {
	configure(patch: Partial<Pick<TimerState, 'mode' | 'focusMin' | 'breakMin' | 'subjectId' | 'taskId'>>) {
		setState(patch);
	},
	start() {
		const now = Date.now();
		setState({ phase: 'focus', running: true, segmentStart: now, accumulatedMs: 0, sessionStartedAt: now });
		requestNotificationPermission();
	},
	pause() {
		setState({ accumulatedMs: elapsedMs(state), running: false, segmentStart: null });
	},
	resume() {
		setState({ running: true, segmentStart: Date.now() });
	},
	/** 放棄本次計時，不記錄 */
	discard() {
		setState({ phase: 'idle', running: false, segmentStart: null, accumulatedMs: 0, sessionStartedAt: null });
	},
	skipBreak() {
		timer.discard();
	},
	/** 結束並儲存（碼錶，或提早結束番茄鐘）；不到 1 分鐘不記錄 */
	finish(): boolean {
		const now = Date.now();
		const el = elapsedMs(state, now);
		const record: SessionInput | null =
			state.phase === 'focus' && state.sessionStartedAt && el >= MIN_RECORD_MS
				? {
						mode: state.mode,
						startedAt: state.sessionStartedAt,
						endedAt: now,
						durationSec: Math.floor(el / 1000),
						subjectId: state.subjectId,
						taskId: state.taskId,
					}
				: null;
		timer.discard();
		if (record) enqueue(record);
		return !!record;
	},
};

/** 檢查番茄鐘是否到時間；回傳這次發生的事件 */
function tick(): 'focus-done' | 'break-done' | null {
	if (!state.running || state.mode !== 'pomodoro' || state.phase === 'idle') return null;
	const now = Date.now();
	const target = targetMs(state)!;
	const el = elapsedMs(state, now);
	if (el < target) return null;
	// 真正到點的時刻（使用者可能過了很久才回到頁面）
	const reachedAt = now - (el - target);

	if (state.phase === 'focus') {
		enqueue({
			mode: 'pomodoro',
			startedAt: state.sessionStartedAt ?? reachedAt - target,
			endedAt: reachedAt,
			durationSec: Math.round(target / 1000),
			subjectId: state.subjectId,
			taskId: state.taskId,
		});
		const sameDay = state.cyclesDate === todayKey();
		setState({
			phase: 'break',
			running: true,
			segmentStart: reachedAt,
			accumulatedMs: 0,
			sessionStartedAt: null,
			cycles: (sameDay ? state.cycles : 0) + 1,
			cyclesDate: todayKey(),
		});
		return 'focus-done';
	}
	setState({ phase: 'idle', running: false, segmentStart: null, accumulatedMs: 0 });
	return 'break-done';
}

// ---- 待上傳佇列（離線時先存著，恢復連線再送） ----

function readQueue(): SessionInput[] {
	try {
		return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
	} catch {
		return [];
	}
}
function writeQueue(q: SessionInput[]) {
	try {
		localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
	} catch {
		// 忽略
	}
}
function enqueue(record: SessionInput) {
	writeQueue([...readQueue(), record]);
}

/** 用 Web Locks 確保多個分頁不會重複處理同一件事 */
async function exclusive<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
	if ('locks' in navigator) return navigator.locks.request(name, async () => fn()) as Promise<T>;
	return fn();
}

let flushing = false;
async function flushQueue(onSaved: (r: SessionInput) => void) {
	if (flushing || !navigator.onLine || readQueue().length === 0) return;
	flushing = true;
	try {
		await exclusive('studyflow-flush', async () => {
			for (const record of readQueue()) {
				try {
					await api.post('/study-sessions', record);
					onSaved(record);
				} catch (e) {
					const status = (e as { status?: number }).status;
					// 離線或尚未登入：留著下次再送
					if (status === 0 || status === 401) return;
					// 計時途中科目或任務被刪除：改成不掛科目再送一次，讀書時間不會不見
					if (status === 400 && (record.subjectId || record.taskId)) {
						await api
							.post('/study-sessions', { ...record, subjectId: null, taskId: null })
							.then(() => onSaved(record))
							.catch(() => {});
					}
				}
				writeQueue(readQueue().slice(1));
			}
		});
	} finally {
		flushing = false;
	}
}

// ---- 通知 ----

function requestNotificationPermission() {
	if ('Notification' in window && Notification.permission === 'default') {
		Notification.requestPermission().catch(() => {});
	}
}

function beep() {
	try {
		const ctx = new AudioContext();
		[0, 0.25, 0.5].forEach((t) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.frequency.value = 880;
			gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
			osc.connect(gain).connect(ctx.destination);
			osc.start(ctx.currentTime + t);
			osc.stop(ctx.currentTime + t + 0.2);
		});
		setTimeout(() => ctx.close(), 1000);
	} catch {
		// 瀏覽器不允許播放聲音就算了
	}
}

function notify(title: string, body: string) {
	beep();
	toast(title, { description: body });
	if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
		try {
			new Notification(title, { body, icon: '/pwa-192x192.png', tag: 'studyflow-timer' });
		} catch {
			// 部分手機瀏覽器只允許從 Service Worker 發通知
		}
	}
}

// ---- React hooks ----

export function useTimerState(): TimerState {
	return useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => state,
	);
}

/** 計時中每秒更新一次畫面 */
export function useNow(active: boolean) {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (!active) return;
		const tick = () => setNow(Date.now());
		const first = setTimeout(tick, 0);
		const id = setInterval(tick, 250);
		return () => {
			clearTimeout(first);
			clearInterval(id);
		};
	}, [active]);
	return now;
}

/** 全站只掛一次（在 Layout）：負責到點切換、通知與上傳紀錄 */
export function useTimerEngine() {
	const qc = useQueryClient();
	useEffect(() => {
		const onSaved = (r: SessionInput) => {
			qc.invalidateQueries({ queryKey: ['sessions'] });
			qc.invalidateQueries({ queryKey: ['dashboard'] });
			qc.invalidateQueries({ queryKey: ['stats'] });
			toast.success(`已記錄 ${formatMinutes((r.durationSec ?? 0) / 60)} 的學習時間`);
		};
		let busy = false;
		const run = async () => {
			if (busy) return;
			busy = true;
			try {
				const event = await exclusive('studyflow-timer', () => {
					state = load();
					return tick();
				});
				if (event === 'focus-done') notify('專注時間結束 🎉', `休息 ${state.breakMin} 分鐘吧！`);
				if (event === 'break-done') notify('休息結束', '準備好就開始下一個番茄鐘');
				await flushQueue(onSaved);
			} finally {
				busy = false;
			}
		};
		run();
		const id = setInterval(run, 1000);
		document.addEventListener('visibilitychange', run);
		window.addEventListener('online', run);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', run);
			window.removeEventListener('online', run);
		};
	}, [qc]);
}
