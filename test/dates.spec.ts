import { describe, expect, it } from 'vitest';
import { formatterCacheSize, localDate, localDateTime, startOfLocalDay, zonedTime } from '../src/shared/dates';
import { HOUR_MS, MINUTE_MS } from '../src/shared/time';

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

describe('localDateTime', () => {
	it('輸出 YYYY-MM-DD HH:mm，和逐欄組合的結果完全相同', () => {
		const partsFormat = new Map<string, Intl.DateTimeFormat>();
		const reference = (ms: number, timeZone: string) => {
			let f = partsFormat.get(timeZone);
			if (!f) {
				f = new Intl.DateTimeFormat('en-US', {
					timeZone,
					hourCycle: 'h23',
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
				});
				partsFormat.set(timeZone, f);
			}
			const parts = f.formatToParts(ms);
			const get = (t: string) => parts.find((p) => p.type === t)!.value;
			return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
		};
		// 一整年、每 7 小時 13 分取一個時間點，涵蓋午夜、夏令時間與非整點偏移的時區
		for (const tz of ['Asia/Taipei', 'America/New_York', 'Europe/Berlin', 'Asia/Kolkata', 'Pacific/Chatham', 'UTC']) {
			for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1); ms += 7 * HOUR_MS + 13 * MINUTE_MS) {
				expect(localDateTime(ms, tz)).toBe(reference(ms, tz));
			}
		}
		// 午夜是 00:00，不是 24:00
		expect(localDateTime(Date.UTC(2026, 0, 15, 16, 0), 'Asia/Taipei')).toBe('2026-01-16 00:00');
	});
});

describe('zonedTime：夏令時間切換依 RFC 5545 §3.3.5 解讀', () => {
	it('一般的時間照常換算', () => {
		expect(zonedTime('2026-11-03', '09:10', 'Asia/Taipei')).toBe(Date.UTC(2026, 10, 3, 1, 10));
		expect(zonedTime('2026-03-08', '09:00', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 13)); // 已切換成 EDT
		expect(zonedTime('2026-03-08', '01:59', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 6, 59)); // 還是 EST
	});

	it('春季跳過、不存在的時間：用跳躍前的偏移', () => {
		// 紐約 02:00 EST 直接跳到 03:00 EDT：02:30 當成 02:30 EST = 07:30Z（牆上顯示 03:30）
		expect(zonedTime('2026-03-08', '02:30', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 7, 30));
		// 柏林 02:00 CET 直接跳到 03:00 CEST：02:30 當成 02:30 CET = 01:30Z，方向和紐約一致
		expect(zonedTime('2026-03-29', '02:30', 'Europe/Berlin')).toBe(Date.UTC(2026, 2, 29, 1, 30));
	});

	it('秋季重複出現的時間：取第一次出現', () => {
		// 紐約 01:30 會出現兩次（EDT、EST），取 EDT：05:30Z
		expect(zonedTime('2026-11-01', '01:30', 'America/New_York')).toBe(Date.UTC(2026, 10, 1, 5, 30));
	});
});

describe('startOfLocalDay：在午夜切換夏令時間的時區', () => {
	it('午夜不存在時，回傳那一天真正開始的瞬間，不會落到前一天', () => {
		// 智利 2026-09-06 00:00 直接跳到 01:00（UTC 04:00）
		const santiago = startOfLocalDay('2026-09-06', 'America/Santiago');
		expect(santiago).toBe(Date.UTC(2026, 8, 6, 4));
		expect(localDate(santiago, 'America/Santiago')).toBe('2026-09-06');
		expect(localDate(santiago - 1, 'America/Santiago')).toBe('2026-09-05');
		// 古巴 2026-03-08 00:00 直接跳到 01:00（UTC 05:00）
		const havana = startOfLocalDay('2026-03-08', 'America/Havana');
		expect(havana).toBe(Date.UTC(2026, 2, 8, 5));
		expect(localDate(havana, 'America/Havana')).toBe('2026-03-08');
		expect(localDate(havana - 1, 'America/Havana')).toBe('2026-03-07');
	});

	it('午夜調回時，回傳當天的 00:00', () => {
		// 智利 2026-04-05 03:00Z 從 00:00（−3）調回 04-04 23:00（−4），當天的 00:00 是 04:00Z
		expect(startOfLocalDay('2026-04-05', 'America/Santiago')).toBe(Date.UTC(2026, 3, 5, 4));
	});

	it('其他時區的結果不變', () => {
		expect(startOfLocalDay('2026-03-15', 'Asia/Taipei')).toBe(Date.UTC(2026, 2, 14, 16));
		expect(startOfLocalDay('2026-03-08', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 5));
		expect(startOfLocalDay('2026-03-09', 'America/New_York')).toBe(Date.UTC(2026, 2, 9, 4));
		expect(startOfLocalDay('2026-11-01', 'America/New_York')).toBe(Date.UTC(2026, 10, 1, 4));
	});
});
