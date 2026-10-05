import { describe, expect, it } from 'vitest';
import { cramPool, cramQueue, cramTags, retryQueue, shuffle, tally } from '../src/react-app/lib/notes-cram';

type N = { id: string; kind: 'note' | 'mistake'; mastered: boolean; tags: string[]; createdAt: number };
const n = (id: string, over: Partial<N> = {}): N => ({ id, kind: 'mistake', mastered: false, tags: [], createdAt: 0, ...over });

/** 固定序列的亂數（測試洗牌用） */
const seq = (...values: number[]) => {
	let i = 0;
	return () => values[i++ % values.length];
};

describe('考前衝刺的題庫（NOTE-2）', () => {
	const notes = [
		n('a', { tags: ['recursion', 'midterm'] }),
		n('b', { mastered: true, tags: ['recursion'] }),
		n('c', { tags: ['sorting'] }),
		n('d', { kind: 'note', tags: ['recursion'] }),
	];

	it('只取錯題，預設不含已掌握', () => {
		expect(cramPool(notes, { tag: null, includeMastered: false }).map((x) => x.id)).toEqual(['a', 'c']);
	});

	it('可以包含已掌握；指定標籤時只取有這個標籤的', () => {
		expect(cramPool(notes, { tag: null, includeMastered: true }).map((x) => x.id)).toEqual(['a', 'b', 'c']);
		expect(cramPool(notes, { tag: 'recursion', includeMastered: false }).map((x) => x.id)).toEqual(['a']);
		expect(cramPool(notes, { tag: 'recursion', includeMastered: true }).map((x) => x.id)).toEqual(['a', 'b']);
		expect(cramPool(notes, { tag: '不存在', includeMastered: true })).toEqual([]);
	});

	it('標籤清單只算錯題，題數依是否包含已掌握，多的在前', () => {
		expect(cramTags(notes, false)).toEqual([
			{ tag: 'midterm', count: 1 },
			{ tag: 'recursion', count: 1 },
			{ tag: 'sorting', count: 1 },
		]);
		expect(cramTags(notes, true)[0]).toEqual({ tag: 'recursion', count: 2 });
		// 同一題重複的標籤只算一次
		expect(cramTags([n('x', { tags: ['A', 'A'] })], false)).toEqual([{ tag: 'A', count: 1 }]);
	});
});

describe('洗牌與題目順序', () => {
	it('洗牌是原陣列的排列，不改動原陣列', () => {
		const items = [1, 2, 3, 4, 5, 6];
		const out = shuffle(items, seq(0.9, 0.1, 0.5, 0.3, 0.7));
		expect([...out].sort()).toEqual(items);
		expect(items).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it('Fisher–Yates：固定亂數得到固定結果', () => {
		// random 都是 0：每一步都和第 0 個交換
		expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
		// random 接近 1：每一步都和自己交換（不變）
		expect(shuffle([1, 2, 3, 4], () => 0.999)).toEqual([1, 2, 3, 4]);
		expect(shuffle([], () => 0)).toEqual([]);
	});

	it('每個位置都有機會（大量洗牌的分布）', () => {
		const firsts = new Set<number>();
		for (let i = 0; i < 200; i++) firsts.add(shuffle([1, 2, 3, 4])[0]);
		expect(firsts).toEqual(new Set([1, 2, 3, 4]));
	});

	it('不隨機時依新增的先後，不受釘選與更新時間影響', () => {
		const pool = [n('b', { createdAt: 30 }), n('a', { createdAt: 10 }), n('c', { createdAt: 20 }), n('d', { createdAt: 10 })];
		expect(cramQueue(pool, false).map((x) => x.id)).toEqual(['a', 'd', 'c', 'b']);
		expect(cramQueue(pool, true, () => 0).map((x) => x.id)).toEqual(['a', 'c', 'd', 'b']);
	});
});

describe('衝刺的本輪結果（只在前端記錄）', () => {
	const queue = [n('a'), n('b'), n('c'), n('d')];
	const results = { a: 'forgot', b: 'remembered', d: 'forgot' } as const;

	it('統計記住與還不熟', () => {
		expect(tally(results)).toEqual({ remembered: 1, forgot: 2 });
		expect(tally({})).toEqual({ remembered: 0, forgot: 0 });
	});

	it('再練一次：只取還不熟的，維持本輪順序；沒作答的不算', () => {
		expect(retryQueue(queue, results).map((x) => x.id)).toEqual(['a', 'd']);
	});
});
