import { describe, expect, it } from 'vitest';
import { addDays, diffDays, localDate, startOfLocalDay, weekStart } from '../src/shared/dates';
import { streaks } from '../src/worker/lib/stats';
import { logSession, noonClient, registeredClient } from './helpers';

const TZ = 'Asia/Taipei';

describe('日期工具', () => {
	it('依時區換算本地日期', () => {
		// 2026-01-01 20:00 UTC = 台北 2026-01-02 04:00
		const ts = Date.UTC(2026, 0, 1, 20);
		expect(localDate(ts, TZ)).toBe('2026-01-02');
		expect(localDate(ts, 'UTC')).toBe('2026-01-01');
	});

	it('本地午夜的 epoch 時間（含夏令時間地區）', () => {
		expect(startOfLocalDay('2026-03-15', TZ)).toBe(Date.UTC(2026, 2, 14, 16));
		// 紐約 2026-03-08 凌晨切換夏令時間，當天 00:00 仍是 UTC-5
		expect(startOfLocalDay('2026-03-08', 'America/New_York')).toBe(Date.UTC(2026, 2, 8, 5));
		expect(startOfLocalDay('2026-03-09', 'America/New_York')).toBe(Date.UTC(2026, 2, 9, 4));
	});

	it('日期加減、週一、跨月跨年', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
		expect(diffDays('2026-09-29', '2026-10-09')).toBe(10);
		expect(weekStart('2026-09-27')).toBe('2026-09-21'); // 週日 → 同一週的週一
		expect(weekStart('2026-09-28')).toBe('2026-09-28');
	});

	it('連續學習天數：今天還沒讀從昨天算起', () => {
		const t = '2026-09-29';
		const days = new Set(['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']);
		expect(streaks(days, t)).toEqual({ current: 3, longest: 4 });
		days.add(t);
		expect(streaks(days, t).current).toBe(4);
		expect(streaks(new Set(['2026-09-20']), t).current).toBe(0);
	});
});

describe('統計 API', () => {
	it('依日期與科目加總學習時間，並計算任務與錯題數據', async () => {
		// 使用者的時區是「現在剛好是當地中午」：今天早上一定有空檔，不管幾點跑，今天的紀錄都不會落到昨天
		const c = await noonClient();
		const math = (await c.post('/api/subjects', { name: '微積分', color: '#2a78d6' })).data.subject;
		const todayStr = c.today;
		const y = addDays(todayStr, -1);

		// 今天 30 分鐘（微積分）、昨天 60 分鐘（無科目）
		await logSession(c, todayStr, 8, 30, { subjectId: math.id });
		await logSession(c, y, 10, 60);

		await c.post('/api/tasks', { title: '今天到期', dueDate: todayStr, status: 'done' });
		await c.post('/api/tasks', { title: '逾期', dueDate: addDays(todayStr, -2) });
		await c.post('/api/notes', { kind: 'mistake', title: '錯題' });

		const s = (await c.get('/api/stats?days=7')).data;
		expect(s.range).toEqual({ from: addDays(todayStr, -6), to: todayStr, days: 7 });
		expect(s.daily).toHaveLength(7);
		expect(s.totals).toMatchObject({ minutes: 90, sessions: 2, activeDays: 2 });
		expect(s.totals.currentStreak).toBeGreaterThanOrEqual(2);
		expect(s.daily.at(-1)).toMatchObject({ date: todayStr, minutes: 30, bySubject: { [math.id]: 30 } });
		expect(s.daily.at(-2)).toMatchObject({ date: y, minutes: 60, bySubject: { none: 60 } });
		expect(s.bySubject[0]).toEqual({ subjectId: null, minutes: 60 });
		expect(s.tasks).toEqual({ total: 2, done: 1, overdue: 1 });
		expect(s.mistakes).toMatchObject({ total: 1, mastered: 0 });
		expect(s.heatmap.at(-1).date).toBe(todayStr);
		expect(diffDays(s.heatmap[0].date, todayStr)).toBeGreaterThanOrEqual(16 * 7 - 1);
		expect(s.weekly.reduce((n: number, w: { due: number }) => n + w.due, 0)).toBe(2);

		const dash = (await c.get('/api/dashboard')).data;
		expect(dash).toMatchObject({ today: todayStr, todayMinutes: 30, openTaskCount: 1 });
		expect(dash.focusTasks.map((t: { title: string }) => t.title)).toEqual(['逾期']);
	});

	it('拒絕不支援的統計區間', async () => {
		const c = await registeredClient();
		expect((await c.get('/api/stats?days=365')).status).toBe(400);
	});
});
