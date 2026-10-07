import { describe, expect, it } from 'vitest';
import { dayLabel, noteSnippet, notesSummary, stripMarkdown } from '../src/react-app/lib/notes-format';

describe('筆記卡的摘要', () => {
	it('Markdown 轉成一行純文字', () => {
		expect(stripMarkdown('# 第 3 章\n- **重點一**\n- `code` 與 [連結](https://x.y)\n> 引用\n1. 第一步')).toBe(
			'第 3 章 重點一 code 與 連結 引用 第一步',
		);
		expect(stripMarkdown('```js\nconst a = 1;\n```')).toBe('const a = 1;');
		expect(stripMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('a b 1 2');
		expect(stripMarkdown('O(n-1) 和 snake_case 保留，*斜體*去掉')).toBe('O(n-1) 和 snake_case 保留，斜體去掉');
	});

	it('錯題依序取題目、原因、補充；筆記取內容', () => {
		expect(noteSnippet({ kind: 'mistake', question: null, reason: '粗心', content: '補充' })).toBe('粗心');
		expect(noteSnippet({ kind: 'note', question: '題目', reason: null, content: '## 內容' })).toBe('內容');
		expect(noteSnippet({ kind: 'note', question: null, reason: null, content: null })).toBe('');
	});

	it('搜尋時取含關鍵字的欄位，並從關鍵字前面一點開始', () => {
		const long = `${'前面的文字'.repeat(20)}關鍵字在這裡`;
		const s = noteSnippet({ kind: 'mistake', question: '題目沒有', reason: null, content: long }, '關鍵字');
		expect(s.startsWith('…')).toBe(true);
		expect(s).toContain('關鍵字在這裡');
		// 關鍵字在開頭附近：不截前面
		expect(noteSnippet({ kind: 'note', question: null, reason: null, content: '一開始就有遞迴' }, '遞迴')).toBe('一開始就有遞迴');
		// 英文不分大小寫
		expect(noteSnippet({ kind: 'note', question: null, reason: null, content: `${'x '.repeat(40)}Dijkstra` }, 'dijkstra')).toContain(
			'Dijkstra',
		);
		// 只有標題符合：用預設摘要
		expect(noteSnippet({ kind: 'mistake', question: '題目', reason: null, content: null }, '標題')).toBe('題目');
	});

	it('「最後更新」依使用者時區：今天、昨天、日期，跨年加年份', () => {
		// 2026-10-06 01:00 台北 = 10-05 17:00 UTC
		const tpe = Date.UTC(2026, 9, 5, 17, 0);
		expect(dayLabel(tpe, 'Asia/Taipei', '2026-10-06')).toBe('今天');
		expect(dayLabel(tpe, 'UTC', '2026-10-06')).toBe('昨天');
		expect(dayLabel(tpe, 'Asia/Taipei', '2026-10-09')).toBe('10/6（二）');
		expect(dayLabel(tpe, 'Asia/Taipei', '2027-01-02')).toBe('2026/10/6（二）');
	});
});

describe('筆記頁頁首的摘要（notesSummary）', () => {
	it('數量與待複習用「，」連接；有篩選時說「找到」', () => {
		expect(notesSummary({ count: 7, due: 2, filtered: false, empty: false })).toBe('共 7 則，今天有 2 題待複習');
		expect(notesSummary({ count: 3, due: 0, filtered: true, empty: false })).toBe('找到 3 則，今天沒有待複習的題目');
		expect(notesSummary({ count: 0, due: undefined, filtered: true, empty: false })).toBe('找到 0 則');
	});

	it('數量還不知道、沒有任何資料、或沒篩選卻是 0 則時不報數量', () => {
		expect(notesSummary({ count: undefined, due: 1, filtered: false, empty: false })).toBe('今天有 1 題待複習');
		expect(notesSummary({ count: 0, due: 0, filtered: false, empty: true })).toBe('今天沒有待複習的題目');
		expect(notesSummary({ count: 0, due: undefined, filtered: false, empty: false })).toBe('');
	});
});
