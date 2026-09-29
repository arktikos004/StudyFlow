// CSV（RFC 4180）產生工具：給 Excel 開啟用，開頭加 UTF-8 BOM，中文才不會變亂碼

export const CSV_BOM = '﻿';

export type CsvValue = string | number | null | undefined;

/**
 * 單一欄位：
 * - 文字以 = + - @（以及 Tab、CR）開頭時前面加 '，避免 Excel 當成公式執行（公式注入）
 * - 含有逗號、雙引號或換行時用雙引號包起來，裡面的雙引號寫兩次
 * - null／undefined 輸出空白；數字原樣輸出
 */
export function csvCell(value: CsvValue): string {
	if (value === null || value === undefined) return '';
	let s = String(value);
	if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 整份 CSV：BOM + 標題列 + 資料列，每列以 CRLF 結尾 */
export function toCsv(header: string[], rows: CsvValue[][]): string {
	return CSV_BOM + [header, ...rows].map((row) => row.map(csvCell).join(',') + '\r\n').join('');
}
