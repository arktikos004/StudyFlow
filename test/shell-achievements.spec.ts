import { describe, expect, it } from 'vitest';
import {
	achievementUnit,
	diffUnlocked,
	formatProgress,
	groupAchievements,
	nextMilestone,
	parseSeen,
	seenKey,
	unlockedDate,
} from '../src/react-app/lib/shell-achievements';

describe('成就：已看過的紀錄', () => {
	it('key 依使用者分開', () => {
		expect(seenKey('u1')).toBe('studyflow:achievements-seen:u1');
		expect(seenKey('u1')).not.toBe(seenKey('u2'));
	});

	it('沒有紀錄或格式不對時視為第一次使用（null）', () => {
		expect(parseSeen(null)).toBeNull();
		expect(parseSeen('')).toBeNull();
		expect(parseSeen('{not json')).toBeNull();
		expect(parseSeen('{"a":1}')).toBeNull();
		expect(parseSeen('[1,2]')).toBeNull();
		expect(parseSeen('["first-session"]')).toEqual(['first-session']);
		expect(parseSeen('[]')).toEqual([]);
	});

	it('第一次使用：靜默記下目前已解鎖的，不跳 toast', () => {
		expect(diffUnlocked(null, ['first-session', 'hours-10'])).toEqual({ announce: [], next: ['first-session', 'hours-10'] });
	});

	it('之後只對沒看過的跳 toast，紀錄累加', () => {
		expect(diffUnlocked(['first-session'], ['first-session', 'hours-10'])).toEqual({
			announce: ['hours-10'],
			next: ['first-session', 'hours-10'],
		});
		expect(diffUnlocked([], ['first-session'])).toEqual({ announce: ['first-session'], next: ['first-session'] });
	});

	it('徽章被收回後紀錄不刪除，再解鎖也不會再跳', () => {
		const revoked = diffUnlocked(['first-session', 'hours-10'], ['first-session']);
		expect(revoked).toEqual({ announce: [], next: ['first-session', 'hours-10'] });
		expect(diffUnlocked(revoked.next, ['first-session', 'hours-10'])).toEqual({ announce: [], next: ['first-session', 'hours-10'] });
	});
});

describe('成就：解鎖日期（PRO-2）', () => {
	const now = Date.UTC(2026, 9, 7, 4); // 台北 2026-10-07 12:00

	it('今年只顯示月日；依使用者時區換日', () => {
		// 2026-10-06 17:30Z：UTC 還是 10/6，台北已經是 10/7
		const t = Date.UTC(2026, 9, 6, 17, 30);
		expect(unlockedDate(t, 'Asia/Taipei', now)).toEqual({ text: '10 月 7 日', dateTime: '2026-10-07' });
		expect(unlockedDate(t, 'UTC', now)).toEqual({ text: '10 月 6 日', dateTime: '2026-10-06' });
	});

	it('不是今年時加上年份', () => {
		expect(unlockedDate(Date.UTC(2025, 11, 31, 4), 'Asia/Taipei', now)).toEqual({ text: '2025 年 12 月 31 日', dateTime: '2025-12-31' });
	});
});

describe('成就：顯示', () => {
	it('單位依 id 前綴判斷', () => {
		expect(achievementUnit('first-session')).toBe('次');
		expect(achievementUnit('hours-50')).toBe('小時');
		expect(achievementUnit('streak-7')).toBe('天');
		expect(achievementUnit('goal-streak-7')).toBe('天');
		expect(achievementUnit('pomodoro-25')).toBe('個');
		expect(achievementUnit('mastered-10')).toBe('題');
		expect(achievementUnit('tasks-50')).toBe('個');
		expect(achievementUnit('unknown')).toBe('');
	});

	it('進度數字：整數不帶小數，小時保留一位', () => {
		expect(formatProgress(3)).toBe('3');
		expect(formatProgress(9.9)).toBe('9.9');
		expect(formatProgress(0)).toBe('0');
	});

	it('分組保留原順序，不認得的 id 歸到「其他」', () => {
		const groups = groupAchievements([
			{ id: 'first-session' },
			{ id: 'streak-7' },
			{ id: 'hours-10' },
			{ id: 'new-thing' },
			{ id: 'tasks-50' },
		]);
		expect(groups.map((g) => [g.label, g.items.map((a) => a.id)])).toEqual([
			['讀書時數', ['first-session', 'hours-10']],
			['連續天數', ['streak-7']],
			['錯題與任務', ['tasks-50']],
			['其他', ['new-thing']],
		]);
	});

	it('下一個目標：未解鎖中完成比例最高的，同比例取前面的；全部解鎖時為 null', () => {
		const list = [
			{ id: 'a', unlocked: true, progress: 1, target: 1 },
			{ id: 'b', unlocked: false, progress: 2, target: 10 },
			{ id: 'c', unlocked: false, progress: 5, target: 10 },
			{ id: 'd', unlocked: false, progress: 1, target: 2 },
		];
		expect(nextMilestone(list)?.id).toBe('c');
		expect(nextMilestone([{ id: 'x', unlocked: false, progress: 0, target: 5 }])?.id).toBe('x');
		expect(nextMilestone([{ id: 'a', unlocked: true, progress: 1, target: 1 }])).toBeNull();
	});
});
