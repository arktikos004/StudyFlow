import { SUBJECT_COLORS } from './schemas';

// 科目色盤（DESIGN.md §3）：推薦 8 色＋更多顏色 10 色相 × 4 色調。
// 這裡只放資料與名稱查詢；色彩數學在 color.ts。色盤有改動時，必須用 dataviz skill 的
// validate_palette.js 重新驗證淺色與深色兩種模式。

export type RecommendedHex = (typeof SUBJECT_COLORS)[number];

const RECOMMENDED_NAMES = ['藍', '橘', '青綠', '琥珀', '粉紅', '綠', '靛紫', '紅'] as const;

/** 推薦色：色盲友善、順序固定（新科目依序指派），順序與 SUBJECT_COLORS 相同 */
export const RECOMMENDED: readonly { hex: RecommendedHex; name: string }[] = SUBJECT_COLORS.map((hex, i) => ({
	hex,
	name: RECOMMENDED_NAMES[i],
}));

/** 推薦色在深色模式使用的色階（dataviz 驗證過，不套用一般的深色換算） */
export const DARK_STEPS: Readonly<Record<string, string | undefined>> = {
	'#2a78d6': '#3987e5',
	'#eb6834': '#d95926',
	'#1baf7a': '#199e70',
	'#eda100': '#c98500',
	'#e87ba4': '#d55181',
	'#008300': '#008300',
	'#4a3aa7': '#9085e9',
	'#e34948': '#e66767',
} satisfies Record<RecommendedHex, string>;

/** 「更多顏色」的 10 個色相（色格的欄） */
export const PALETTE_HUES = ['紅', '橘', '琥珀', '草綠', '綠', '青', '天藍', '藍', '紫', '桃紅'] as const;

/** 「更多顏色」的 4 個色調（色格的列），由淺到深 */
export const PALETTE_TONES = ['亮', '明', '中', '深'] as const;

/** 更多顏色：PALETTE[色調][色相]，4 列 × 10 欄，照 DESIGN.md §3 的表逐字抄錄 */
export const PALETTE: readonly (readonly string[])[] = [
	['#ff8a82', '#ff8f4b', '#e2a500', '#99c336', '#4fce74', '#00cdb4', '#00c3f5', '#86b1ff', '#b89eff', '#fe7fc0'],
	['#e8605b', '#e16c10', '#bb8800', '#7ba200', '#24ae56', '#00aa95', '#00a1cb', '#568ef9', '#9b79ee', '#db5fa1'],
	['#c43f3e', '#b65400', '#966c00', '#628200', '#008c3f', '#008777', '#0081a3', '#396ed6', '#7e5acc', '#b94082'],
	['#a51e24', '#904100', '#7d5a00', '#4c6500', '#006e30', '#006f4f', '#00628c', '#1f53b8', '#653eae', '#9a2068'],
];

/** 保留給「未分類」的灰色，兩種模式相同；不提供給科目選用 */
export const NO_SUBJECT_COLOR = '#898781';

/** 新科目的預設色：下一個尚未使用的推薦色（依固定順序，不循環產生新色；全部用過時依科目數輪替） */
export function nextSubjectColor(used: readonly string[]): string {
	return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[used.length % SUBJECT_COLORS.length];
}

const NAMES = new Map<string, string>([
	...RECOMMENDED.map((c): [string, string] => [c.hex, c.name]),
	...PALETTE.flatMap((row, tone) => row.map((hex, hue): [string, string] => [hex, `${PALETTE_HUES[hue]}（${PALETTE_TONES[tone]}）`])),
	[NO_SUBJECT_COLOR, '灰（未分類）'],
]);

/**
 * 色盤顏色的 zh-TW 名稱：推薦色是「藍」，更多顏色是「藍（中）」。
 * 不在色盤裡的自訂顏色回傳 undefined（需要顯示用文字時用 color.ts 的 colorLabel）。
 */
export function colorName(hex: string): string | undefined {
	return NAMES.get(hex.trim().toLowerCase());
}

/** 顏色在「更多顏色」色格中的位置，不在色格裡回傳 null */
export function paletteIndex(hex: string): { tone: number; hue: number } | null {
	const h = hex.trim().toLowerCase();
	for (let tone = 0; tone < PALETTE.length; tone++) {
		const hue = PALETTE[tone].indexOf(h);
		if (hue >= 0) return { tone, hue };
	}
	return null;
}
