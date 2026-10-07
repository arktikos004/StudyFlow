import { describe, expect, it } from 'vitest';
import { countdownState, eventsSummary } from '../src/react-app/lib/notes-exams';

describe('考試頁的倒數磚', () => {
	const tz = 'Asia/Taipei';
	/** 台北時間的時間點 */
	const at = (date: string, hhmm: string) => {
		const [y, m, d] = date.split('-').map(Number);
		const [hh, mm] = hhmm.split(':').map(Number);
		return Date.UTC(y, m - 1, d, hh - 8, mm);
	};

	it('3 天內的考試是 urgent（紅色），第 4 天起不是；截止日只有當天是 today', () => {
		const now = at('2026-10-06', '08:00');
		expect(countdownState({ kind: 'exam', date: '2026-10-09', time: null }, '2026-10-06', now, tz)).toMatchObject({
			tone: 'urgent',
			days: 3,
			label: '天後',
		});
		expect(countdownState({ kind: 'exam', date: '2026-10-10', time: null }, '2026-10-06', now, tz)).toMatchObject({
			tone: 'normal',
			days: 4,
		});
		expect(countdownState({ kind: 'deadline', date: '2026-10-07', time: null }, '2026-10-06', now, tz).tone).toBe('normal');
		expect(countdownState({ kind: 'deadline', date: '2026-10-06', time: null }, '2026-10-06', now, tz)).toMatchObject({
			tone: 'today',
			label: '今天截止',
		});
	});

	it('24 小時內而且有時間：即時倒數（依使用者時區解讀考試時間）', () => {
		const now = at('2026-10-06', '20:00');
		const s = countdownState({ kind: 'exam', date: '2026-10-07', time: '09:00' }, '2026-10-06', now, tz);
		expect(s).toMatchObject({ tone: 'urgent', days: 1, label: '後開始' });
		expect(s.secondsLeft).toBe(13 * 3600);
		// 超過 24 小時：顯示天數
		expect(countdownState({ kind: 'exam', date: '2026-10-08', time: '09:00' }, '2026-10-06', now, tz).secondsLeft).toBeNull();
		// 同一個 UTC 時間點，換成紐約時區解讀 09:00 就不在 24 小時內
		expect(
			countdownState({ kind: 'exam', date: '2026-10-07', time: '09:00' }, '2026-10-06', now, 'America/New_York').secondsLeft,
		).toBeNull();
	});

	it('剛好 24 小時不算即時倒數；跨午夜仍依實際剩餘時間', () => {
		const exam = { kind: 'exam', date: '2026-10-07', time: '09:00' } as const;
		expect(countdownState(exam, '2026-10-06', at('2026-10-06', '09:00'), tz).secondsLeft).toBeNull();
		expect(countdownState(exam, '2026-10-06', at('2026-10-06', '09:01'), tz).secondsLeft).toBe(24 * 3600 - 60);
		// 23:30 看隔天 00:30 的考試：明天（days 1）、還剩 1 小時
		const midnight = { kind: 'exam', date: '2026-10-07', time: '00:30' } as const;
		expect(countdownState(midnight, '2026-10-06', at('2026-10-06', '23:30'), tz)).toMatchObject({
			days: 1,
			secondsLeft: 3600,
			tone: 'urgent',
			label: '後開始',
		});
	});

	it('夏令時間結束當天：用實際經過的時間，不是牆上時間', () => {
		// 紐約 2026-11-01 02:00 撥回 01:00；11/1 09:00 EST = 14:00 UTC
		const ny = 'America/New_York';
		const exam = { kind: 'exam', date: '2026-11-01', time: '09:00' } as const;
		// 10/31 10:00 EDT（14:00 UTC）：牆上差 23 小時，實際剛好 24 小時
		expect(countdownState(exam, '2026-10-31', Date.UTC(2026, 9, 31, 14, 0), ny).secondsLeft).toBeNull();
		// 10/31 10:30 EDT（14:30 UTC）：實際還剩 23.5 小時
		expect(countdownState(exam, '2026-10-31', Date.UTC(2026, 9, 31, 14, 30), ny).secondsLeft).toBe(23.5 * 3600);
	});

	it('今天已經開始、沒有時間、已經過去', () => {
		const now = at('2026-10-06', '10:00');
		expect(countdownState({ kind: 'exam', date: '2026-10-06', time: '09:00' }, '2026-10-06', now, tz).label).toBe('已開始');
		expect(countdownState({ kind: 'deadline', date: '2026-10-06', time: '09:00' }, '2026-10-06', now, tz).label).toBe('已截止');
		expect(countdownState({ kind: 'exam', date: '2026-10-06', time: null }, '2026-10-06', now, tz).label).toBe('考試日');
		expect(countdownState({ kind: 'exam', date: '2026-10-01', time: null }, '2026-10-06', now, tz)).toMatchObject({
			tone: 'past',
			days: -5,
			label: '天前',
		});
	});

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
