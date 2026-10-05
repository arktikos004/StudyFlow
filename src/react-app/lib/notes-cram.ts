import type { NoteItem } from '../../shared/api-types';

// 考前衝刺（NOTE-2）的純函式：題庫篩選、標籤清單、洗牌、本輪結果。
// 衝刺的作答只記在前端（這一輪），不呼叫 /notes/:id/review，所以不影響間隔複習的排程。

export type ReviewResult = 'remembered' | 'forgot';
export type CramOptions = { tag: string | null; includeMastered: boolean };
type CramNote = Pick<NoteItem, 'kind' | 'mastered' | 'tags'>;

/** 衝刺題庫：只取錯題；有指定標籤時只取有這個標籤的；預設不含已掌握 */
export function cramPool<T extends CramNote>(notes: readonly T[], { tag, includeMastered }: CramOptions): T[] {
	return notes.filter((n) => n.kind === 'mistake' && (includeMastered || !n.mastered) && (!tag || n.tags.includes(tag)));
}

/** 範圍內錯題的標籤與題數（題數多的在前，同數依名稱），題數依「是否包含已掌握」計算 */
export function cramTags(notes: readonly CramNote[], includeMastered: boolean): { tag: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const n of cramPool(notes, { tag: null, includeMastered })) for (const t of new Set(n.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hant'));
}

/** Fisher–Yates 洗牌，回傳新陣列；random 可注入（測試用） */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** 本輪的題目順序：隨機，或依新增的先後（不受釘選與更新時間影響） */
export function cramQueue<T extends Pick<NoteItem, 'createdAt' | 'id'>>(pool: readonly T[], random: boolean, rng?: () => number): T[] {
	if (random) return shuffle(pool, rng);
	return [...pool].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/** 記住、還不熟各幾題 */
export function tally(results: Readonly<Record<string, ReviewResult>>): Record<ReviewResult, number> {
	const out = { remembered: 0, forgot: 0 };
	for (const r of Object.values(results)) out[r]++;
	return out;
}

/** 再練一次：本輪「還不熟」的題目，維持本輪的順序 */
export function retryQueue<T extends Pick<NoteItem, 'id'>>(queue: readonly T[], results: Readonly<Record<string, ReviewResult>>): T[] {
	return queue.filter((n) => results[n.id] === 'forgot');
}
