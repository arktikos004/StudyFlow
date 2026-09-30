import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { PublicUser } from '../../shared/api-types';
import { localDate } from '../../shared/dates';
import { api } from './api';
import { formatMinutes } from './format';
import { SESSION_KEYS, type SessionInput } from './queries';
import {
	advance,
	clampOptions,
	defaultState,
	describeEvents,
	elapsedMs,
	MIN_RECORD_MS,
	normalizeState,
	type TimerEvent,
	type TimerOptions,
	type TimerState,
} from './timer-core';

// 計時器狀態存在 localStorage，並以「開始時間戳」計算經過時間：
// 重新整理、切換分頁、手機鎖屏都不會讓計時中斷或變慢。
// 到點切換、長休息、自動開始的規則是純函式，放在 timer-core.ts（有測試）。

export {
	breakMinutes,
	elapsedMs,
	LATE_MS,
	LIMITS,
	optionError,
	roundInfo,
	targetMs,
	type BreakKind,
	type NumericOption,
	type TimerMode,
	type TimerOptions,
	type TimerPhase,
	type TimerState,
} from './timer-core';

const KEY = 'studyflow:timer';
const QUEUE_KEY = 'studyflow:pending-sessions';

/** 「今天」與輪數跨日依使用者時區；登入資料還沒載入前先用裝置時區 */
let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const todayKey = () => localDate(Date.now(), timeZone);

function load(): TimerState {
	try {
		const raw = localStorage.getItem(KEY);
		// 舊版缺少的欄位、不合法的值都換成預設值
		if (raw) return normalizeState(JSON.parse(raw), todayKey());
	} catch {
		// 讀不到就用預設值
	}
	return defaultState(todayKey());
}

let state = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function replaceState(next: TimerState) {
	state = next;
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// 無法儲存時仍可在本頁使用
	}
	emit();
}

function setState(patch: Partial<TimerState>) {
	replaceState({ ...state, ...patch });
}

// 多個分頁同步同一個計時器
window.addEventListener('storage', (e) => {
	if (e.key === KEY) {
		state = load();
		emit();
	}
});

// ---- 操作 ----

export const timer = {
	/** 模式、專注／短休息分鐘數（超出範圍時夾進 1–180／1–60）、科目與任務 */
	configure(patch: Partial<Pick<TimerState, 'mode' | 'focusMin' | 'breakMin' | 'subjectId' | 'taskId'>>) {
		setState(clampOptions(patch));
	},
	/** 番茄鐘設定：專注、短休息、長休息、長休息間隔、自動開始（數字會夾進合法範圍） */
	setOptions(patch: Partial<TimerOptions>) {
		setState(clampOptions(patch));
	},
	start() {
		const now = Date.now();
		setState({ phase: 'focus', breakKind: 'short', running: true, segmentStart: now, accumulatedMs: 0, sessionStartedAt: now });
		requestNotificationPermission();
	},
	pause() {
		setState({ accumulatedMs: elapsedMs(state), running: false, segmentStart: null });
	},
	/** 繼續暫停中的專注；也用來開始「準備休息」的休息（自動開始休息關閉時） */
	resume() {
		setState({ running: true, segmentStart: Date.now() });
	},
	/** 放棄本次計時，不記錄 */
	discard() {
		setState({ phase: 'idle', breakKind: 'short', running: false, segmentStart: null, accumulatedMs: 0, sessionStartedAt: null });
	},
	/** 提早結束休息：和休息到點一樣，開啟「休息結束後自動專注」時直接開始下一輪 */
	skipBreak() {
		if (state.phase !== 'break') return;
		if (state.autoStartFocus) timer.start();
		else timer.discard();
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

/** 檢查番茄鐘是否到時間：到點就記錄、切換階段，回傳這次發生的事件 */
function tick(): TimerEvent[] {
	const { state: next, records, events } = advance(state, Date.now(), (ms) => localDate(ms, timeZone));
	if (!events.length) return events;
	records.forEach(enqueue);
	replaceState(next);
	return events;
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

const userTimeZone = (qc: QueryClient) => qc.getQueryData<PublicUser | null>(['me'])?.timezone;

/** 全站只掛一次（在 Layout）：負責到點切換、通知與上傳紀錄 */
export function useTimerEngine() {
	const qc = useQueryClient();
	useEffect(() => {
		const onSaved = (r: SessionInput) => {
			// 和手動新增、編輯紀錄同一組：紀錄列表、任務投入時間、總覽、統計、頁首摘要、成就、單科總覽
			SESSION_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
			toast.success(`已記錄 ${formatMinutes((r.durationSec ?? 0) / 60)}的學習時間`);
		};
		let busy = false;
		const run = async () => {
			if (busy) return;
			busy = true;
			try {
				timeZone = userTimeZone(qc) ?? timeZone;
				const events = await exclusive('studyflow-timer', () => {
					state = load();
					return tick();
				});
				const message = describeEvents(events, state);
				if (message) notify(message.title, message.body);
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
