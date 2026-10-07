import { colorName, NO_SUBJECT_COLOR, PALETTE, RECOMMENDED } from '../palette';
import { hexToOklch, parseHex } from './convert';
import { deltaE, type CvdKind } from './metrics';
import { CHROMA_FLOOR, subjectTone } from './subject-tone';

// 選色時的提醒與建議色（只提醒、不阻擋），以及顏色的顯示名稱。

export type NamedColor = { name: string; hex: string };

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

/** 兩個科目色在某個模式下實際顯示時的分辨度（ΔE）：normal 是一般視覺，cvd 是 protan／deutan 模擬中較小的值 */
export function separation(a: string, b: string, dark: boolean): { normal: number; cvd: number } {
	const markA = subjectTone(a, dark).mark;
	const markB = subjectTone(b, dark).mark;
	return {
		normal: deltaE(markA, markB),
		cvd: Math.min(...CVD_WARNING_KINDS.map((kind) => deltaE(markA, markB, kind))),
	};
}

type Modes = 'both' | 'light' | 'dark';
type Issue = { kind: 'gray' } | { kind: 'same' | 'close'; name: string; modes: Modes };

/** 檢查在哪些模式下成立；兩種模式都不成立回傳 null */
function failingModes(test: (dark: boolean) => boolean): Modes | null {
	const light = test(false);
	const dark = test(true);
	if (light && dark) return 'both';
	if (light) return 'light';
	return dark ? 'dark' : null;
}

/**
 * 「幾乎一樣」在哪些模式成立：淺色看選的顏色本身（ΔE < 8）；深色模式刻意把 L 壓進 0.55–0.67，距離普遍變小，
 * 改用 ΔE < 5 的門檻，只在深色分不出來時回傳 'dark'（訊息會加上「深色模式下」）。
 */
function sameInModes(a: string, b: string): Modes | null {
	if (separation(a, b, false).normal < SAME_MAX_DELTA_E) return 'both';
	if (separation(a, b, true).normal < DARK_SAME_MAX_DELTA_E) return 'dark';
	return null;
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
		const modes = sameInModes(self, hex);
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

function issueMessage(issue: Issue): string {
	switch (issue.kind) {
		case 'gray':
			return '顏色偏灰，圖表中容易和「未分類」混淆';
		case 'same':
			return `${MODE_PREFIX[issue.modes]}和「${issue.name}」幾乎一樣`;
		case 'close':
			return `${MODE_PREFIX[issue.modes]}和「${issue.name}」很接近，統計圖中不易分辨`;
	}
}

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
	return assess(self, others, neighbors).map(issueMessage);
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

/** 每個候選色都有問題、而且分數相同時的起點：「藍（中）」 */
const FALLBACK_SUGGESTION = PALETTE[2][7];

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
	let best = FALLBACK_SUGGESTION;
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
