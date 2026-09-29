import { describe, expect, it } from 'vitest';
import {
	CHROMA_FLOOR,
	colorLabel,
	colorWarnings,
	contrastRatio,
	darkLightness,
	DARK_BAND,
	DARK_CHROMA_MAX,
	deltaE,
	hexToHsv,
	hexToOklch,
	hsvToHex,
	LIGHT_BAND,
	mixOklab,
	neutralTone,
	oklchToHex,
	parseHex,
	rgbToHex,
	subjectTone,
	suggestColor,
	TONE_SURFACES,
} from '../src/shared/color';
import { colorName, DARK_STEPS, NO_SUBJECT_COLOR, PALETTE, paletteIndex, RECOMMENDED } from '../src/shared/palette';
import { SUBJECT_COLORS } from '../src/shared/schemas';

// 8 位元量化（#rrggbb）造成的 OKLCH 誤差上限，只用在「逐一比較相鄰取樣」的單調性檢查
const QUANT = 0.002;
const GRID = PALETTE.flat();
const ALL = [...RECOMMENDED.map((c) => c.hex), ...GRID];
const hueDiff = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** 固定種子的亂數，讓抽樣測試每次結果相同 */
function seeded(seed: number) {
	let s = seed;
	return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

describe('色碼解析', () => {
	it('接受 #rgb、rgb、#rrggbb、rrggbb，不分大小寫、忽略前後空白，輸出小寫 #rrggbb', () => {
		expect(parseHex('#abc')).toBe('#aabbcc');
		expect(parseHex('ABC')).toBe('#aabbcc');
		expect(parseHex('  #396ED6 ')).toBe('#396ed6');
		expect(parseHex('396ed6')).toBe('#396ed6');
		expect(parseHex('　#396ed6　')).toBe('#396ed6');
		expect(parseHex('＃３９６ＥＤ６')).toBe('#396ed6');
	});

	it('拒絕格式錯誤的色碼', () => {
		for (const bad of ['', '#', '#12', '#1234', '#12345', '#1234567', '#ggg', 'blue', '#12 345', '##396ed6', 'rgb(0,0,0)'])
			expect(parseHex(bad), bad).toBeNull();
		expect(parseHex(null)).toBeNull();
		expect(parseHex(undefined)).toBeNull();
		expect(() => deltaE('#12345', '#000000')).toThrow(RangeError);
	});

	it('OKLCH 與 HSV 來回轉換不變', () => {
		for (const hex of ALL) {
			expect(oklchToHex(hexToOklch(hex))).toBe(hex);
			expect(hsvToHex(hexToHsv(hex))).toBe(hex);
		}
	});

	it('超出 sRGB 色域時只降低 chroma，L 與色相不變', () => {
		const target = { l: 0.7, c: 0.4, h: 150 };
		const got = hexToOklch(oklchToHex(target));
		expect(got.c).toBeLessThan(0.4);
		expect(got.l).toBeCloseTo(0.7, 2);
		expect(hueDiff(got.h, 150)).toBeLessThan(1.5);
	});
});

describe('對比與距離', () => {
	it('WCAG 對比：白對黑 = 21、同色 = 1', () => {
		expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10);
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
		expect(contrastRatio('#396ed6', '#396ed6')).toBe(1);
	});

	it('ΔE 與色盲模擬和 dataviz 驗證器一致（推薦色的相鄰配對）', () => {
		const light = RECOMMENDED.map((c) => c.hex);
		const dark = light.map((h) => subjectTone(h, true).mark);
		const worst = (pal: string[], kind?: 'protan' | 'deutan') => Math.min(...pal.slice(1).map((h, i) => deltaE(pal[i], h, kind)));
		const worstCvd = (pal: string[]) => Math.min(worst(pal, 'protan'), worst(pal, 'deutan'));
		// palette.md：worst adjacent CVD 9.1 light / 8.4 dark，normal-vision 19.6 light / 19.3 dark
		expect(worstCvd(light)).toBeCloseTo(9.1, 1);
		expect(worstCvd(dark)).toBeCloseTo(8.4, 1);
		expect(worst(light)).toBeCloseTo(19.6, 1);
		expect(worst(dark)).toBeCloseTo(19.3, 1);
		// 橘↔琥珀：一般視覺 13.7（palette.md 的 all-pairs 說明）；琥珀↔粉紅的 tritan 5.8
		expect(deltaE('#eb6834', '#eda100')).toBeCloseTo(13.7, 1);
		expect(deltaE('#eda100', '#e87ba4', 'tritan')).toBeCloseTo(5.8, 1);
	});
});

describe('色盤', () => {
	it('推薦色沿用 SUBJECT_COLORS 的順序與名稱', () => {
		expect(RECOMMENDED.map((c) => c.hex)).toEqual([...SUBJECT_COLORS]);
		expect(RECOMMENDED.map((c) => c.name)).toEqual(['藍', '橘', '青綠', '琥珀', '粉紅', '綠', '靛紫', '紅']);
	});

	it('更多顏色是 4 × 10、不重複的小寫 #rrggbb，名稱是「色相（色調）」', () => {
		expect(PALETTE).toHaveLength(4);
		for (const row of PALETTE) expect(row).toHaveLength(10);
		expect(new Set(ALL).size).toBe(48);
		for (const hex of GRID) expect(parseHex(hex)).toBe(hex);
		expect(colorName('#396ed6')).toBe('藍（中）');
		expect(colorName('#ff8a82')).toBe('紅（亮）');
		expect(colorName('#9a2068')).toBe('桃紅（深）');
		expect(colorName('#2a78d6')).toBe('藍');
		expect(colorName('#123456')).toBeUndefined();
		expect(paletteIndex('#396ed6')).toEqual({ tone: 2, hue: 7 });
		expect(colorLabel('#123456')).toBe('自訂 #123456');
	});
});

describe('subjectTone', () => {
	it('40 色色格：淺色 mark 就是原色，L 在 0.43–0.77、C ≥ 0.10', () => {
		for (const hex of GRID) {
			const mark = subjectTone(hex, false).mark;
			const { l, c } = hexToOklch(mark);
			expect(mark, hex).toBe(hex);
			expect(l, hex).toBeGreaterThanOrEqual(0.43);
			expect(l, hex).toBeLessThanOrEqual(0.77);
			expect(c, hex).toBeGreaterThanOrEqual(0.1);
		}
	});

	it('40 色色格：深色 mark 對深色卡片 #151924 的對比 ≥ 3:1', () => {
		expect(TONE_SURFACES.dark.card).toBe('#151924');
		for (const hex of GRID) expect(contrastRatio(subjectTone(hex, true).mark, '#151924'), hex).toBeGreaterThanOrEqual(3);
	});

	it('推薦色在深色模式用 DARK_STEPS，淺色模式用原色', () => {
		for (const { hex } of RECOMMENDED) {
			expect(subjectTone(hex, true).mark).toBe(DARK_STEPS[hex]);
			expect(subjectTone(hex, false).mark).toBe(hex);
		}
		expect(subjectTone('#2A78D6', true).mark).toBe('#3987e5');
	});

	it('淺色模式把範圍外的顏色夾進 L 0.43–0.77、C ≥ 0.10，色相不變', () => {
		const cases = ['#fff4b3', '#e0f7ff', '#0a1a4a', '#330000', '#004d4d', '#7a8595', '#00ffff'];
		for (const hex of cases) {
			const src = hexToOklch(hex);
			const got = hexToOklch(subjectTone(hex, false).mark);
			expect(got.l, hex).toBeGreaterThanOrEqual(LIGHT_BAND[0]);
			expect(got.l, hex).toBeLessThanOrEqual(LIGHT_BAND[1]);
			expect(got.c, hex).toBeGreaterThanOrEqual(CHROMA_FLOOR);
			expect(hueDiff(got.h, src.h), hex).toBeLessThan(3);
		}
		// 太亮的往下夾、太暗的往上夾
		expect(hexToOklch(subjectTone('#fff4b3', false).mark).l).toBeCloseTo(0.77, 2);
		expect(hexToOklch(subjectTone('#330000', false).mark).l).toBeCloseTo(0.43, 2);
	});

	it('深色模式把其他顏色的 L 對應到 0.55–0.67、C 夾在 0.10–0.16', () => {
		for (const hex of [...GRID, '#fff4b3', '#0a1a4a', '#ff0000', '#0000ff', '#00ffff', '#7a8595']) {
			const got = hexToOklch(subjectTone(hex, true).mark);
			expect(got.l, hex).toBeGreaterThanOrEqual(DARK_BAND[0]);
			expect(got.l, hex).toBeLessThanOrEqual(DARK_BAND[1]);
			expect(got.c, hex).toBeGreaterThanOrEqual(CHROMA_FLOOR);
			expect(got.c, hex).toBeLessThanOrEqual(DARK_CHROMA_MAX);
		}
		// 高彩度的紅：C 0.258 → 0.16，色相不變
		const red = hexToOklch(subjectTone('#ff0000', true).mark);
		expect(red.c).toBeCloseTo(0.16, 2);
		expect(hueDiff(red.h, hexToOklch('#ff0000').h)).toBeLessThan(2);
	});

	it('深色的 L 對應是單調遞增的', () => {
		expect(darkLightness(0.2)).toBe(0.55);
		expect(darkLightness(0.43)).toBeCloseTo(0.55, 10);
		expect(darkLightness(0.6)).toBeCloseTo(0.55 + (0.17 / 0.34) * 0.12, 10);
		expect(darkLightness(0.77)).toBeCloseTo(0.67, 10);
		expect(darkLightness(0.95)).toBe(0.67);
		for (let l = 0; l < 1; l += 0.01) expect(darkLightness(l + 0.01)).toBeGreaterThanOrEqual(darkLightness(l));
		// 實際的 mark（同一色相、同一 chroma，只改 L）
		for (const h of [30, 110, 200, 265, 330]) {
			let prev = 0;
			for (let l = 0.3; l <= 0.95; l += 0.05) {
				const got = hexToOklch(subjectTone(oklchToHex({ l, c: 0.12, h }), true).mark).l;
				expect(got, `h ${h} l ${l.toFixed(2)}`).toBeGreaterThanOrEqual(prev - QUANT);
				prev = got;
			}
		}
	});

	it('隨機抽樣：範圍保證在 8 位元量化後仍然成立', () => {
		const rand = seeded(20260929);
		for (let i = 0; i < 3000; i++) {
			const hex = rgbToHex([rand(), rand(), rand()]);
			const src = hexToOklch(hex);
			const light = hexToOklch(subjectTone(hex, false).mark);
			expect(light.l, hex).toBeGreaterThanOrEqual(0.43);
			expect(light.l, hex).toBeLessThanOrEqual(0.77);
			if (src.c >= 0.02) expect(light.c, hex).toBeGreaterThanOrEqual(0.1);
			if (DARK_STEPS[hex]) continue;
			const dark = hexToOklch(subjectTone(hex, true).mark);
			expect(dark.l, hex).toBeGreaterThanOrEqual(0.55);
			expect(dark.l, hex).toBeLessThanOrEqual(0.67);
			if (src.c >= 0.02) expect(dark.c, hex).toBeGreaterThanOrEqual(0.1);
			expect(dark.c, hex).toBeLessThanOrEqual(0.16);
		}
	});

	it('tint、ring、onMark', () => {
		const light = subjectTone('#396ed6', false);
		expect(light.tint).toBe('color-mix(in oklab, #396ed6 14%, var(--card))');
		expect(light.ring).toBe('color-mix(in oklab, #396ed6 35%, transparent)');
		expect(subjectTone('#396ed6', true).tint).toMatch(/^color-mix\(in oklab, #[0-9a-f]{6} 22%, var\(--card\)\)$/);
		expect(subjectTone('#396ed6', false, TONE_SURFACES.light.card).tint).toBe('color-mix(in oklab, #396ed6 14%, #fdfcfa)');
		// onMark：白或 ink，選對比較高的那個
		for (const hex of ALL)
			for (const dark of [false, true]) {
				const { mark, onMark } = subjectTone(hex, dark);
				const ink = dark ? '#0c0f18' : '#161d31';
				expect([ink, '#ffffff']).toContain(onMark);
				const other = onMark === ink ? '#ffffff' : ink;
				expect(contrastRatio(onMark, mark)).toBeGreaterThanOrEqual(contrastRatio(other, mark));
			}
		expect(subjectTone('#eda100', false).onMark).toBe('#161d31');
		expect(subjectTone('#4a3aa7', false).onMark).toBe('#ffffff');
	});

	it('chip 文字（ink）疊在 tint 上：48 色淺色 ≥ 12.9:1、深色 ≥ 11.2:1（DESIGN.md §3）', () => {
		for (const hex of ALL) {
			const light = mixOklab(subjectTone(hex, false).mark, TONE_SURFACES.light.card, 0.14);
			const dark = mixOklab(subjectTone(hex, true).mark, TONE_SURFACES.dark.card, 0.22);
			expect(contrastRatio(TONE_SURFACES.light.ink, light), hex).toBeGreaterThanOrEqual(12.9);
			expect(contrastRatio(TONE_SURFACES.dark.ink, dark), hex).toBeGreaterThanOrEqual(11.2);
		}
	});

	it('格式錯誤或保留的灰色回傳「未分類」的 tone', () => {
		expect(subjectTone('not-a-color', false)).toEqual(neutralTone(false));
		expect(subjectTone(NO_SUBJECT_COLOR, true).mark).toBe('#898781');
		expect(neutralTone(true).mark).toBe('#898781');
	});
});

describe('colorWarnings', () => {
	const rec = RECOMMENDED.map((c) => ({ name: c.name, hex: c.hex }));

	it('兩個幾乎一樣的顏色會產生提醒', () => {
		expect(colorWarnings('#2a78d6', [{ name: '微積分', hex: '#2b79d7' }])).toEqual(['和「微積分」幾乎一樣']);
		expect(colorWarnings('#396ed6', [{ name: '微積分', hex: '#2a78d6' }])).toEqual(['和「微積分」幾乎一樣']);
		expect(colorWarnings('#2a78d6', [{ name: '微積分', hex: '#2a78d6' }])).toEqual(['和「微積分」幾乎一樣']);
	});

	it('顏色偏灰會提醒', () => {
		expect(colorWarnings('#8a8f99', [])).toEqual(['顏色偏灰，圖表中容易和「未分類」混淆']);
	});

	it('和相鄰科目太接近會提醒；只有深色模式分不清時加上「深色模式下」', () => {
		expect(colorWarnings('#eb6834', [], [{ name: '英文', hex: '#eda100' }])).toEqual(['和「英文」很接近，統計圖中不易分辨']);
		expect(colorWarnings('#86b1ff', [], [{ name: '微積分', hex: '#2a78d6' }])).toEqual(['深色模式下和「微積分」很接近，統計圖中不易分辨']);
		// 不相鄰就只檢查「幾乎一樣」
		expect(colorWarnings('#86b1ff', [{ name: '微積分', hex: '#2a78d6' }], [])).toEqual([]);
	});

	it('同一個科目只提醒一次，「幾乎一樣」優先', () => {
		const calc = { name: '微積分', hex: '#2a78d6' };
		expect(colorWarnings('#2b79d7', [calc], [calc])).toEqual(['和「微積分」幾乎一樣']);
	});

	it('照預設順序指派的推薦色不會產生提醒', () => {
		for (let i = 0; i < rec.length; i++) {
			const others = rec.filter((_, j) => j !== i);
			const neighbors = [rec[i - 1], rec[i + 1]].filter((x) => x !== undefined);
			expect(colorWarnings(rec[i].hex, others, neighbors), rec[i].name).toEqual([]);
		}
	});

	it('格式錯誤的顏色不提醒', () => {
		expect(colorWarnings('#12', rec)).toEqual([]);
	});
});

describe('suggestColor', () => {
	const used = RECOMMENDED.map((c) => c.hex);

	it('從 40 色中挑出通過所有檢查、最接近而且保留色相的顏色', () => {
		const got = suggestColor('#396ed6', used, ['#e34948']);
		expect(got).toBe('#568ef9'); // 藍（明）
		const named = (list: string[]) => list.map((h) => ({ name: h, hex: h }));
		expect(colorWarnings(got, named(used), named(['#e34948']))).toEqual([]);
	});

	it('一定回傳色格裡的顏色，而且不是原本的顏色', () => {
		const rand = seeded(7);
		for (let i = 0; i < 30; i++) {
			const hex = rgbToHex([rand(), rand(), rand()]);
			const got = suggestColor(hex, used);
			expect(GRID).toContain(got);
			expect(got).not.toBe(hex);
		}
		expect(suggestColor('#396ed6', [])).not.toBe('#396ed6');
	});

	it('沒有其他科目時，灰色也會得到有彩度的建議', () => {
		expect(hexToOklch(suggestColor(NO_SUBJECT_COLOR, [])).c).toBeGreaterThanOrEqual(0.1);
	});
});
