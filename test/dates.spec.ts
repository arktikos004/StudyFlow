import { describe, expect, it } from 'vitest';
import { formatterCacheSize, localDate } from '../src/shared/dates';

/** 同一個時區名稱的各種大小寫寫法：asia/taipei、Asia/taipei、aSia/taipei… */
function caseVariants(name: string, limit: number) {
	const letters = [...name].map((ch, i) => (/[a-z]/i.test(ch) ? i : -1)).filter((i) => i >= 0);
	const out: string[] = [];
	for (let mask = 0; mask < 2 ** letters.length && out.length < limit; mask++) {
		const chars = [...name.toLowerCase()];
		letters.forEach((pos, bit) => {
			if (mask & (1 << bit)) chars[pos] = chars[pos].toUpperCase();
		});
		out.push(chars.join(''));
	}
	return out;
}

describe('Intl.DateTimeFormat 快取', () => {
	it('有上限：大量不同寫法的時區不會一直累積，換算結果仍然正確', () => {
		const variants = caseVariants('asia/taipei', 200);
		expect(new Set(variants).size).toBe(200);
		// 2026-01-01 20:00 UTC = 台北 2026-01-02
		for (const tz of variants) expect(localDate(Date.UTC(2026, 0, 1, 20), tz)).toBe('2026-01-02');
		expect(formatterCacheSize()).toBeLessThanOrEqual(64);
	});
});
