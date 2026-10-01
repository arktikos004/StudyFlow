import { useSyncExternalStore } from 'react';

// 白噪音（TMR-3）：用 Web Audio 即時產生白噪音、粉紅噪音、棕噪音，不用音檔。
// 專注中（計時在跑）才播放，暫停、休息或結束時停止；預設關閉。
// 設定存在 localStorage，多個分頁同步；同一時間只有一個分頁會發出聲音（Web Locks）。

export type NoiseKind = 'white' | 'pink' | 'brown';
export type NoisePrefs = { kind: NoiseKind | 'off'; volume: number };

export const NOISE_LABEL: Record<NoiseKind, string> = { white: '白噪音', pink: '粉紅噪音', brown: '棕噪音' };

const KEY = 'studyflow:noise';
const DEFAULT_PREFS: NoisePrefs = { kind: 'off', volume: 40 };

function readPrefs(): NoisePrefs {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NoisePrefs> | null;
		const kind = raw?.kind === 'white' || raw?.kind === 'pink' || raw?.kind === 'brown' ? raw.kind : 'off';
		const volume =
			typeof raw?.volume === 'number' && Number.isFinite(raw.volume)
				? Math.min(100, Math.max(0, Math.round(raw.volume)))
				: DEFAULT_PREFS.volume;
		return { kind, volume };
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

let prefs = readPrefs();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
	listeners.add(l);
	return () => {
		listeners.delete(l);
	};
};

export function setNoisePrefs(patch: Partial<NoisePrefs>) {
	prefs = { ...prefs, ...patch };
	try {
		localStorage.setItem(KEY, JSON.stringify(prefs));
	} catch {
		// 無法儲存時仍可在本頁使用
	}
	emit();
}

export function useNoisePrefs(): NoisePrefs {
	return useSyncExternalStore(subscribe, () => prefs);
}

window.addEventListener('storage', (e) => {
	if (e.key === KEY) {
		prefs = readPrefs();
		emit();
	}
});

// ---- 產生噪音 ----

const LOOP_SECONDS = 8;
const SEAM_SECONDS = 0.5;
/** 三種噪音都正規化到同樣的 RMS，切換種類時音量不會忽大忽小 */
const TARGET_RMS = 0.18;

function fill(kind: NoiseKind, out: Float32Array) {
	if (kind === 'white') {
		for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
		return;
	}
	if (kind === 'pink') {
		// Paul Kellet 的 refined 方法：-3 dB／octave
		let b0 = 0,
			b1 = 0,
			b2 = 0,
			b3 = 0,
			b4 = 0,
			b5 = 0,
			b6 = 0;
		for (let i = 0; i < out.length; i++) {
			const w = Math.random() * 2 - 1;
			b0 = 0.99886 * b0 + w * 0.0555179;
			b1 = 0.99332 * b1 + w * 0.0750759;
			b2 = 0.969 * b2 + w * 0.153852;
			b3 = 0.8665 * b3 + w * 0.3104856;
			b4 = 0.55 * b4 + w * 0.5329522;
			b5 = -0.7616 * b5 - w * 0.016898;
			out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
			b6 = w * 0.115926;
		}
		return;
	}
	// 棕噪音：有洩漏的隨機漫步（-6 dB／octave）
	let last = 0;
	for (let i = 0; i < out.length; i++) {
		last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
		out[i] = last;
	}
}

/** 一段可以無縫循環的噪音：多產生 0.5 秒，用等功率交叉淡化接回開頭 */
function makeBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
	const rate = ctx.sampleRate;
	const len = Math.floor(LOOP_SECONDS * rate);
	const seam = Math.floor(SEAM_SECONDS * rate);
	const raw = new Float32Array(len + seam);
	fill(kind, raw);
	let sum = 0;
	for (let i = 0; i < raw.length; i++) sum += raw[i] * raw[i];
	const scale = TARGET_RMS / Math.max(1e-6, Math.sqrt(sum / raw.length));
	const buffer = ctx.createBuffer(1, len, rate);
	const out = buffer.getChannelData(0);
	for (let i = 0; i < len; i++) {
		let v = raw[i];
		if (i < seam) {
			const t = (i / seam) * (Math.PI / 2);
			v = raw[i] * Math.sin(t) + raw[len + i] * Math.cos(t);
		}
		out[i] = Math.max(-1, Math.min(1, v * scale));
	}
	return buffer;
}

// ---- 播放 ----

let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let source: AudioBufferSourceNode | null = null;
let playing: NoiseKind | null = null;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
const buffers = new Map<NoiseKind, AudioBuffer>();

/** 音量 0–100 換算成增益（平方曲線，比較接近聽感） */
const gainFor = (volume: number) => (volume / 100) ** 2;

function ramp(target: number) {
	if (!ctx || !gain) return;
	gain.gain.cancelScheduledValues(ctx.currentTime);
	gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
}

/** 已經在等使用者操作（避免 suspended 期間每次 play 都多註冊一組監聽） */
let gestureArmed = false;

/** 瀏覽器不允許沒有使用者操作就播放（例如重新整理後計時仍在跑）：等下一次點擊或按鍵再開始 */
function resumeOnGesture(c: AudioContext) {
	if (gestureArmed) return;
	gestureArmed = true;
	const resume = () => {
		gestureArmed = false;
		c.resume().catch(() => {});
		window.removeEventListener('pointerdown', resume);
		window.removeEventListener('keydown', resume);
	};
	window.addEventListener('pointerdown', resume);
	window.addEventListener('keydown', resume);
}

function play(kind: NoiseKind, volume: number) {
	clearTimeout(stopTimer);
	try {
		if (!ctx) {
			ctx = new AudioContext();
			gain = ctx.createGain();
			gain.gain.value = 0;
			gain.connect(ctx.destination);
		}
		const c = ctx;
		if (c.state !== 'running') c.resume().catch(() => resumeOnGesture(c));
		if (c.state === 'suspended') resumeOnGesture(c);
		if (playing !== kind || !source) {
			source?.stop();
			source?.disconnect();
			let buffer = buffers.get(kind);
			if (!buffer) buffers.set(kind, (buffer = makeBuffer(c, kind)));
			source = c.createBufferSource();
			source.buffer = buffer;
			source.loop = true;
			source.connect(gain!);
			source.start();
			playing = kind;
		}
		ramp(gainFor(volume));
	} catch {
		// 瀏覽器不支援 Web Audio：安靜地略過
	}
}

function stop() {
	if (!playing) return;
	ramp(0);
	clearTimeout(stopTimer);
	// 淡出後才真的停止，並讓音訊裝置休息（省電）
	stopTimer = setTimeout(() => {
		source?.stop();
		source?.disconnect();
		source = null;
		playing = null;
		ctx?.suspend().catch(() => {});
	}, 400);
}

/** 目前是否正在這個分頁播放（給測試與畫面狀態用） */
export const isNoisePlaying = () => playing !== null;

/**
 * 全站掛一次（計時引擎）：專注中（isActive 為 true）且選了噪音時播放，其他時候停止。
 * 多個分頁同時開著時，用 Web Locks 讓只有一個分頁發出聲音；那個分頁關掉後，下一個分頁接手。
 * 回傳停止同步的函式。
 */
export function startNoiseSync(isActive: () => boolean, subscribeActive: (l: () => void) => () => void): () => void {
	let release: (() => void) | null = null;
	let waiting = false;
	let disposed = false;
	const want = () => !disposed && isActive() && prefs.kind !== 'off';

	const sync = () => {
		if (!want()) {
			stop();
			release?.();
			return;
		}
		if (release) return play(prefs.kind as NoiseKind, prefs.volume);
		if (!('locks' in navigator)) return play(prefs.kind as NoiseKind, prefs.volume);
		if (waiting) return;
		waiting = true;
		navigator.locks
			.request(
				'studyflow-noise',
				() =>
					new Promise<void>((resolve) => {
						waiting = false;
						release = () => {
							release = null;
							resolve();
						};
						// 等待期間狀態可能變了：重新判斷
						sync();
					}),
			)
			.catch(() => {
				waiting = false;
			});
	};

	const offActive = subscribeActive(sync);
	const offPrefs = subscribe(sync);
	sync();
	return () => {
		disposed = true;
		offActive();
		offPrefs();
		sync();
	};
}
