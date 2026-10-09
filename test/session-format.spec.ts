import { describe, expect, it } from 'vitest';
import { sessionRowLabel } from '../src/react-app/lib/session-format';

describe('學習紀錄列的報讀（sessionRowLabel）', () => {
	// 台北 09:00–09:25
	const session = {
		startedAt: Date.UTC(2026, 9, 9, 1, 0),
		endedAt: Date.UTC(2026, 9, 9, 1, 25),
		mode: 'pomodoro' as const,
		durationSec: 1500,
	};

	it('時段、科目、方式、時間；時段依使用者時區', () => {
		expect(sessionRowLabel(session, '物理', 'Asia/Taipei')).toBe('編輯學習紀錄：09:00–09:25，物理，番茄鐘，25 分鐘');
		expect(sessionRowLabel(session, '物理', 'America/New_York')).toBe('編輯學習紀錄：21:00–21:25，物理，番茄鐘，25 分鐘');
	});

	it('沒有科目念「未分類」', () => {
		expect(sessionRowLabel({ ...session, mode: 'manual' }, undefined, 'Asia/Taipei')).toBe(
			'編輯學習紀錄：09:00–09:25，未分類，手動補登，25 分鐘',
		);
	});
});
