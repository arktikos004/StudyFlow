import { describe, expect, it } from 'vitest';
import { badgeLabel, navBadges } from '../src/react-app/lib/shell-nav';

describe('導覽的數量標籤', () => {
	it('任務 = 逾期＋今天到期；有逾期時用 danger，報讀文字寫出逾期數', () => {
		const b = navBadges({ overdueCount: 1, dueTodayCount: 2, reviewDueCount: 0 });
		expect(b['/tasks']).toEqual({ count: 3, tone: 'danger', srText: '，3 項待處理，其中 1 項逾期' });
		expect(b['/notes']).toBeUndefined();
	});

	it('只有今天到期時用 warning', () => {
		expect(navBadges({ overdueCount: 0, dueTodayCount: 2, reviewDueCount: 0 })['/tasks']).toEqual({
			count: 2,
			tone: 'warning',
			srText: '，2 項待處理',
		});
	});

	it('筆記 = 待複習數', () => {
		expect(navBadges({ overdueCount: 0, dueTodayCount: 0, reviewDueCount: 5 })['/notes']).toEqual({
			count: 5,
			tone: 'warning',
			srText: '，5 項待複習',
		});
	});

	it('0 或還沒載入時不顯示', () => {
		expect(navBadges({ overdueCount: 0, dueTodayCount: 0, reviewDueCount: 0 })).toEqual({});
		expect(navBadges(undefined)).toEqual({});
	});

	it('超過 99 顯示 99+（報讀文字仍是實際數字）', () => {
		expect(badgeLabel(99)).toBe('99');
		expect(badgeLabel(100)).toBe('99+');
		expect(navBadges({ overdueCount: 0, dueTodayCount: 0, reviewDueCount: 120 })['/notes']?.srText).toBe('，120 項待複習');
	});
});
