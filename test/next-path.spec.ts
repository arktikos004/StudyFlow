import { describe, expect, it } from 'vitest';
import { safeNextPath } from '../src/react-app/lib/next-path';

const ORIGIN = 'https://studyflow.sekinv.com';

describe('登入後要回去的路徑（safeNextPath）', () => {
	it('站內路徑原樣保留，包含查詢字串與 #', () => {
		expect(safeNextPath('/stats', ORIGIN)).toBe('/stats');
		expect(safeNextPath('/notes?view=review&mode=cram', ORIGIN)).toBe('/notes?view=review&mode=cram');
		expect(safeNextPath('/settings#goals', ORIGIN)).toBe('/settings#goals');
	});

	it('沒有 next、或不是以 / 開頭：回到總覽', () => {
		expect(safeNextPath(null, ORIGIN)).toBe('/');
		expect(safeNextPath('', ORIGIN)).toBe('/');
		expect(safeNextPath('stats', ORIGIN)).toBe('/');
		expect(safeNextPath('https://evil.example/', ORIGIN)).toBe('/');
	});

	it('指向外部網站的寫法都擋下（//host、/\\host、/\\/host）', () => {
		expect(safeNextPath('//evil.example/path', ORIGIN)).toBe('/');
		expect(safeNextPath('/\\evil.example', ORIGIN)).toBe('/');
		expect(safeNextPath('/\\/evil.example', ORIGIN)).toBe('/');
	});
});
