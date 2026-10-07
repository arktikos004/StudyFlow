import type { NoteItem } from '../../shared/api-types';
import { diffDays, localDate } from '../../shared/dates';
import { formatDate } from './format';

// 筆記頁（s2/notes）的格式化純函式。日期一律依使用者時區（user.timezone）。

/** 把 Markdown 轉成一行純文字（卡片摘要用）：去掉標題、清單、引用、強調、程式碼記號，連結與圖片只留文字 */
export function stripMarkdown(text: string): string {
	return (
		text
			.split('\n')
			// 程式碼區塊的 ``` 行、表格分隔線、水平線
			.filter(
				(line) =>
					!/^\s*(```|~~~)/.test(line) &&
					!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line) &&
					!/^\s*([*_-])(\s*\1){2,}\s*$/.test(line),
			)
			.map((line) =>
				line
					.replace(/^\s{0,3}#{1,6}\s+/, '')
					.replace(/^\s*(>\s?)+/, '')
					.replace(/^\s*([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, ''),
			)
			.join(' ')
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
			.replace(/(\*\*|__|~~|`+)/g, '')
			// *斜體*（中文前後沒有空白）；「a * b」這種前後有空白的星號保留
			.replace(/\*([^*\s][^*]*?)\*/g, '$1')
			.replace(/\|/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

type SnippetNote = Pick<NoteItem, 'kind' | 'question' | 'reason' | 'content'>;

/**
 * 卡片摘要：錯題依序取題目、錯誤原因、補充筆記；筆記取內容。
 * 有搜尋關鍵字時，改取第一個含關鍵字的欄位，並從關鍵字前面一點開始截取（前面被截掉時加上「…」），
 * 讓 <mark> 標出的關鍵字一定看得到。
 */
export function noteSnippet(note: SnippetNote, query = '', max = 120): string {
	const fields = (note.kind === 'mistake' ? [note.question, note.reason, note.content] : [note.content])
		.map((f) => (f ? stripMarkdown(f) : ''))
		.filter(Boolean);
	const q = query.trim().toLowerCase();
	if (q) {
		for (const text of fields) {
			const at = text.toLowerCase().indexOf(q);
			if (at < 0) continue;
			const lead = 24;
			if (at <= lead) return text.slice(0, max);
			// 附近有空白就從空白後開始，避免切在英文單字中間
			let start = at - lead;
			const space = text.lastIndexOf(' ', Math.min(at - 1, start + 12));
			if (space >= start - 12) start = space + 1;
			return `…${text.slice(start, start + max)}`;
		}
	}
	return (fields[0] ?? '').slice(0, max);
}

/** 某個時間點是哪天（「最後更新」「新增於」用）：今天、昨天，或日期（不是今年時加上年份） */
export function dayLabel(epochMs: number, timeZone: string, today: string): string {
	const date = localDate(epochMs, timeZone);
	const days = diffDays(date, today);
	if (days === 0) return '今天';
	if (days === 1) return '昨天';
	return formatDate(date, date.slice(0, 4) !== today.slice(0, 4));
}
