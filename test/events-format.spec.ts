import { describe, expect, it } from 'vitest';
import { eventsSummary } from '../src/react-app/lib/events-format';

describe('考試與截止日頁的文字', () => {
	it('頁首摘要：場數與最近的考試', () => {
		const today = '2026-10-06';
		expect(eventsSummary([], today)).toBe('目前沒有排定的考試或截止日');
		expect(
			eventsSummary(
				[
					{ kind: 'deadline', date: '2026-10-07' },
					{ kind: 'exam', date: '2026-10-11' },
					{ kind: 'exam', date: '2026-10-09' },
				],
				today,
			),
		).toBe('接下來有 2 場考試、1 個截止日，最近的考試在 3 天後');
		expect(eventsSummary([{ kind: 'exam', date: '2026-10-07' }], today)).toBe('接下來有 1 場考試，最近的考試在明天');
		expect(eventsSummary([{ kind: 'deadline', date: '2026-10-06' }], today)).toBe('接下來有 1 個截止日');
	});
});
