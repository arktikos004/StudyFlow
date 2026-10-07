import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { Subject } from '../../shared/api-types';

// 筆記頁的畫面狀態放在網址：view（分類）、mode（複習方式）、subject、tag。
// 單科頁與考試頁的「複習這科錯題」會帶 view=review&mode=cram&subject=。

export const NOTES_VIEWS = ['all', 'mistake', 'note', 'review'] as const;
export type NotesView = (typeof NOTES_VIEWS)[number];

/** 複習方式：今天到期（間隔複習）或考前衝刺 */
export type ReviewMode = 'due' | 'cram';

/** 網址參數的修改：undefined 不動，null 刪掉 */
export type NotesParamsPatch = { view?: string | null; mode?: string | null; subject?: string | null; tag?: string | null };

/**
 * 讀寫筆記頁的網址參數（replace，不會多一筆上一頁）。
 * subjects 還沒載入時 subjectId 先是 null；連結裡的科目不存在（已刪除）時 subjectMissing 為 true，當成沒有指定。
 */
export function useNotesParams(subjects: readonly Pick<Subject, 'id'>[] | undefined) {
	const [params, setParams] = useSearchParams();
	const viewParam = params.get('view');
	const view: NotesView = NOTES_VIEWS.find((v) => v === viewParam) ?? 'all';
	const mode: ReviewMode = params.get('mode') === 'cram' ? 'cram' : 'due';
	const subjectParam = params.get('subject');
	const subjectId = subjectParam && subjects?.some((s) => s.id === subjectParam) ? subjectParam : null;
	const subjectMissing = !!subjectParam && !!subjects && !subjectId;
	const tag = params.get('tag') || null;

	const updateParams = useCallback(
		(patch: NotesParamsPatch) =>
			setParams(
				(prev) => {
					for (const [k, v] of Object.entries(patch)) {
						if (v === undefined) continue;
						if (v === null) prev.delete(k);
						else prev.set(k, v);
					}
					return prev;
				},
				{ replace: true },
			),
		[setParams],
	);
	/** 換分類：「全部」是預設，不寫進網址；離開複習時清掉複習方式 */
	const setView = (v: NotesView) => updateParams({ view: v === 'all' ? null : v, mode: v === 'review' ? undefined : null });

	return { view, mode, subjectParam, subjectId, subjectMissing, tag, updateParams, setView };
}
