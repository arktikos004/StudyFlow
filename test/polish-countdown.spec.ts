import { describe, expect, it } from 'vitest';
import { zonedTime } from '../src/shared/dates';
import { countdown, countdownTone } from '../src/react-app/lib/countdown';

// 倒數磚（DESIGN.md §7「跨頁慣例」）：紅色只給 3 天內的考試；截止日與任務期限 3 天內是 warning；
// 文案統一「今天」「明天」「N 天後」「已結束」，不用「還有 N 天」「D-N」。

const tz = 'Asia/Taipei';
const today = '2026-10-06';
const at = (date: string, time: string) => zonedTime(date, time, tz);
const morning = at(today, '08:00');

describe('countdownTone', () => {
	it('考試：3 天內（含今天）紅色，之後中性，過去淡化', () => {
		expect([0, 1, 2, 3, 4, -1].map((d) => countdownTone('exam', d))).toEqual(['urgent', 'urgent', 'urgent', 'urgent', 'normal', 'past']);
	});

	it('截止日與任務期限：3 天內是 warning，不用紅色', () => {
		for (const kind of ['deadline', 'task'] as const) {
			expect([0, 1, 3, 4, -2].map((d) => countdownTone(kind, d))).toEqual(['soon', 'soon', 'soon', 'normal', 'past']);
		}
	});
});

describe('countdown 的文案', () => {
	it('今天、明天、N 天後、已結束', () => {
		const text = (date: string, kind: 'exam' | 'deadline' = 'exam') => countdown({ kind, date }, today, morning, tz).text;
		expect(text('2026-10-06')).toBe('今天');
		expect(text('2026-10-07')).toBe('明天');
		expect(text('2026-10-10')).toBe('4 天後');
		expect(text('2026-10-01')).toBe('已結束');
		// 不會出現舊的寫法
		for (const date of ['2026-10-06', '2026-10-07', '2026-10-09', '2026-10-20', '2026-09-30'])
			for (const kind of ['exam', 'deadline'] as const) expect(text(date, kind)).not.toMatch(/還有|D[-+]|D-Day|已過|天前/);
	});

	it('大磚：數字＋「天後」；今天、明天、已結束用文字', () => {
		expect(countdown({ kind: 'exam', date: '2026-10-12' }, today, morning, tz)).toMatchObject({ value: 6, label: '天後', tone: 'normal' });
		expect(countdown({ kind: 'exam', date: '2026-10-06' }, today, morning, tz)).toMatchObject({ value: '今天', label: '考試日', tone: 'urgent' });
		expect(countdown({ kind: 'deadline', date: '2026-10-06' }, today, morning, tz)).toMatchObject({ value: '今天', label: '截止日', tone: 'soon' });
		expect(countdown({ kind: 'deadline', date: '2026-10-07' }, today, morning, tz)).toMatchObject({ value: '明天', label: '截止', tone: 'soon' });
		expect(countdown({ kind: 'exam', date: '2026-10-07', time: '13:00' }, today, morning, tz)).toMatchObject({ value: '明天', label: '13:00' });
		expect(countdown({ kind: 'exam', date: '2026-10-02' }, today, morning, tz)).toMatchObject({ value: '已結束', label: null, tone: 'past' });
	});

	it('24 小時內而且有時間：即時倒數（後開始、後截止），開始後是「已開始」「已截止」', () => {
		expect(countdown({ kind: 'exam', date: today, time: '09:00' }, today, morning, tz)).toMatchObject({ secondsLeft: 3600, label: '後開始' });
		expect(countdown({ kind: 'deadline', date: '2026-10-07', time: '07:00' }, today, morning, tz)).toMatchObject({ secondsLeft: 23 * 3600, label: '後截止' });
		// 明天比現在晚超過 24 小時：不倒數，顯示「明天」
		expect(countdown({ kind: 'exam', date: '2026-10-07', time: '09:00' }, today, morning, tz).secondsLeft).toBeNull();
		expect(countdown({ kind: 'exam', date: today, time: '07:00' }, today, morning, tz)).toMatchObject({ secondsLeft: null, label: '已開始' });
		expect(countdown({ kind: 'deadline', date: today, time: '07:00' }, today, morning, tz)).toMatchObject({ secondsLeft: null, label: '已截止' });
	});

	it('時間依使用者時區：同一個瞬間，台北已經過了開始時間，紐約還沒', () => {
		const now = Date.UTC(2026, 9, 6, 2, 0); // 台北 10:00、紐約 10/5 22:00
		expect(countdown({ kind: 'exam', date: '2026-10-06', time: '09:00' }, '2026-10-06', now, tz).label).toBe('已開始');
		expect(countdown({ kind: 'exam', date: '2026-10-06', time: '09:00' }, '2026-10-05', now, 'America/New_York')).toMatchObject({
			text: '明天',
			secondsLeft: 11 * 3600,
		});
	});
});
