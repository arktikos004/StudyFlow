import { NotebookPen, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { NoteItem } from '../../shared/api-types';
import { today as todayOf } from '../../shared/dates';
import { NoteDetail } from '../components/notes/detail';
import { NoteEditor } from '../components/notes/editor';
import { NotesFilterBar } from '../components/notes/filter-bar';
import { NotesList } from '../components/notes/list';
import { ReviewView } from '../components/notes/review';
import { Button, PageHeader, PageLoader } from '../components/ui';
import { useUser } from '../lib/account-queries';
import { isNotFound } from '../lib/api';
import { useDebounced } from '../lib/debounce';
import { useDeepLink } from '../lib/deep-link';
import { usePageTitle } from '../lib/document-title';
import { notesSummary } from '../lib/notes-format';
import { useNotesParams } from '../lib/notes-params';
import { useNote, useNotes, useSubjects, useSummary, type NoteFilters } from '../lib/queries';

export function NotesPage() {
	usePageTitle('筆記與錯題');
	const user = useUser();
	const today = todayOf(user.timezone);
	const subjects = useSubjects();
	const summary = useSummary();
	const { view, mode, subjectParam, subjectId, subjectMissing, tag, updateParams, setView } = useNotesParams(subjects.data);

	const [search, setSearch] = useState('');
	const q = useDebounced(search.trim());
	const [opened, setOpened] = useState<{ id: string; note?: NoteItem } | null>(null);
	const [editor, setEditor] = useState<{ note?: NoteItem; kind?: NoteItem['kind'] } | null>(null);

	// 深連結：?open=<id> 開啟筆記、?new=mistake|note 新增
	useDeepLink(['open', 'new'], ({ open, new: kind }) => {
		// ?new= 等科目載入後再開：編輯視窗的預設科目（網址的 subject）在打開的那一刻決定，冷載入時科目清單還沒到
		if (kind && subjectParam && subjects.isPending) return false;
		if (open) setOpened({ id: open });
		if (kind) setEditor({ kind: kind === 'note' ? 'note' : 'mistake' });
	});

	const { data: openNote, error: openError } = useNote(opened?.id);
	// 深連結的筆記打不開（被刪除、不是本人的、離線）：說明原因；對話框因為沒有內容不會打開
	const openFailed = !!opened && !opened.note && !!openError;
	useEffect(() => {
		if (!openFailed) return;
		toast.error(
			isNotFound(openError)
				? '找不到這則筆記，可能已經刪除了'
				: `打不開這則筆記：${openError instanceof Error ? openError.message : '請稍後再試'}`,
		);
	}, [openFailed, opened, openError]);

	const filters: NoteFilters = useMemo(
		() => ({
			...(view === 'mistake' || view === 'note' ? { kind: view } : {}),
			...(subjectId ? { subjectId } : {}),
			...(q ? { q } : {}),
			...(tag ? { tag } : {}),
		}),
		[view, subjectId, q, tag],
	);
	const filtered = !!(subjectId || q || tag);
	const due = summary.data?.reviewDueCount;
	// 列表與「帳號有沒有任何筆記」只在列表檢視需要：複習檢視不發這兩個請求
	const listView = view !== 'review';
	const notesQuery = useNotes(filters, { enabled: listView });
	// 本人完全沒有筆記與錯題（頁首摘要的總數是 0）：頁首不放主要動作、篩選列隱藏，由空狀態負責（跨頁慣例）
	const empty = listView && summary.data?.notesCount === 0;
	// 還不知道有沒有資料（冷載入）：頁首動作、篩選列、列表都先不畫，不會先出現兩組 primary 再換成空狀態
	const checking = listView && summary.isPending;
	const count = listView && !notesQuery.isPlaceholderData ? notesQuery.data?.length : undefined;
	const summaryText = notesSummary({ count, due, filtered, empty });

	return (
		<div>
			<PageHeader
				title="筆記與錯題"
				description={summaryText || undefined}
				actions={
					listView &&
					!empty &&
					!checking && (
						<>
							<Button onClick={() => setEditor({ kind: 'note' })}>
								<NotebookPen className="size-4" aria-hidden />
								新增筆記
							</Button>
							<Button variant="primary" onClick={() => setEditor({ kind: 'mistake' })}>
								<Plus className="size-4" aria-hidden />
								新增錯題
							</Button>
						</>
					)
				}
			/>

			{/* 沒有任何筆記時整列隱藏 */}
			{!empty && !checking && (
				<NotesFilterBar
					view={view}
					onView={setView}
					due={due}
					search={search}
					onSearch={setSearch}
					subjectId={subjectId}
					onSubject={(subject) => updateParams({ subject })}
					tag={tag}
					onClearTag={() => updateParams({ tag: null })}
				/>
			)}

			{subjectMissing && (
				<p role="status" className="mb-4 text-meta text-ink-3">
					找不到連結裡的科目，可能已經刪除了，先顯示所有科目。
				</p>
			)}

			{(subjectParam && subjects.isPending) || checking ? (
				<PageLoader />
			) : view === 'review' ? (
				<ReviewView
					mode={mode}
					subjectId={subjectId}
					tag={tag}
					onParams={updateParams}
					onOpenNote={(id) => setOpened({ id })}
					onNewMistake={() => setEditor({ kind: 'mistake' })}
					onBack={() => setView('mistake')}
				/>
			) : (
				<NotesList
					notesQuery={notesQuery}
					empty={empty}
					query={q}
					filtered={filtered}
					view={view}
					today={today}
					timeZone={user.timezone}
					onOpen={(note) => setOpened({ id: note.id, note })}
					onTag={(t) => updateParams({ tag: t })}
					onNew={(kind) => setEditor({ kind })}
					onClear={() => {
						setSearch('');
						updateParams({ subject: null, tag: null });
					}}
				/>
			)}

			<NoteDetail
				note={opened ? (openNote ?? opened.note ?? null) : null}
				today={today}
				timeZone={user.timezone}
				onClose={() => setOpened(null)}
				onEdit={(n) => {
					setOpened(null);
					setEditor({ note: n });
				}}
			/>
			<NoteEditor
				open={!!editor}
				note={editor?.note}
				defaultKind={editor?.kind}
				defaultSubjectId={subjectId}
				onClose={() => setEditor(null)}
			/>
		</div>
	);
}
