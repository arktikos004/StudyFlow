import { DARK_STEPS, NO_SUBJECT_COLOR } from '../palette';
import { clamp, hexToOklch, maxChroma, oklchToHex, parseHex } from './convert';
import { contrastRatio } from './metrics';

// 科目色實際顯示的樣子（DESIGN.md §3）：把使用者選的顏色調整到淺色、深色模式各自的亮度範圍。

/**
 * 科目色在某個模式下的顯示方式：
 * - mark：圓點、長條、色票的實心色（#rrggbb）
 * - tint：chip 底色（CSS color-mix 字串）
 * - ring：chip 外框（CSS color-mix 字串）
 * - onMark：疊在 mark 上的勾勾或圖示顏色（#rrggbb）
 */
export type SubjectTone = { readonly mark: string; readonly tint: string; readonly ring: string; readonly onMark: string };

// ---- 規格常數（DESIGN.md §3） ----

/** 淺色 mark 的 OKLCH L 範圍 */
export const LIGHT_BAND = [0.43, 0.77] as const;
/** 深色 mark 的 OKLCH L 範圍（由淺色範圍線性對應過來） */
export const DARK_BAND = [0.55, 0.67] as const;
/** chroma 下限：低於這個值看起來就是灰色 */
export const CHROMA_FLOOR = 0.1;
/** 深色模式的 chroma 上限 */
export const DARK_CHROMA_MAX = 0.16;
/** chroma 低於這個值時沒有可保留的色相（灰色），不硬拉 chroma，選色器會提醒 */
const ACHROMATIC = 0.02;

/** 兩種模式的卡片底色與文字色（DESIGN.md §2 的 card 與 ink），用於不受目前主題影響的預覽與對比計算 */
export const TONE_SURFACES = {
	light: { card: '#fdfcfa', ink: '#161d31' },
	dark: { card: '#151924', ink: '#f3f0ea' },
} as const;
/** 疊在 mark 上的深色字：淺色模式用 ink，深色模式用夜色 */
const INK_ON_MARK = { light: '#161d31', dark: '#0c0f18' } as const;
const WHITE = '#ffffff';
/** chip 底色裡 mark 佔的比例（%），其餘是底色 */
const TINT_PERCENT = { light: 14, dark: 22 } as const;
/** chip 外框裡 mark 佔的比例（%），其餘透明 */
const RING_PERCENT = 35;

/** 深色模式的 L 對應：淺色的 0.43–0.77 線性對應到 0.55–0.67（範圍外先夾住），單調遞增 */
export function darkLightness(l: number): number {
	const [lo, hi] = LIGHT_BAND;
	const [dlo, dhi] = DARK_BAND;
	return dlo + ((clamp(l, lo, hi) - lo) / (hi - lo)) * (dhi - dlo);
}

/** 把 value 拉回 lo–hi 需要的位移；已經在範圍內是 0 */
function shiftInto(value: number, lo: number, hi: number): number {
	if (value < lo) return lo - value;
	if (value > hi) return hi - value;
	return 0;
}

/**
 * 用 (l, c, h) 產生落在 band 內的 mark。
 * - 某些色相（例如青色）在色帶下緣達不到 chroma 下限：在色帶內把 l 往上調到最近能達到下限的位置，
 *   讓「L 在色帶內、C ≥ 0.10、色相不變」同時成立（色帶上緣所有色相都達得到，所以一定找得到）。
 * - 轉成 #rrggbb 會四捨五入到 8 位元，L 或 C 可能偏出 0.001–0.003：量回來再微調，讓範圍保證成立。
 */
function fitMark(l: number, c: number, h: number, band: readonly [number, number], cMax = Infinity): string {
	const [lo, hi] = band;
	const colorful = c >= CHROMA_FLOOR;
	// 預留一點 chroma 空間，四捨五入後才有餘裕把 C 補回下限以上
	const need = CHROMA_FLOOR + 0.006;
	let L = clamp(l, lo, hi);
	let C = c;
	if (colorful && maxChroma(L, h) < need && maxChroma(hi, h) >= need) {
		let a = L;
		let b = hi;
		for (let i = 0; i < 20; i++) {
			const mid = (a + b) / 2;
			if (maxChroma(mid, h) >= need) b = mid;
			else a = mid;
		}
		L = b;
	}
	let hex = oklchToHex({ l: L, c: C, h });
	for (let i = 0; i < 6; i++) {
		const got = hexToOklch(hex);
		const dL = shiftInto(got.l, lo, hi);
		const dC = shiftInto(got.c, colorful ? CHROMA_FLOOR : -Infinity, cMax);
		if (dL === 0 && dC === 0) break;
		L += dL + Math.sign(dL) * 5e-4;
		C += dC + Math.sign(dC) * 5e-4;
		hex = oklchToHex({ l: L, c: C, h });
	}
	return hex;
}

function lightMark(hex: string): string {
	const { l, c, h } = hexToOklch(hex);
	const [lo, hi] = LIGHT_BAND;
	const gray = c < ACHROMATIC;
	if (l >= lo && l <= hi && (gray || c >= CHROMA_FLOOR)) return hex;
	return fitMark(l, gray ? c : Math.max(c, CHROMA_FLOOR), h, LIGHT_BAND);
}

function darkMark(hex: string): string {
	const step = DARK_STEPS[hex];
	if (step) return step;
	const { l, c, h } = hexToOklch(hex);
	const gray = c < ACHROMATIC;
	return gray
		? fitMark(darkLightness(l), c, h, DARK_BAND)
		: fitMark(darkLightness(l), clamp(c, CHROMA_FLOOR, DARK_CHROMA_MAX), h, DARK_BAND, DARK_CHROMA_MAX);
}

function makeTone(mark: string, dark: boolean, surface: string): SubjectTone {
	const mode = dark ? 'dark' : 'light';
	const ink = INK_ON_MARK[mode];
	return Object.freeze({
		mark,
		tint: `color-mix(in oklab, ${mark} ${TINT_PERCENT[mode]}%, ${surface})`,
		ring: `color-mix(in oklab, ${mark} ${RING_PERCENT}%, transparent)`,
		onMark: contrastRatio(WHITE, mark) >= contrastRatio(ink, mark) ? WHITE : ink,
	});
}

// 同樣的輸入回傳同一個凍結物件，React 的 props 比較與 memo 才會穩定（超過上限時整批清除）
const TONE_CACHE_MAX = 1024;
const toneCache = new Map<string, SubjectTone>();

function cachedTone(key: string, make: () => SubjectTone): SubjectTone {
	let tone = toneCache.get(key);
	if (!tone) {
		tone = make();
		if (toneCache.size >= TONE_CACHE_MAX) toneCache.clear();
		toneCache.set(key, tone);
	}
	return tone;
}

/** 「未分類」的 tone：兩種模式都是保留的灰色 */
export function neutralTone(dark: boolean, surface = 'var(--card)'): SubjectTone {
	// key 不以 # 開頭，不會和科目色的 key 衝突
	return cachedTone(`${dark}|${surface}`, () => makeTone(NO_SUBJECT_COLOR, dark, surface));
}

/**
 * 科目色的顯示方式（所有顯示科目色的地方都要經過這裡）。
 * - hex：使用者選的原始顏色（儲存值）；格式錯誤或保留的灰色時回傳「未分類」的 tone。
 * - dark：是否為深色模式。
 * - surface：tint 疊上去的底色，預設是目前主題的 var(--card)；預覽固定模式時傳 TONE_SURFACES 的 card。
 *
 * 淺色 mark：L 夾在 0.43–0.77、C ≥ 0.10、色相不變（已在範圍內的顏色原樣回傳）。
 * 深色 mark：推薦色用 DARK_STEPS；其他顏色 L 由 0.43–0.77 線性對應到 0.55–0.67，C 夾在 0.10–0.16。
 * 近乎無彩度的灰色（C < 0.02）沒有色相可以保留，只調整 L。
 */
export function subjectTone(hex: string, dark: boolean, surface = 'var(--card)'): SubjectTone {
	const h = parseHex(hex);
	if (!h || h === NO_SUBJECT_COLOR) return neutralTone(dark, surface);
	return cachedTone(`${h}|${dark ? 'dark' : 'light'}|${surface}`, () => makeTone(dark ? darkMark(h) : lightMark(h), dark, surface));
}
