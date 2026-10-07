import { describe, expect, it } from 'vitest';
import { registeredClient } from './helpers';

describe('考試與截止日列表的日期區間', () => {
	it('from／to 含頭尾、依日期排序；只給一邊時另一邊不限，都不給時全部列出', async () => {
		const c = await registeredClient();
		const dates = ['2026-11-01', '2026-11-02', '2026-11-05', '2026-11-06'];
		for (const date of dates) {
			const res = await c.post('/api/events', { kind: 'exam', title: `考試 ${date}`, date });
			expect(res.status, JSON.stringify(res.data)).toBe(201);
		}
		const datesOf = async (query: string) => (await c.get(`/api/events${query}`)).data.events.map((e: { date: string }) => e.date);
		expect(await datesOf('?from=2026-11-02&to=2026-11-05')).toEqual(['2026-11-02', '2026-11-05']);
		expect(await datesOf('?from=2026-11-05')).toEqual(['2026-11-05', '2026-11-06']);
		expect(await datesOf('?to=2026-11-01')).toEqual(['2026-11-01']);
		expect(await datesOf('')).toEqual(dates);
	});
});
