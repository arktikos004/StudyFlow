import { describe, expect, it } from 'vitest';
import { subjectTone } from '../src/shared/color';
import { contrastRatio } from '../src/shared/color/metrics';
import { NO_SUBJECT_COLOR, PALETTE, RECOMMENDED } from '../src/shared/palette';

// 科目圖示方塊（SubjectIconTile）沒有圖示時顯示名稱的第一個字：19px 粗體是 WCAG 的大字，門檻 3:1。
// 這裡實際計算 onMark／mark 的對比，確認色盤 48 色 × 淺深色、「未分類」與任意自訂色都通過。

const LARGE_TEXT = 3;
const TEXT = 4.5;
const ALL = [...RECOMMENDED.map((c) => c.hex), ...PALETTE.flat()];

const ratio = (hex: string, dark: boolean) => {
	const { mark, onMark } = subjectTone(hex, dark);
	return contrastRatio(onMark, mark);
};

/** 固定種子的亂數，讓抽樣每次結果相同 */
function seeded(seed: number) {
	let s = seed;
	return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

describe('SubjectIconTile 的第一個字：onMark／mark 的對比', () => {
	it('色盤共有 48 色（8 個推薦色＋10 × 4 色格）', () => {
		expect(ALL).toHaveLength(48);
		expect(new Set(ALL).size).toBe(48);
	});

	it.each([
		['淺色', false],
		['深色', true],
	] as const)('%s：48 色全部 ≥ 3:1（大字）', (_name, dark) => {
		for (const hex of ALL) expect(ratio(hex, dark), hex).toBeGreaterThanOrEqual(LARGE_TEXT);
	});

	it('最低值與低於 4.5:1 的色數（所以第一個字要用大字）', () => {
		const stats = (dark: boolean) => {
			const ratios = ALL.map((hex) => ratio(hex, dark));
			return { min: Math.round(Math.min(...ratios) * 100) / 100, belowText: ratios.filter((r) => r < TEXT).length };
		};
		expect({ light: stats(false), dark: stats(true) }).toMatchInlineSnapshot(`
			{
			  "dark": {
			    "belowText": 8,
			    "min": 4.39,
			  },
			  "light": {
			    "belowText": 6,
			    "min": 4.24,
			  },
			}
		`);
	});

	it('「未分類」的灰色也 ≥ 3:1', () => {
		expect(ratio(NO_SUBJECT_COLOR, false)).toBeGreaterThanOrEqual(LARGE_TEXT);
		expect(ratio(NO_SUBJECT_COLOR, true)).toBeGreaterThanOrEqual(LARGE_TEXT);
	});

	it('任意自訂色（抽樣 4000 色，含黑、白、純色）在淺色與深色下都 ≥ 3:1', () => {
		const rand = seeded(20261006);
		const hex2 = () =>
			Math.floor(rand() * 256)
				.toString(16)
				.padStart(2, '0');
		const samples = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#808080'];
		for (let i = 0; i < 4000; i++) samples.push(`#${hex2()}${hex2()}${hex2()}`);
		let min = Infinity;
		for (const hex of samples) {
			for (const dark of [false, true]) {
				const r = ratio(hex, dark);
				min = Math.min(min, r);
				expect(r, `${hex} ${dark ? '深色' : '淺色'}`).toBeGreaterThanOrEqual(LARGE_TEXT);
			}
		}
		// 白字與深色字的對比在中間亮度交會，下限離 3:1 還有距離
		expect(min).toBeGreaterThan(4);
	});
});
