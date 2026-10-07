import { afterEach, describe, expect, it, vi } from 'vitest';
import { firstGrapheme, formatDateForToday, formatRange, percent } from '../src/react-app/lib/format';

describe('firstGrapheme', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('一般文字：第一個字', () => {
		expect(firstGrapheme('資料結構')).toBe('資');
		expect(firstGrapheme('Calculus')).toBe('C');
		expect(firstGrapheme('  微積分')).toBe('微');
		expect(firstGrapheme('')).toBe('');
		expect(firstGrapheme('   ')).toBe('');
	});

	it('emoji 與組合字不會被切半', () => {
		// ZWJ 組合（家庭）、膚色、國旗、keycap
		expect(firstGrapheme('👨‍👩‍👧 家政')).toBe('👨‍👩‍👧');
		expect(firstGrapheme('👍🏽體育')).toBe('👍🏽');
		expect(firstGrapheme('🇹🇼 公民')).toBe('🇹🇼');
		expect(firstGrapheme('1️⃣ 第一單元')).toBe('1️⃣');
		// 組合用的重音符號（e + U+0301）
		expect(firstGrapheme('étude')).toBe('é');
		// 擴充區的漢字（代理對）
		expect(firstGrapheme('𠮷野家')).toBe('𠮷');
	});

	it('不支援 Intl.Segmenter 時退回以碼位切：代理對不會被切開', () => {
		// Intl 的成員不可列舉，展開運算子複製不到；用原型繼承保留其他成員，只拿掉 Segmenter
		vi.stubGlobal('Intl', Object.create(Intl, { Segmenter: { value: undefined } }));
		expect(firstGrapheme('𠮷野家')).toBe('𠮷');
		expect(firstGrapheme('資料結構')).toBe('資');
		expect(firstGrapheme('😀 英文')).toBe('😀');
	});
});

describe('formatRange', () => {
	it('用「至」連接，不用破折號', () => {
		expect(formatRange('9/7（一）', '10/6（二）')).toBe('9/7（一）至 10/6（二）');
		expect(formatRange('10/5', '10/11')).toBe('10/5 至 10/11');
		expect(formatRange('2025/12/29（一）', '2026/1/4（日）')).not.toMatch(/[–—~-]/);
	});
});

describe('formatDateForToday', () => {
	it('今年的日期不加年份，其他年份（往前或往後）加上年份', () => {
		expect(formatDateForToday('2026-10-07', '2026-01-01')).toBe('10/7（三）');
		expect(formatDateForToday('2025-12-31', '2026-01-01')).toBe('2025/12/31（三）');
		expect(formatDateForToday('2027-01-04', '2026-12-31')).toBe('2027/1/4（一）');
	});
});

describe('percent', () => {
	it('四捨五入到整數；分母是 0 時是 0（不是 NaN）', () => {
		expect(percent(1, 3)).toBe(33);
		expect(percent(2, 3)).toBe(67);
		expect(percent(5, 5)).toBe(100);
		expect(percent(0, 0)).toBe(0);
	});
});
