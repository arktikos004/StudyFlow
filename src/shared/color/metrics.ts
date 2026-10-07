import { clamp, hexToLinear, linearToOklab, mustParse, type Oklab, type Rgb } from './convert';

// 顏色之間的對比與距離：WCAG 對比、色盲模擬、ΔE。
// ΔE 與色盲模擬移植自 dataviz skill 的 validate_palette.js，常數一致，算出來的數字可以直接和驗證器的報告對照。

export type CvdKind = 'protan' | 'deutan' | 'tritan';

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

/** 換算結果的快取上限：超過就整批清除 */
const LAB_CACHE_MAX = 4096;
const labCache = new Map<string, Oklab>();
function labOf(hex: string, kind?: CvdKind): Oklab {
	const key = kind ? `${hex}|${kind}` : hex;
	let lab = labCache.get(key);
	if (!lab) {
		const lin = hexToLinear(hex);
		lab = linearToOklab(kind ? simulateCvd(lin, kind) : lin);
		if (labCache.size >= LAB_CACHE_MAX) labCache.clear();
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
