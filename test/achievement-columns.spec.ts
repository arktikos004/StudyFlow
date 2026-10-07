import { describe, expect, it } from 'vitest';
import { splitColumns } from '../src/react-app/lib/achievement-display';

const byLen = (g: { n: number }) => g.n;
const ids = (cols: [{ id: string }[], { id: string }[]]) => cols.map((c) => c.map((g) => g.id).join(''));

describe('成就頁：兩欄各自堆疊', () => {
	it('左欄是前面連續的幾個，右欄是其餘的（單欄時照原順序）', () => {
		const groups = [
			{ id: 'a', n: 6 },
			{ id: 'b', n: 4 },
			{ id: 'c', n: 3 },
			{ id: 'd', n: 3 },
		];
		const [left, right] = splitColumns(groups, byLen);
		expect([...left, ...right]).toEqual(groups);
		expect(ids([left, right])).toEqual(['ab', 'cd']);
	});

	it('切在兩欄高度最接近的位置；一樣接近時左欄多一些', () => {
		expect(
			ids(
				splitColumns(
					[
						{ id: 'a', n: 2 },
						{ id: 'b', n: 2 },
						{ id: 'c', n: 2 },
						{ id: 'd', n: 2 },
					],
					byLen,
				),
			),
		).toEqual(['ab', 'cd']);
		expect(
			ids(
				splitColumns(
					[
						{ id: 'a', n: 2 },
						{ id: 'b', n: 2 },
						{ id: 'c', n: 2 },
					],
					byLen,
				),
			),
		).toEqual(['ab', 'c']);
		expect(
			ids(
				splitColumns(
					[
						{ id: 'a', n: 1 },
						{ id: 'b', n: 1 },
						{ id: 'c', n: 6 },
					],
					byLen,
				),
			),
		).toEqual(['ab', 'c']);
	});

	it('少於兩個時全部放左欄', () => {
		expect(splitColumns([], byLen)).toEqual([[], []]);
		expect(splitColumns([{ id: 'a', n: 3 }], byLen)).toEqual([[{ id: 'a', n: 3 }], []]);
	});
});
