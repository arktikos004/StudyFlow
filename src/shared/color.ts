import { colorName, DARK_STEPS, NO_SUBJECT_COLOR, PALETTE, RECOMMENDED } from './palette';

// 科目色的色彩數學（DESIGN.md §3）。純 TypeScript，不使用任何瀏覽器 API：
// 前端、Worker 與測試（workerd）共用。
//
// 色彩空間：#rrggbb ↔ sRGB（0–1）↔ linear sRGB ↔ OKLab ↔ OKLCH。
// ΔE 與色盲模擬移植自 dataviz skill 的 validate_palette.js，常數一致，
// 算出來的數字可以直接和驗證器的報告對照。

export type Rgb = readonly [number, number, number];
export type Oklab = readonly [number, number, number];
/** l 0–1、c ≥ 0、h 0–360（度） */
export type Oklch = { l: number; c: number; h: number };
/** h 0–360（度）、s 0–1、v 0–1 */
export type Hsv = { h: number; s: number; v: number };
export type CvdKind = 'protan' | 'deutan' | 'tritan';
export type NamedColor = { name: string; hex: string };

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

/** 相鄰科目的最小 ΔE（一般視覺），與 dataviz 的 normal-vision floor 相同 */
export const NEIGHBOR_MIN_DELTA_E = 15;
/** 相鄰科目在色盲模擬下的最小 ΔE，與 dataviz 的 CVD target 相同 */
export const CVD_MIN_DELTA_E = 8;
/** 任兩個科目的淺色 mark 低於這個 ΔE 就是「幾乎一樣」 */
export const SAME_MAX_DELTA_E = 8;
/**
 * 任兩個科目的深色 mark 低於這個 ΔE 就是「深色模式下幾乎一樣」。
 * 深色模式把 L 壓進 0.55–0.67，距離普遍變小，所以門檻比淺色低（例如「藍（明）」和「藍」在深色只差 2.2）。
 */
export const DARK_SAME_MAX_DELTA_E = 5;
/**
 * 提醒使用的色盲模擬種類：和 dataviz 驗證器一樣，只以 protan／deutan 判定，tritan 只計算不判定。
 * 推薦色的相鄰配對「琥珀↔粉紅」在淺色模式的 tritan ΔE 只有 5.8；如果也用 tritan 判定，
 * 照預設順序新增科目就會跳出提醒。
 */
export const CVD_WARNING_KINDS: readonly CvdKind[] = ['protan', 'deutan'];

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// ---- 解析與格式化 ----

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/;

/**
 * 解析色碼：接受 #rgb、rgb、#rrggbb、rrggbb，不分大小寫、忽略前後空白（含全形空白），
 * 全形字元（例如中文輸入法打出的「＃３９６ＥＤ６」）也會先轉成半形。
 * 回傳小寫的 #rrggbb；格式錯誤回傳 null。
 */
export function parseHex(input: string | null | undefined): string | null {
	if (typeof input !== 'string') return null;
	const m = HEX_RE.exec(input.normalize('NFKC').trim().toLowerCase());
	if (!m) return null;
	const d = m[1];
	return `#${d.length === 3 ? [...d].map((c) => c + c).join('') : d}`;
}

function mustParse(hex: string): string {
	const h = parseHex(hex);
	if (!h) throw new RangeError(`色碼格式錯誤：${hex}`);
	return h;
}

/** #rrggbb → sRGB（0–1）；格式錯誤會丟出 RangeError，避免 NaN 一路傳下去 */
export function hexToRgb(hex: string): Rgb {
	const h = mustParse(hex);
	return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
}

/** sRGB（0–1，超出範圍會夾住）→ 小寫 #rrggbb */
export function rgbToHex([r, g, b]: Rgb): string {
	const to = (c: number) =>
		Math.round(clamp(c, 0, 1) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${to(r)}${to(g)}${to(b)}`;
}

// ---- sRGB ↔ linear ↔ OKLab ↔ OKLCH ----

export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

export function hexToLinear(hex: string): Rgb {
	const [r, g, b] = hexToRgb(hex);
	return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

export function linearToHex([r, g, b]: Rgb): string {
	return rgbToHex([linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)]);
}

export function linearToOklab([r, g, b]: Rgb): Oklab {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

export function oklabToLinear([L, a, b]: Oklab): Rgb {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

export function oklabToOklch([l, a, b]: Oklab): Oklch {
	const c = Math.hypot(a, b);
	const h = c < 1e-7 ? 0 : ((((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360;
	return { l, c, h };
}

export function oklchToOklab({ l, c, h }: Oklch): Oklab {
	const rad = (h * Math.PI) / 180;
	return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

export const hexToOklab = (hex: string): Oklab => linearToOklab(hexToLinear(hex));
export const hexToOklch = (hex: string): Oklch => oklabToOklch(hexToOklab(hex));

const GAMUT_EPS = 1e-7;
const inGamut = ([r, g, b]: Rgb) =>
	r >= -GAMUT_EPS && r <= 1 + GAMUT_EPS && g >= -GAMUT_EPS && g <= 1 + GAMUT_EPS && b >= -GAMUT_EPS && b <= 1 + GAMUT_EPS;
const lchInGamut = (l: number, c: number, h: number) => inGamut(oklabToLinear(oklchToOklab({ l, c, h })));

/** 固定 L 與色相時，sRGB 色域內能達到的最大 chroma（二分搜尋） */
export function maxChroma(l: number, h: number): number {
	if (l <= 0 || l >= 1) return 0;
	let lo = 0;
	let hi = 0.4; // sRGB 的 chroma 最大約 0.32
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (lchInGamut(l, mid, h)) lo = mid;
		else hi = mid;
	}
	return lo;
}

/** OKLCH → #rrggbb。超出 sRGB 色域時，固定 L 與色相降低 chroma，直到落回色域 */
export function oklchToHex({ l, c, h }: Oklch): string {
	const L = clamp(l, 0, 1);
	let C = Math.max(0, c);
	if (!lchInGamut(L, C, h)) C = maxChroma(L, h);
	return linearToHex(oklabToLinear(oklchToOklab({ l: L, c: C, h })));
}

/** 在 OKLab 中混色，等同 CSS 的 color-mix(in oklab, a t, b)；t 是 a 的比例（0–1） */
export function mixOklab(a: string, b: string, t: number): string {
	const pa = hexToOklab(a);
	const pb = hexToOklab(b);
	const w = clamp(t, 0, 1);
	return oklchToHex(oklabToOklch([pb[0] + (pa[0] - pb[0]) * w, pb[1] + (pa[1] - pb[1]) * w, pb[2] + (pa[2] - pb[2]) * w]));
}

// ---- HSV（選色器的飽和度／亮度方塊與色相滑桿） ----

export function hexToHsv(hex: string): Hsv {
	const [r, g, b] = hexToRgb(hex);
	const max = Math.max(r, g, b);
	const d = max - Math.min(r, g, b);
	let h = 0;
	if (d > 0) {
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h = (h * 60 + 360) % 360;
	}
	return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
	const hh = (((h % 360) + 360) % 360) / 60;
	const S = clamp(s, 0, 1);
	const V = clamp(v, 0, 1);
	const c = V * S;
	const x = c * (1 - Math.abs((hh % 2) - 1));
	const m = V - c;
	const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
	return rgbToHex([r + m, g + m, b + m]);
}

// ---- 對比與距離 ----

/** WCAG 相對亮度 */
export function relativeLuminance(hex: string): number {
	const [r, g, b] = hexToLinear(hex);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 對比（1–21） */
export function contrastRatio(a: string, b: string): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Machado, Oliveira & Fernandes (2009) 色盲模擬，severity 1.0，作用在 linear RGB。
// 常數與 dataviz 的 validate_palette.js 相同；ΔE 門檻是依這個模型校準的，不能換成其他模型。
const MACHADO: Record<CvdKind, readonly Rgb[]> = {
	protan: [
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	deutan: [
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	tritan: [
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
};

/** 色盲模擬：linear RGB → linear RGB（結果夾在 0–1，與驗證器相同） */
export function simulateCvd([r, g, b]: Rgb, kind: CvdKind): Rgb {
	const [m0, m1, m2] = MACHADO[kind];
	const row = (m: Rgb) => clamp(m[0] * r + m[1] * g + m[2] * b, 0, 1);
	return [row(m0), row(m1), row(m2)];
}

const labCache = new Map<string, Oklab>();
function labOf(hex: string, kind?: CvdKind): Oklab {
	const key = kind ? `${hex}|${kind}` : hex;
	let lab = labCache.get(key);
	if (!lab) {
		const lin = hexToLinear(hex);
		lab = linearToOklab(kind ? simulateCvd(lin, kind) : lin);
		if (labCache.size >= 4096) labCache.clear();
		labCache.set(key, lab);
	}
	return lab;
}

/** ΔE：OKLab 的歐氏距離 × 100（dataviz 的定義）。指定 kind 時，兩色先做色盲模擬再比較 */
export function deltaE(a: string, b: string, kind?: CvdKind): number {
	const pa = labOf(mustParse(a), kind);
	const pb = labOf(mustParse(b), kind);
	return 100 * Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

// ---- 科目色的顯示（subjectTone） ----

/** 深色模式的 L 對應：淺色的 0.43–0.77 線性對應到 0.55–0.67（範圍外先夾住），單調遞增 */
export function darkLightness(l: number): number {
	const [lo, hi] = LIGHT_BAND;
	const [dlo, dhi] = DARK_BAND;
	return dlo + ((clamp(l, lo, hi) - lo) / (hi - lo)) * (dhi - dlo);
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
		const dL = got.l < lo ? lo - got.l : got.l > hi ? hi - got.l : 0;
		const dC = colorful && got.c < CHROMA_FLOOR ? CHROMA_FLOOR - got.c : got.c > cMax ? cMax - got.c : 0;
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
	const ink = dark ? INK_ON_MARK.dark : INK_ON_MARK.light;
	return Object.freeze({
		mark,
		tint: `color-mix(in oklab, ${mark} ${dark ? 22 : 14}%, ${surface})`,
		ring: `color-mix(in oklab, ${mark} 35%, transparent)`,
		onMark: contrastRatio(WHITE, mark) >= contrastRatio(ink, mark) ? WHITE : ink,
	});
}

/** 「未分類」的 tone：兩種模式都是保留的灰色 */
export function neutralTone(dark: boolean, surface = 'var(--card)'): SubjectTone {
	return makeTone(NO_SUBJECT_COLOR, dark, surface);
}

const toneCache = new Map<string, SubjectTone>();

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
	const key = `${h}|${dark ? 'dark' : 'light'}|${surface}`;
	let tone = toneCache.get(key);
	if (!tone) {
		tone = makeTone(dark ? darkMark(h) : lightMark(h), dark, surface);
		if (toneCache.size >= 1024) toneCache.clear();
		toneCache.set(key, tone);
	}
	return tone;
}

// ---- 選色提醒與建議色 ----

/**
 * 兩個科目色實際顯示時的分辨度（ΔE）：normal 是一般視覺，cvd 是 protan／deutan 模擬中較小的值。
 * 指定 dark 時只算該模式的 mark；省略時淺色與深色都算，取較難分辨的那個模式。
 */
export function separation(a: string, b: string, dark?: boolean): { normal: number; cvd: number } {
	let normal = Infinity;
	let cvd = Infinity;
	for (const mode of dark === undefined ? [false, true] : [dark]) {
		const ma = subjectTone(a, mode).mark;
		const mb = subjectTone(b, mode).mark;
		normal = Math.min(normal, deltaE(ma, mb));
		for (const kind of CVD_WARNING_KINDS) cvd = Math.min(cvd, deltaE(ma, mb, kind));
	}
	return { normal, cvd };
}

type Modes = 'both' | 'light' | 'dark';
type Issue = { kind: 'gray' } | { kind: 'same' | 'close'; name: string; modes: Modes };

/** 檢查在哪些模式下成立；兩種模式都不成立回傳 null */
function failingModes(test: (dark: boolean) => boolean): Modes | null {
	const light = test(false);
	const dark = test(true);
	return light && dark ? 'both' : light ? 'light' : dark ? 'dark' : null;
}

const RECOMMENDED_HEXES = new Set<string>(RECOMMENDED.map((c) => c.hex));

function assess(self: string, others: readonly NamedColor[], neighbors: readonly NamedColor[]): Issue[] {
	const issues: Issue[] = [];
	if (hexToOklch(self).c < CHROMA_FLOOR) issues.push({ kind: 'gray' });
	// 同一個科目可能同時出現在 others 與 neighbors：「幾乎一樣」優先，每個科目只提醒一次
	const flagged = new Set<string>();
	for (const o of [...others, ...neighbors]) {
		const hex = parseHex(o.hex);
		const key = `${o.name}\u0000${hex}`;
		if (!hex || flagged.has(key)) continue;
		// 推薦色是 dataviz 驗證過的一組（依固定順序相鄰時可分辨），彼此不提醒「幾乎一樣」；
		// 例如橘↔紅在淺色只差 ΔE 7.1，照預設指派時不應該跳出提醒。相鄰時仍然會檢查。
		if (hex !== self && RECOMMENDED_HEXES.has(hex) && RECOMMENDED_HEXES.has(self)) continue;
		// 淺色看選的顏色本身（ΔE < 8）；深色模式刻意把 L 壓進 0.55–0.67，距離普遍變小，改用 ΔE < 5 的門檻，
		// 只在深色分不出來時加上「深色模式下」。
		const modes: Modes | null =
			separation(self, hex, false).normal < SAME_MAX_DELTA_E
				? 'both'
				: separation(self, hex, true).normal < DARK_SAME_MAX_DELTA_E
					? 'dark'
					: null;
		if (modes) {
			flagged.add(key);
			issues.push({ kind: 'same', name: o.name, modes });
		}
	}
	for (const n of neighbors) {
		const hex = parseHex(n.hex);
		const key = `${n.name}\u0000${hex}`;
		if (!hex || flagged.has(key)) continue;
		const modes = failingModes((dark) => {
			const s = separation(self, hex, dark);
			return s.normal < NEIGHBOR_MIN_DELTA_E || s.cvd < CVD_MIN_DELTA_E;
		});
		if (modes) {
			flagged.add(key);
			issues.push({ kind: 'close', name: n.name, modes });
		}
	}
	return issues;
}

const MODE_PREFIX: Record<Modes, string> = { both: '', light: '淺色模式下', dark: '深色模式下' };

/**
 * 選色提醒（只提醒、不阻擋），回傳 zh-TW 訊息。
 * - others：其他所有科目；neighbors：圖表中相鄰的科目（列表順序的前一個和後一個）。
 * - 觸發條件：
 *   - 偏灰：選的顏色 C < 0.10。
 *   - 幾乎一樣：和任何科目的淺色 mark ΔE < 8；或深色 mark ΔE < 5（訊息加上「深色模式下」）。推薦色彼此除外。
 *   - 很接近：和相鄰科目 ΔE < 15，或色盲模擬（protan／deutan）ΔE < 8。淺色與深色的 mark 分別計算，
 *     只有一種模式有問題時，訊息加上「深色模式下」「淺色模式下」。
 * - 每個科目最多一則訊息，「幾乎一樣」優先。
 */
export function colorWarnings(hex: string, others: readonly NamedColor[], neighbors: readonly NamedColor[] = []): string[] {
	const self = parseHex(hex);
	if (!self) return [];
	return assess(self, others, neighbors).map((i) =>
		i.kind === 'gray'
			? '顏色偏灰，圖表中容易和「未分類」混淆'
			: i.kind === 'same'
				? `${MODE_PREFIX[i.modes]}和「${i.name}」幾乎一樣`
				: `${MODE_PREFIX[i.modes]}和「${i.name}」很接近，統計圖中不易分辨`,
	);
}

const ISSUE_WEIGHT: Record<Issue['kind'], number> = { gray: 1, close: 2, same: 4 };

/**
 * 建議色用的「接近」：OKLCH 的 ΔL、ΔC，加上加倍計算的色相差 ΔH（×100）。
 * 單純的 ΔE 會把「藍（中）」的建議排成「紫（中）」（9.7）而不是「藍（明）」（10.1）；
 * 加重色相後，建議會優先保留使用者選的色相，只調整深淺。
 */
function intentDistance(a: string, b: string): number {
	const p = hexToOklch(a);
	const q = hexToOklch(b);
	const dh = ((p.h - q.h + 540) % 360) - 180;
	const dH = 2 * Math.sqrt(p.c * q.c) * Math.sin((dh * Math.PI) / 360);
	return 100 * Math.hypot(p.l - q.l, p.c - q.c, 2 * dH);
}

/**
 * 建議色：從「更多顏色」的 40 色中，挑出在淺色與深色模式下都通過所有檢查（和 colorWarnings 相同，
 * 包含深色的「幾乎一樣」）、而且最接近 hex 的顏色（不會回傳 hex 本身）。
 * - used：其他科目的顏色。
 * - neighbors：圖表中相鄰科目的顏色；省略時把所有 used 都當成相鄰（最嚴格）。
 * - 「接近」優先保留色相（見 intentDistance）。
 * 科目很多、沒有顏色能通過全部檢查時，退而求其次：取問題最少（「幾乎一樣」最嚴重）的顏色中最接近的。
 */
export function suggestColor(hex: string, used: readonly string[], neighbors: readonly string[] = used): string {
	const target = parseHex(hex) ?? NO_SUBJECT_COLOR;
	// 以色碼當名稱：同一個顏色同時在 used 與 neighbors 時只算一次
	const named = (list: readonly string[]) =>
		list.flatMap((h) => {
			const p = parseHex(h);
			return p ? [{ name: p, hex: p }] : [];
		});
	const others = named(used);
	const near = named(neighbors);
	let best = PALETTE[2][7];
	let bestScore = Infinity;
	let bestDist = Infinity;
	for (const row of PALETTE) {
		for (const candidate of row) {
			if (candidate === target) continue;
			const score = assess(candidate, others, near).reduce((sum, i) => sum + ISSUE_WEIGHT[i.kind], 0);
			const dist = intentDistance(candidate, target);
			if (score < bestScore || (score === bestScore && dist < bestDist)) {
				best = candidate;
				bestScore = score;
				bestDist = dist;
			}
		}
	}
	return best;
}

/** 顯示用名稱：色盤顏色用 zh-TW 名稱（「藍」「藍（中）」），其他顏色顯示「自訂 #RRGGBB」 */
export function colorLabel(hex: string): string {
	const h = parseHex(hex);
	if (!h) return '無效的顏色';
	return colorName(h) ?? `自訂 ${h.toUpperCase()}`;
}
