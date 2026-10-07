import { describe, expect, it } from 'vitest';
import {
	badgeCapacity,
	badgeRowCapacity,
	emailParts,
	formatCount,
	joinedLabel,
	masteredNote,
	sessionsNote,
	streakNote,
	studyTotal,
	timezoneLabel,
	timezoneOptions,
} from '../src/react-app/lib/profile-format';

describe('加入時間（joinedLabel）', () => {
	it('依使用者的時區判斷年月', () => {
		// UTC 2026-08-31 16:30 = 台北 2026-09-01 00:30
		const t = Date.UTC(2026, 7, 31, 16, 30);
		expect(joinedLabel(t, 'Asia/Taipei')).toEqual({ text: '2026 年 9 月加入', dateTime: '2026-09' });
		expect(joinedLabel(t, 'UTC')).toEqual({ text: '2026 年 8 月加入', dateTime: '2026-08' });
		// UTC 2027-01-01 03:00 = 洛杉磯 2026-12-31 19:00
		expect(joinedLabel(Date.UTC(2027, 0, 1, 3), 'America/Los_Angeles')).toEqual({ text: '2026 年 12 月加入', dateTime: '2026-12' });
	});

	it('時區不合法時改用 UTC，不丟錯', () => {
		expect(joinedLabel(Date.UTC(2026, 9, 6, 12), 'Not/AZone')).toEqual({ text: '2026 年 10 月加入', dateTime: '2026-10' });
	});
});

describe('累積數字的文字', () => {
	it('學習時間：未滿 1 小時用分鐘，之後用小時（無條件捨去到一位小數），100 小時以上取整數', () => {
		expect(studyTotal(0)).toEqual({ value: '0', unit: '小時' });
		expect(studyTotal(-5)).toEqual({ value: '0', unit: '小時' });
		expect(studyTotal(Number.NaN)).toEqual({ value: '0', unit: '小時' });
		expect(studyTotal(0.6)).toEqual({ value: '0', unit: '小時' });
		expect(studyTotal(1)).toEqual({ value: '1', unit: '分鐘' });
		expect(studyTotal(45.9)).toEqual({ value: '45', unit: '分鐘' });
		expect(studyTotal(59)).toEqual({ value: '59', unit: '分鐘' });
		expect(studyTotal(60)).toEqual({ value: '1', unit: '小時' });
		expect(studyTotal(95)).toEqual({ value: '1.5', unit: '小時' });
		// 40 小時 36 分 = 40.6；40 小時 41 分 = 40.68 → 40.6（不會比實際多）
		expect(studyTotal(2436)).toEqual({ value: '40.6', unit: '小時' });
		expect(studyTotal(2441)).toEqual({ value: '40.6', unit: '小時' });
		expect(studyTotal(5999)).toEqual({ value: '99.9', unit: '小時' });
		expect(studyTotal(6000)).toEqual({ value: '100', unit: '小時' });
		expect(studyTotal(7710)).toEqual({ value: '128', unit: '小時' });
		expect(studyTotal(74_100)).toEqual({ value: '1,235', unit: '小時' });
	});

	it('數量：千分位、負數與 NaN 當成 0', () => {
		expect(formatCount(0)).toBe('0');
		expect(formatCount(1234)).toBe('1,234');
		expect(formatCount(-3)).toBe('0');
		expect(formatCount(Number.NaN)).toBe('0');
	});

	it('副標', () => {
		expect(sessionsNote(32)).toBe('共 32 次學習');
		expect(sessionsNote(1200)).toBe('共 1,200 次學習');
		expect(masteredNote(3)).toBe('已掌握 3 題錯題');
		expect(masteredNote(0)).toBe('已掌握 0 題錯題');
	});

	it('連續天數：都是 0 時給下一步；目前就是最長紀錄時直接說；否則顯示最長', () => {
		expect(streakNote(0, 0)).toBe('今天讀書就能開始累積');
		expect(streakNote(3, 12)).toBe('最長 12 天');
		expect(streakNote(0, 5)).toBe('最長 5 天');
		expect(streakNote(12, 12)).toBe('目前就是最長紀錄');
		// 後端的最長紀錄還沒更新到今天時，也不會顯示比目前還短的「最長」
		expect(streakNote(4, 3)).toBe('目前就是最長紀錄');
	});
});

describe('一列放得下幾個徽章（badgeCapacity）', () => {
	// 徽章 28px、間距 8px、「+N」34px
	const cap = (width: number, count: number) => badgeCapacity(width, count, 28, 8, 34);

	it('全部放得下就全部顯示', () => {
		expect(cap(300, 3)).toBe(3);
		// 3 個 = 28×3 + 8×2 = 100
		expect(cap(100, 3)).toBe(3);
		expect(cap(28, 1)).toBe(1);
	});

	it('放不下時留一格給「+N」', () => {
		// 100px 放不下 4 個（136）；k 個徽章各帶一個間距再加 +N：2×36 + 34 = 106 > 100 → 1 個
		expect(cap(100, 4)).toBe(1);
		expect(cap(106, 4)).toBe(2);
		// 手機的一格約 147px：3×36 + 34 = 142 → 3 個 + 「+N」
		expect(cap(147, 12)).toBe(3);
		// 桌面的一格約 204px：4×36 + 34 = 178 → 4 個
		expect(cap(204, 12)).toBe(4);
	});

	it('不會回傳負數，也不會超過徽章數', () => {
		expect(cap(10, 5)).toBe(0);
		expect(cap(0, 5)).toBe(0);
		expect(cap(1000, 0)).toBe(0);
		expect(cap(1000, 12)).toBe(12);
		// chip 省略時和徽章一樣寬：1 個徽章＋間距＋「+N」= 64
		expect(badgeCapacity(64, 3, 28, 8)).toBe(1);
		expect(badgeCapacity(63, 3, 28, 8)).toBe(0);
	});
});

describe('個人檔案的徽章列（badgeRowCapacity，review A4）', () => {
	it('預設字級 16px：和以 px 計算的結果相同（徽章 28、間距 8、「+N」34）', () => {
		for (const width of [0, 100, 132, 147, 204, 500]) {
			expect(badgeRowCapacity(width, 12, 16)).toBe(badgeCapacity(width, 12, 28, 8, 34));
		}
		// 390px 手機的一格約 147px：3 個＋「+N」；360px 手機約 132px：只放得下 2 個＋「+N」
		expect(badgeRowCapacity(147, 5, 16)).toBe(3);
		expect(badgeRowCapacity(132, 5, 16)).toBe(2);
	});

	it('瀏覽器的預設字級調大時，徽章跟著變大，放得下的數量變少', () => {
		// 20px（125%）：徽章 35、間距 10、「+N」42.5 → (147 − 42.5) / 45 = 2.3 → 2 個
		expect(badgeRowCapacity(147, 5, 20)).toBe(2);
		// 24px（150%）：徽章 42、間距 12、「+N」51 → (147 − 51) / 54 = 1.7 → 1 個
		expect(badgeRowCapacity(147, 5, 24)).toBe(1);
		// 全部放得下時不受影響：2 個 = 35×2 + 10 = 80
		expect(badgeRowCapacity(147, 2, 20)).toBe(2);
	});

	it('字級不合法時當成 16px；還沒量到寬度（0）時不顯示徽章，只留「+N」', () => {
		expect(badgeRowCapacity(147, 5, Number.NaN)).toBe(3);
		expect(badgeRowCapacity(147, 5, 0)).toBe(3);
		expect(badgeRowCapacity(0, 5, 16)).toBe(0);
	});
});

describe('時區選單', () => {
	it('目前的時區不在常用清單時排在最前面', () => {
		expect(timezoneOptions('Asia/Taipei')[0]).toBe('Asia/Taipei');
		expect(timezoneOptions('Asia/Taipei')).not.toContain('Europe/Paris');
		const list = timezoneOptions('Europe/Paris');
		expect(list[0]).toBe('Europe/Paris');
		expect(list).toContain('Asia/Taipei');
	});

	it('選項文字附上 GMT 偏移；夏令時間跟著日期變', () => {
		const winter = Date.UTC(2026, 0, 15);
		const summer = Date.UTC(2026, 6, 15);
		expect(timezoneLabel('Asia/Taipei', winter)).toBe('Asia/Taipei（GMT+8）');
		expect(timezoneLabel('Europe/London', winter)).toBe('Europe/London（GMT+0）');
		expect(timezoneLabel('Europe/London', summer)).toBe('Europe/London（GMT+1）');
		expect(timezoneLabel('Not/AZone', winter)).toBe('Not/AZone');
	});
});

describe('Email 的換行點（emailParts）', () => {
	it('在 @ 與 . 前面斷開，接起來是原本的 Email', () => {
		const email = 'alex.chen.2026@student.example.edu.tw';
		expect(emailParts(email)).toEqual(['alex', '.chen', '.2026', '@student', '.example', '.edu', '.tw']);
		expect(emailParts(email).join('')).toBe(email);
		expect(emailParts('demo@example.com')).toEqual(['demo', '@example', '.com']);
		expect(emailParts('')).toEqual([]);
	});
});
