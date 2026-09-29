import { describe, expect, it } from 'vitest';
import { CSV_BOM, csvCell, toCsv } from '../src/worker/lib/csv';

describe('csvCell', () => {
	it('一般文字與數字原樣輸出，null／undefined 輸出空白', () => {
		expect(csvCell('資料結構')).toBe('資料結構');
		expect(csvCell(45.5)).toBe('45.5');
		expect(csvCell(0)).toBe('0');
		expect(csvCell(null)).toBe('');
		expect(csvCell(undefined)).toBe('');
		expect(csvCell('')).toBe('');
	});

	it('含逗號、雙引號或換行時用雙引號包起來，裡面的雙引號寫兩次', () => {
		expect(csvCell('a,b')).toBe('"a,b"');
		expect(csvCell('他說 "好"')).toBe('"他說 ""好"""');
		expect(csvCell('第一行\n第二行')).toBe('"第一行\n第二行"');
		expect(csvCell('第一行\r\n第二行')).toBe('"第一行\r\n第二行"');
	});

	it('防止公式注入：= + - @ 開頭的文字前面加上單引號', () => {
		expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
		expect(csvCell('+886')).toBe("'+886");
		expect(csvCell('-1 分')).toBe("'-1 分");
		expect(csvCell('@cmd')).toBe("'@cmd");
		expect(csvCell('\t=1+1')).toBe("'\t=1+1");
		// 需要加引號時，單引號也在引號裡面
		expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
		// 不在開頭的符號不處理；數字不處理
		expect(csvCell('a=b')).toBe('a=b');
		expect(csvCell('1+1')).toBe('1+1');
		expect(csvCell(-5)).toBe('-5');
	});
});

describe('toCsv', () => {
	it('開頭有 UTF-8 BOM，每一列以 CRLF 結尾', () => {
		const csv = toCsv(
			['標題', '分鐘'],
			[
				['讀書', 30],
				['=惡意', null],
			],
		);
		expect(csv.startsWith(CSV_BOM)).toBe(true);
		expect(csv).toBe(`${CSV_BOM}標題,分鐘\r\n讀書,30\r\n'=惡意,\r\n`);
	});

	it('沒有資料時只有標題列', () => {
		expect(toCsv(['a', 'b'], [])).toBe(`${CSV_BOM}a,b\r\n`);
	});
});
