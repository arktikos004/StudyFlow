import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateRange, firstGrapheme } from '../src/react-app/lib/polish-format';

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
		vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined });
		expect(firstGrapheme('𠮷野家')).toBe('𠮷');
		expect(firstGrapheme('資料結構')).toBe('資');
		expect(firstGrapheme('😀 英文')).toBe('😀');
	});
});

describe('dateRange', () => {
	it('用「至」連接，不用破折號', () => {
		expect(dateRange('9/7（一）', '10/6（二）')).toBe('9/7（一）至 10/6（二）');
		expect(dateRange('10/5', '10/11')).toBe('10/5 至 10/11');
		expect(dateRange('2025/12/29（一）', '2026/1/4（日）')).not.toMatch(/[–—~-]/);
	});
});
