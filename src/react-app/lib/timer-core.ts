// 計時器的純邏輯（不碰 localStorage、DOM、React），lib/timer.ts 與測試共用。
// 狀態以「開始時間戳」計算經過時間，所以任何時刻都能從狀態與現在時間推算出正確的結果。

import { HOUR_MS, MINUTE_MS } from '../../shared/time';

export type TimerMode = 'pomodoro' | 'stopwatch';
export type TimerPhase = 'idle' | 'focus' | 'break';
export type BreakKind = 'short' | 'long';

export type TimerState = {
	mode: TimerMode;
	phase: TimerPhase;
	running: boolean;
	/** 目前這段連續計時的開始時間（暫停或等待開始休息時為 null） */
	segmentStart: number | null;
	/** 此階段在暫停前累積的毫秒數 */
	accumulatedMs: number;
	/** 本次專注第一次按下開始的時間，寫入學習紀錄用 */
	sessionStartedAt: number | null;
	subjectId: string | null;
	taskId: string | null;
	/** 專注分鐘數（1–180） */
	focusMin: number;
	/** 短休息分鐘數（1–60） */
	breakMin: number;
	/** 長休息分鐘數（5–60） */
	longBreakMin: number;
	/** 每幾個番茄長休息一次（2–8） */
	longBreakEvery: number;
	/** 專注結束後自動開始休息；關閉時停在「準備休息」等使用者按開始 */
	autoStartBreak: boolean;
	/** 休息結束後自動開始下一輪專注；延遲超過 LATE_MS 時不會自動開始 */
	autoStartFocus: boolean;
	/** 目前（或剛結束）的休息種類；不在休息時為 'short' */
	breakKind: BreakKind;
	/** cyclesDate 那天完成的番茄數 */
	cycles: number;
	/** 使用者時區的日期 'YYYY-MM-DD'；跨日後輪數歸零 */
	cyclesDate: string;
};

/** 可以自訂的設定（timer.setOptions） */
export type TimerOptions = Pick<
	TimerState,
	'focusMin' | 'breakMin' | 'longBreakMin' | 'longBreakEvery' | 'autoStartBreak' | 'autoStartFocus'
>;

/** 數字設定的範圍與預設值（TMR-1） */
export const LIMITS = {
	focusMin: { min: 1, max: 180, fallback: 25, label: '專注時間', unit: '分鐘' },
	breakMin: { min: 1, max: 60, fallback: 5, label: '短休息', unit: '分鐘' },
	longBreakMin: { min: 5, max: 60, fallback: 15, label: '長休息', unit: '分鐘' },
	longBreakEvery: { min: 2, max: 8, fallback: 4, label: '長休息間隔', unit: '輪' },
} as const;
export type NumericOption = keyof typeof LIMITS;

/** 休息結束後超過這麼久才偵測到（電腦睡眠、分頁關閉），就不自動開始下一輪 */
export const LATE_MS = MINUTE_MS;
/** LATE_MS 換成分鐘（說明文字用，改常數時文字跟著改） */
export const LATE_MINUTES = LATE_MS / MINUTE_MS;
/** 不到 1 分鐘的計時不記錄 */
export const MIN_RECORD_MS = MINUTE_MS;
/** 結束時間最多可以比現在晚這麼多（和後端 studySessionSchema 的「不能記錄未來的時間」一致，容許時鐘誤差） */
export const FUTURE_TOLERANCE_MS = 5 * MINUTE_MS;

export function defaultState(today: string): TimerState {
	return {
		mode: 'pomodoro',
		phase: 'idle',
		running: false,
		segmentStart: null,
		accumulatedMs: 0,
		sessionStartedAt: null,
		subjectId: null,
		taskId: null,
		focusMin: LIMITS.focusMin.fallback,
		breakMin: LIMITS.breakMin.fallback,
		longBreakMin: LIMITS.longBreakMin.fallback,
		longBreakEvery: LIMITS.longBreakEvery.fallback,
		autoStartBreak: true,
		autoStartFocus: false,
		breakKind: 'short',
		cycles: 0,
		cyclesDate: today,
	};
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function option(key: NumericOption, v: unknown): number {
	const { min, max, fallback } = LIMITS[key];
	return isNum(v) ? clamp(Math.round(v), min, max) : fallback;
}

/** 把數字設定夾進合法範圍（其他欄位原樣保留） */
export function clampOptions<T extends Partial<TimerState>>(patch: T): T {
	const out: Partial<TimerState> = { ...patch };
	for (const key of Object.keys(LIMITS) as NumericOption[]) if (key in out) out[key] = option(key, out[key]);
	return out as T;
}

/** Sprint 1 存的是 Date.toDateString()（裝置時區），換成 'YYYY-MM-DD' 才比得起來 */
function migrateDate(v: string): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
	const d = new Date(v);
	if (Number.isNaN(d.getTime())) return v;
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 從 localStorage 讀回來的資料：舊版缺少的欄位、型別不對或超出範圍的值，一律換成預設值（TMR-1 驗收 5）。
 */
export function normalizeState(raw: unknown, today: string): TimerState {
	const d = defaultState(today);
	if (!raw || typeof raw !== 'object') return d;
	const r = raw as Record<string, unknown>;
	const numOrNull = (v: unknown) => (isNum(v) ? v : null);
	const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);
	const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
	const phase: TimerPhase = r.phase === 'focus' || r.phase === 'break' ? r.phase : 'idle';
	return {
		mode: r.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
		phase,
		running: phase !== 'idle' && r.running === true,
		segmentStart: numOrNull(r.segmentStart),
		accumulatedMs: isNum(r.accumulatedMs) ? Math.max(0, r.accumulatedMs) : 0,
		sessionStartedAt: numOrNull(r.sessionStartedAt),
		subjectId: strOrNull(r.subjectId),
		taskId: strOrNull(r.taskId),
		focusMin: option('focusMin', r.focusMin),
		breakMin: option('breakMin', r.breakMin),
		longBreakMin: option('longBreakMin', r.longBreakMin),
		longBreakEvery: option('longBreakEvery', r.longBreakEvery),
		autoStartBreak: bool(r.autoStartBreak, d.autoStartBreak),
		autoStartFocus: bool(r.autoStartFocus, d.autoStartFocus),
		breakKind: phase === 'break' && r.breakKind === 'long' ? 'long' : 'short',
		cycles: isNum(r.cycles) ? Math.max(0, Math.floor(r.cycles)) : 0,
		cyclesDate: typeof r.cyclesDate === 'string' ? migrateDate(r.cyclesDate) : today,
	};
}

/**
 * 設定欄位的輸入檢查：合法時回傳 null，否則回傳 zh-TW 錯誤訊息（說明範圍與怎麼改）。
 */
export function optionError(key: NumericOption, raw: string): string | null {
	const { min, max, label, unit } = LIMITS[key];
	const text = raw.trim();
	if (text === '') return `請輸入${label}（${min}–${max} ${unit}）`;
	const n = Number(text);
	if (!Number.isFinite(n)) return `${label}請輸入數字，範圍 ${min}–${max} ${unit}`;
	if (!Number.isInteger(n)) return `${label}請輸入整數${unit === '輪' ? '輪數' : '分鐘數'}`;
	if (n < min || n > max) return `${label}要介於 ${min}–${max} ${unit}，請重新輸入`;
	return null;
}

export function elapsedMs(s: TimerState, now = Date.now()) {
	return Math.max(0, s.accumulatedMs + (s.running && s.segmentStart ? now - s.segmentStart : 0));
}

/** 目前休息（或下一次休息）的分鐘數 */
export const breakMinutes = (s: TimerState, kind: BreakKind = s.breakKind) => (kind === 'long' ? s.longBreakMin : s.breakMin);

/** 這個階段的目標毫秒數；碼錶沒有目標（null）。閒置時是下一輪專注的長度。 */
export function targetMs(s: TimerState): number | null {
	if (s.mode === 'stopwatch') return null;
	return (s.phase === 'break' ? breakMinutes(s) : s.focusMin) * MINUTE_MS;
}

/** 計時器此刻的讀數（timerReading） */
export type TimerReading = {
	/** 這個階段已經經過的毫秒數；閒置時是 0 */
	elapsed: number;
	/** 畫面上的時間：番茄鐘倒數剩下的，碼錶正數經過的 */
	shown: number;
	/** 這一輪的進度（0～1）；碼錶沒有目標，每小時繞一圈 */
	progress: number;
};

/** 計時頁的計時環、頁首的膠囊與手機導覽的進度環共用，三處顯示的時間才會一致 */
export function timerReading(s: TimerState, now: number): TimerReading {
	const elapsed = s.phase === 'idle' ? 0 : elapsedMs(s, now);
	const target = targetMs(s);
	if (target === null) return { elapsed, shown: elapsed, progress: (elapsed % HOUR_MS) / HOUR_MS };
	return { elapsed, shown: Math.max(0, target - elapsed), progress: elapsed / target };
}

/** 計時器送出的學習紀錄（和 queries.ts 的 SessionInput 相容） */
export type SessionRecord = {
	mode: TimerMode;
	startedAt: number;
	endedAt: number;
	durationSec: number;
	subjectId: string | null;
	taskId: string | null;
};

// ---- 待上傳佇列：每一筆怎麼送（lib/timer.ts 的 flushQueue 用；依賴注入，方便測試） ----

/** 佇列裡的一筆（SessionInput 的子集） */
export type QueuedRecord = { mode: string; startedAt: number; endedAt: number; subjectId?: string | null; taskId?: string | null };

/** 伺服器上是否已經有同一筆：模式與起訖時間到毫秒都相同（計時器產生的時間戳不會巧合到毫秒） */
export function isDuplicate(record: QueuedRecord, existing: readonly { mode: string; startedAt: number; endedAt: number }[]): boolean {
	return existing.some((s) => s.mode === record.mode && s.startedAt === record.startedAt && s.endedAt === record.endedAt);
}

const statusOf = (e: unknown): number | undefined => {
	const status = (e as { status?: unknown } | null)?.status;
	return typeof status === 'number' ? status : undefined;
};

/**
 * 送出失敗時這筆怎麼處理：
 * - keep：留在佇列，這次先停（離線 0、未登入 401、伺服器錯誤或不明狀況），稍後再送
 * - unlink：400 而且有掛科目或任務（可能在計時途中被刪除），改成不掛科目再送一次
 * - drop：確定無效的 400（不掛科目也被拒絕），從佇列移除並告知使用者
 */
export function queueAction(status: number | undefined, record: QueuedRecord): 'keep' | 'unlink' | 'drop' {
	if (status !== 400) return 'keep';
	return record.subjectId || record.taskId ? 'unlink' : 'drop';
}

export type SendOutcome<R> =
	{ kind: 'saved'; record: R; unlinked: boolean } | { kind: 'duplicate' } | { kind: 'keep' } | { kind: 'dropped'; reason: string };

/**
 * 送出佇列裡的一筆：先確認伺服器還沒有同一筆（上次送出成功、但還沒從佇列移除就關掉分頁時會發生），再送出。
 * - existing：查伺服器上這筆附近的紀錄；離線時丟出 status 0（留在佇列），其他查詢錯誤照常送出。
 * - post：送出；失敗時依 queueAction 處理，絕不靜默丟掉。
 */
export async function sendRecord<R extends QueuedRecord>(
	record: R,
	deps: {
		existing: (record: R) => Promise<readonly { mode: string; startedAt: number; endedAt: number }[]>;
		post: (record: R) => Promise<unknown>;
	},
): Promise<SendOutcome<R>> {
	try {
		if (isDuplicate(record, await deps.existing(record))) return { kind: 'duplicate' };
	} catch (e) {
		const status = statusOf(e);
		if (status === 0 || status === 401) return { kind: 'keep' };
		// 其他查詢錯誤：照原本的流程送出（後端仍會檢查）
	}
	let attempt: R = record;
	let unlinked = false;
	for (;;) {
		try {
			await deps.post(attempt);
			return { kind: 'saved', record: attempt, unlinked };
		} catch (e) {
			const action = queueAction(statusOf(e), attempt);
			if (action === 'keep') return { kind: 'keep' };
			if (action === 'drop') return { kind: 'dropped', reason: e instanceof Error && e.message ? e.message : '資料格式錯誤' };
			attempt = { ...attempt, subjectId: null, taskId: null };
			unlinked = true;
		}
	}
}

export type TimerEvent =
	| { type: 'focus-done'; at: number; count: number; breakKind: BreakKind; autoStarted: boolean }
	| { type: 'break-done'; at: number; breakKind: BreakKind; autoStarted: boolean; late: boolean };

/**
 * 番茄鐘到點切換。以「真正到點的時刻」接續下一個階段，所以使用者晚回來也不會算錯；
 * 一次可能跨過好幾個階段（例如專注中電腦睡著，醒來時專注和休息都結束了）。
 *
 * - 專注到點：記錄這一輪（startedAt 是第一次按開始的時間），當天第 N、2N… 個之後進入長休息。
 *   autoStartBreak 關閉時停在「準備休息」（phase 'break'、running false）。
 * - 休息到點：autoStartFocus 開啟、而且延遲不超過 LATE_MS 時，從休息結束的時刻開始下一輪；
 *   否則回到閒置。延遲太久時不自動開始，所以絕不會補記使用者不在時的番茄。
 *
 * dayOf：某個瞬間在使用者時區的日期（'YYYY-MM-DD'），決定輪數何時歸零。
 */
export function advance(
	start: TimerState,
	now: number,
	dayOf: (epochMs: number) => string,
): { state: TimerState; records: SessionRecord[]; events: TimerEvent[] } {
	let s = start;
	const records: SessionRecord[] = [];
	const events: TimerEvent[] = [];
	// 最多：專注到點，接著休息到點；自動開始的專注從不到 1 分鐘前開始，這次不可能再到點
	for (let i = 0; i < 4; i++) {
		if (!s.running || s.mode !== 'pomodoro' || s.phase === 'idle') break;
		const target = targetMs(s)!;
		const el = elapsedMs(s, now);
		if (el < target) break;
		const reachedAt = now - (el - target);

		if (s.phase === 'focus') {
			records.push({
				mode: 'pomodoro',
				startedAt: s.sessionStartedAt ?? reachedAt - target,
				endedAt: reachedAt,
				durationSec: Math.round(target / 1000),
				subjectId: s.subjectId,
				taskId: s.taskId,
			});
			const day = dayOf(reachedAt);
			const count = (s.cyclesDate === day ? s.cycles : 0) + 1;
			const breakKind: BreakKind = count % s.longBreakEvery === 0 ? 'long' : 'short';
			const auto = s.autoStartBreak;
			s = {
				...s,
				phase: 'break',
				breakKind,
				running: auto,
				segmentStart: auto ? reachedAt : null,
				accumulatedMs: 0,
				sessionStartedAt: null,
				cycles: count,
				cyclesDate: day,
			};
			events.push({ type: 'focus-done', at: reachedAt, count, breakKind, autoStarted: auto });
			continue;
		}

		const late = now - reachedAt > LATE_MS;
		const auto = s.autoStartFocus && !late;
		events.push({ type: 'break-done', at: reachedAt, breakKind: s.breakKind, autoStarted: auto, late });
		s = auto
			? { ...s, phase: 'focus', breakKind: 'short', running: true, segmentStart: reachedAt, accumulatedMs: 0, sessionStartedAt: reachedAt }
			: { ...s, phase: 'idle', breakKind: 'short', running: false, segmentStart: null, accumulatedMs: 0, sessionStartedAt: null };
	}
	return { state: s, records, events };
}

/**
 * 「第 k／N 輪」：N 是長休息間隔。
 * - 閒置與專注：正在（或即將）進行的那一輪。
 * - 休息：剛完成的那一輪（跨午夜的休息仍算前一天的輪數）。
 * done 是今天完成的番茄數；filled 是這一組已完成的圓點數。
 */
export function roundInfo(s: TimerState, today: string): { done: number; round: number; of: number; filled: number } {
	const of = s.longBreakEvery;
	const done = s.cyclesDate === today ? s.cycles : 0;
	if (s.phase === 'break' && s.cycles > 0) {
		const round = ((s.cycles - 1) % of) + 1;
		return { done, round, of, filled: round };
	}
	return { done, round: (done % of) + 1, of, filled: done % of };
}

/** 到點通知的文字：一次發生好幾件事（電腦睡眠醒來）時合併成一則 */
export function describeEvents(events: TimerEvent[], s: TimerState): { title: string; body: string } | null {
	const last = events.at(-1);
	if (!last) return null;
	const focus = events.findLast((e) => e.type === 'focus-done');
	const breakName = (kind: BreakKind) => (kind === 'long' ? '長休息' : '休息');
	if (last.type === 'focus-done') {
		const name = breakName(last.breakKind);
		const min = breakMinutes(s, last.breakKind);
		return {
			title: `完成第 ${last.count} 個番茄`,
			body: last.autoStarted ? `開始${name} ${min} 分鐘` : `準備好就開始${name}（${min} 分鐘）`,
		};
	}
	if (focus?.type === 'focus-done')
		return {
			title: `完成第 ${focus.count} 個番茄`,
			body: last.autoStarted ? '休息時間也結束了，已開始下一輪專注' : '休息時間也結束了，準備好就開始下一輪',
		};
	if (last.autoStarted) return { title: '休息結束', body: `開始下一輪專注 ${s.focusMin} 分鐘` };
	if (last.late && s.autoStartFocus) return { title: '休息結束', body: `離開超過 ${LATE_MINUTES} 分鐘，這次沒有自動開始下一輪` };
	return { title: '休息結束', body: '準備好就開始下一個番茄鐘' };
}
