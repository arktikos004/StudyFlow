// 色彩空間的換算（DESIGN.md §3）：#rrggbb ↔ sRGB（0–1）↔ linear sRGB ↔ OKLab ↔ OKLCH，以及選色器用的 HSV。
// 純 TypeScript，不使用任何瀏覽器 API：前端與測試（workerd）共用。

export type Rgb = readonly [number, number, number];
export type Oklab = readonly [number, number, number];
/** l 0–1、c ≥ 0、h 0–360（度） */
export type Oklch = { l: number; c: number; h: number };
/** h 0–360（度）、s 0–1、v 0–1 */
export type Hsv = { h: number; s: number; v: number };

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

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

/** 解析色碼；格式錯誤會丟出 RangeError，避免 NaN 一路傳下去 */
export function mustParse(hex: string): string {
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
	// 色相每 60° 一個區段，各區段的 RGB 由 c、x、0 排列而成
	const sectors: readonly Rgb[] = [
		[c, x, 0],
		[x, c, 0],
		[0, c, x],
		[0, x, c],
		[x, 0, c],
		[c, 0, x],
	];
	const [r, g, b] = sectors[Math.floor(hh)];
	return rgbToHex([r + m, g + m, b + m]);
}
