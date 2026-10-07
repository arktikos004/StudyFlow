import { NotebookPen, Pin, Plus, Search } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { NoteItem } from '../../../shared/api-types';
import { NOTES_LIST_LIMIT, REVIEW_INTERVALS } from '../../../shared/schemas';
import { usePinNote } from '../../lib/notes-queries';
import type { NotesView } from '../../lib/notes-params';
import type { useNotes } from '../../lib/queries';
import { Button, Card, cn, EmptyState, ErrorNote, PageLoader, PageStack, SectionLabel } from '../ui';
import { NoteCard } from './card';

type NoteKind = NoteItem['kind'];
const REVIEW_DAYS = REVIEW_INTERVALS.join('、');

/**
 * 清單是空的：
 * - 有篩選而且帳號有資料：找不到符合的，提供清除篩選。
 * - 帳號完全沒有資料（empty）：頁首沒有動作、篩選列也隱藏，這裡的 primary 是唯一的主要動作，旁邊一個 ghost「新增筆記」。
 * - 有其他種類的資料、只是這個分類是空的：頁首已經有主要動作，這裡用 secondary。
 */
function NotesEmpty({
	empty,
	filtered,
	query,
	view,
	onNew,
	onClear,
}: {
	empty: boolean;
	filtered: boolean;
	query: string;
	view: Exclude<NotesView, 'review'>;
	onNew: (kind: NoteKind) => void;
	onClear: () => void;
}) {
	if (filtered && !empty)
		return (
			<Card>
				<EmptyState
					icon={<Search />}
					title="找不到符合的筆記"
					description={query ? `沒有標題、內容或題目包含「${query}」的筆記，換個關鍵字試試。` : '換個科目或標籤試試。'}
					action={<Button onClick={onClear}>清除篩選</Button>}
				/>
			</Card>
		);
	if (empty)
		return (
			<Card>
				<EmptyState
					icon={<NotebookPen />}
					title="還沒有筆記或錯題"
					description={`把寫錯的題目記下來，系統會在第 ${REVIEW_DAYS} 天提醒你複習；上課重點與公式也可以記成筆記。`}
					action={
						<div className="flex flex-wrap justify-center gap-2">
							<Button variant="primary" onClick={() => onNew('mistake')}>
								<Plus className="size-4" aria-hidden />
								新增第一題錯題
							</Button>
							<Button variant="ghost" onClick={() => onNew('note')}>
								<NotebookPen className="size-4" aria-hidden />
								新增筆記
							</Button>
						</div>
					}
				/>
			</Card>
		);
	const isNoteView = view === 'note';
	return (
		<Card>
			<EmptyState
				icon={<NotebookPen />}
				title={isNoteView ? '還沒有筆記' : '還沒有錯題'}
				description={
					isNoteView ? '整理上課重點或公式，之後用搜尋就能找到。' : `把寫錯的題目記下來，系統會在第 ${REVIEW_DAYS} 天提醒你複習。`
				}
				action={
					<Button onClick={() => onNew(isNoteView ? 'note' : 'mistake')}>
						<Plus className="size-4" aria-hidden />
						{isNoteView ? '新增第一則筆記' : '新增第一題錯題'}
					</Button>
				}
			/>
		</Card>
	);
}

function NoteGrid({ notes, renderNote }: { notes: NoteItem[]; renderNote: (note: NoteItem) => ReactNode }) {
	return (
		<ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
			{notes.map((n) => (
				<li key={n.id} className="min-w-0">
					{renderNote(n)}
				</li>
			))}
		</ul>
	);
}

/** 筆記列表：釘選的在前（後端排序，前端只依 pinned 分段，不重排）。查詢由頁面負責（頁首摘要也要用數量） */
export function NotesList({
	notesQuery,
	empty,
	query,
	filtered,
	view,
	today,
	timeZone,
	onOpen,
	onTag,
	onNew,
	onClear,
}: {
	notesQuery: ReturnType<typeof useNotes>;
	/** 本人一則筆記或錯題都沒有：空狀態負責唯一的主要動作（頁首不放、篩選列隱藏） */
	empty: boolean;
	query: string;
	filtered: boolean;
	view: Exclude<NotesView, 'review'>;
	today: string;
	timeZone: string;
	onOpen: (note: NoteItem) => void;
	onTag: (tag: string) => void;
	onNew: (kind: NoteKind) => void;
	onClear: () => void;
}) {
	const { data: notes, isPending, error, isPlaceholderData, refetch, isRefetching } = notesQuery;
	const pin = usePinNote();
	const pinning = pin.isPending ? pin.variables?.id : undefined;

	// 釘選後卡片會移到別的位置（重新掛載），焦點會掉到 body：清單更新後放回同一則的釘選按鈕
	const refocus = useRef<string | null>(null);
	useEffect(() => {
		const id = refocus.current;
		if (!id || pin.isPending) return;
		refocus.current = null;
		if (document.activeElement && document.activeElement !== document.body) return;
		document.querySelector<HTMLElement>(`[data-pin-id="${CSS.escape(id)}"]`)?.focus();
	}, [notes, pin.isPending]);

	if (isPending) return <PageLoader />;
	if (error) return <ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
	if (notes.length === 0) return <NotesEmpty empty={empty} filtered={filtered} query={query} view={view} onNew={onNew} onClear={onClear} />;

	const pinned = notes.filter((n) => n.pinned);
	const rest = notes.filter((n) => !n.pinned);
	const card = (n: NoteItem) => (
		<NoteCard
			note={n}
			today={today}
			timeZone={timeZone}
			query={query}
			pinBusy={pinning === n.id}
			onOpen={() => onOpen(n)}
			onPin={() => {
				refocus.current = n.id;
				pin.mutate({ id: n.id, pinned: !n.pinned });
			}}
			onTag={onTag}
		/>
	);

	return (
		<>
			{/* 數量顯示在頁首摘要；這裡只給螢幕報讀器（搜尋、篩選後念出找到幾則）。超過上限時才看得到 */}
			<p role="status" className={cn(notes.length >= NOTES_LIST_LIMIT ? 'mb-3 text-meta text-ink-3' : 'sr-only')}>
				{filtered ? '找到' : '共'} <span className="font-num tabular-nums">{notes.length}</span> 則
				{notes.length >= NOTES_LIST_LIMIT && `，只顯示最近更新的 ${NOTES_LIST_LIMIT} 則`}
			</p>
			<PageStack
				className={cn('transition-opacity duration-120', isPlaceholderData && 'opacity-60')}
				aria-busy={isPlaceholderData || undefined}
			>
				{pinned.length > 0 && (
					<section>
						<SectionLabel icon={<Pin className="fill-current" aria-hidden />} count={pinned.length} countUnit="則" className="mb-2.5 px-1">
							已釘選
						</SectionLabel>
						<NoteGrid notes={pinned} renderNote={card} />
					</section>
				)}
				{rest.length > 0 && (
					<section>
						{pinned.length > 0 ? (
							<SectionLabel count={rest.length} countUnit="則" className="mb-2.5 px-1">
								其他
							</SectionLabel>
						) : (
							<h2 className="sr-only">筆記列表</h2>
						)}
						<NoteGrid notes={rest} renderNote={card} />
					</section>
				)}
			</PageStack>
		</>
	);
}
