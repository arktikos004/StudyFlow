import { describe, expect, it } from 'vitest';
import {
	isApplePlatform,
	isPaletteShortcut,
	matchesQuery,
	PAGE_KEYWORDS,
	QUICK_ACTIONS,
	resultHref,
	stepIndex,
} from '../src/react-app/lib/shell-palette';

const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}, code?: string) => ({
	key: k,
	code,
	metaKey: false,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	...mods,
});

describe('指令面板：搜尋結果的深連結', () => {
	it('任務、考試、筆記用 ?open=，科目前往單科總覽', () => {
		expect(resultHref('task', 't1')).toBe('/tasks?open=t1');
		expect(resultHref('event', 'e1')).toBe('/events?open=e1');
		expect(resultHref('note', 'n1')).toBe('/notes?open=n1');
		expect(resultHref('subject', 's1')).toBe('/subjects/s1');
	});

	it('id 會編碼，不會破壞網址', () => {
		expect(resultHref('task', 'a&b=c')).toBe('/tasks?open=a%26b%3Dc');
		expect(resultHref('subject', 'x/y')).toBe('/subjects/x%2Fy');
	});

	it('快捷動作的目的地符合驗收條件', () => {
		const to = Object.fromEntries(QUICK_ACTIONS.map((a) => [a.id, a.to]));
		expect(to).toEqual({
			focus: '/timer',
			'new-task': '/tasks?new=1',
			'new-mistake': '/notes?new=mistake',
			'new-subject': '/settings?new=1',
		});
	});
});

describe('指令面板：本機比對', () => {
	it('中文子字串、不分大小寫、全形英數', () => {
		expect(matchesQuery(['學習統計'], '統計')).toBe(true);
		expect(matchesQuery(['學習計時', ...PAGE_KEYWORDS['/timer']], '番茄')).toBe(true);
		expect(matchesQuery(['Pomodoro'], 'pomo')).toBe(true);
		expect(matchesQuery(['pomodoro'], 'ＰＯＭＯ')).toBe(true);
		expect(matchesQuery(['學習統計'], '月曆')).toBe(false);
	});

	it('多個關鍵字以空白分隔，每個都要符合（可以分散在不同欄位）', () => {
		expect(matchesQuery(['新增任務', '待辦'], '新增 待辦')).toBe(true);
		expect(matchesQuery(['新增任務', '待辦'], '新增 科目')).toBe(false);
		expect(matchesQuery(['新增任務'], '　新增　')).toBe(true);
	});

	it('空字串全部符合', () => {
		expect(matchesQuery(['任何'], '')).toBe(true);
		expect(matchesQuery(['任何'], '   ')).toBe(true);
	});
});

describe('指令面板：快速鍵', () => {
	it('Windows／Linux 用 Ctrl+K，⌘ 不算', () => {
		expect(isPaletteShortcut(key('k', { ctrlKey: true }), false, false)).toBe(true);
		expect(isPaletteShortcut(key('K', { ctrlKey: true }), false, true)).toBe(true);
		expect(isPaletteShortcut(key('k', { metaKey: true }), false, false)).toBe(false);
	});

	it('macOS 用 ⌘K；Ctrl+K 在輸入欄位裡保留給「刪到行尾」', () => {
		expect(isPaletteShortcut(key('k', { metaKey: true }), true, true)).toBe(true);
		expect(isPaletteShortcut(key('k', { ctrlKey: true }), true, false)).toBe(true);
		expect(isPaletteShortcut(key('k', { ctrlKey: true }), true, true)).toBe(false);
	});

	it('加了 Shift／Alt、其他按鍵都不算；輸入法下看實體鍵', () => {
		expect(isPaletteShortcut(key('k', { ctrlKey: true, shiftKey: true }), false, false)).toBe(false);
		expect(isPaletteShortcut(key('k', { ctrlKey: true, altKey: true }), false, false)).toBe(false);
		expect(isPaletteShortcut(key('j', { ctrlKey: true }), false, false)).toBe(false);
		expect(isPaletteShortcut(key('k'), false, false)).toBe(false);
		expect(isPaletteShortcut(key('Process', { ctrlKey: true }, 'KeyK'), false, false)).toBe(true);
	});

	it('平台判斷', () => {
		expect(isApplePlatform('MacIntel')).toBe(true);
		expect(isApplePlatform('iPhone')).toBe(true);
		expect(isApplePlatform('Win32')).toBe(false);
		expect(isApplePlatform('Linux x86_64')).toBe(false);
	});
});

describe('指令面板：上下鍵移動', () => {
	it('循環移動；沒有選項時回傳 -1', () => {
		expect(stepIndex(0, 1, 3)).toBe(1);
		expect(stepIndex(2, 1, 3)).toBe(0);
		expect(stepIndex(0, -1, 3)).toBe(2);
		expect(stepIndex(-1, 1, 3)).toBe(0);
		expect(stepIndex(-1, -1, 3)).toBe(2);
		expect(stepIndex(0, 1, 0)).toBe(-1);
	});
});
