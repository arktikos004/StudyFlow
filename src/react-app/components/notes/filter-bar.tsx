import { Hash, X } from 'lucide-react';
import { LIST_SEARCH_MAX } from '../../../shared/schemas';
import type { NotesView } from '../../lib/notes-params';
import { SubjectSelect } from '../subjects';
import { SearchInput, Segmented } from '../ui';

/** 「複習」分頁的名稱：今天有到期的題目時加上數量徽章 */
function ReviewTabLabel({ due }: { due: number | undefined }) {
	return (
		<span className="inline-flex items-center gap-1.5">
			複習
			{!!due && (
				<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-soft px-1.5 font-num text-caption font-semibold text-warning tabular-nums">
					{due}
					<span className="sr-only">題待複習</span>
				</span>
			)}
		</span>
	);
}

/**
 * 筆記頁的篩選列（跨頁慣例）：搜尋（flex-1）→ 分類 → 科目 → 標籤。
 * 複習分頁只有分類：科目與標籤由複習自己選。
 */
export function NotesFilterBar({
	view,
	onView,
	due,
	search,
	onSearch,
	subjectId,
	onSubject,
	tag,
	onClearTag,
}: {
	view: NotesView;
	onView: (view: NotesView) => void;
	/** 今天到期的錯題數（還不知道時 undefined） */
	due: number | undefined;
	search: string;
	onSearch: (search: string) => void;
	subjectId: string | null;
	onSubject: (subjectId: string | null) => void;
	tag: string | null;
	onClearTag: () => void;
}) {
	const listView = view !== 'review';
	return (
		<div className="mb-5 flex flex-wrap items-center gap-2">
			{listView && (
				<SearchInput
					value={search}
					onValueChange={onSearch}
					label="搜尋筆記"
					placeholder="搜尋標題、內容或題目"
					maxLength={LIST_SEARCH_MAX}
					className="min-w-0 grow basis-full sm:basis-64"
				/>
			)}
			<Segmented
				label="分類"
				value={view}
				onChange={onView}
				options={[
					{ value: 'all', label: '全部' },
					{ value: 'mistake', label: '錯題' },
					{ value: 'note', label: '筆記' },
					{ value: 'review', label: <ReviewTabLabel due={due} /> },
				]}
			/>
			{listView && (
				<>
					<div className="w-36">
						<SubjectSelect aria-label="科目" value={subjectId} onChange={onSubject} emptyLabel="所有科目" />
					</div>
					{tag && (
						<button
							type="button"
							onClick={onClearTag}
							aria-label={`清除標籤「${tag}」的篩選`}
							className="inline-flex h-9 items-center gap-1 rounded-full bg-accent-soft pr-2.5 pl-3 text-sm text-accent-ink transition-colors duration-120 ease-out hover:bg-accent-soft/70 pointer-coarse:h-11"
						>
							<Hash className="size-3.5" aria-hidden />
							{tag}
							<X className="ml-0.5 size-4" aria-hidden />
						</button>
					)}
				</>
			)}
		</div>
	);
}
