import { Hash, NotebookPen, Pin, Plus, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { NoteItem } from '../../shared/api-types';
import { today as todayOf } from '../../shared/dates';
import { NoteCard, NoteDetail, NoteEditor, ReviewView, type ReviewMode } from '../components/notes';
import { SubjectSelect } from '../components/subjects';
import { Button, Card, cn, EmptyState, ErrorNote, Input, PageHeader, PageLoader, Segmented } from '../components/ui';
import { REVIEW_INTERVALS } from '../../shared/schemas';
import { ApiError } from '../lib/api';
import { usePinNote } from '../lib/notes-queries';
import { useNote, useNotes, useSubjects, useSummary, useUser, type NoteFilters } from '../lib/queries';
import { useDeepLink } from '../lib/timer-queries';

type View = 'all' | 'mistake' | 'note' | 'review';
const VIEWS: readonly View[] = ['all', 'mistake', 'note', 'review'];
type Kind = 'note' | 'mistake';

function useDebounced<T>(value: T, ms = 300) {
	const [v, setV] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms);
		return () => clearTimeout(id);
	}, [value, ms]);
	return v;
}

function Section({ title, icon, count, children }: { title: string; icon?: ReactNode; count?: number; children: ReactNode }) {
	return (
		<section className="space-y-2.5">
			<h2 className="flex items-center gap-1.5 text-meta font-semibold text-ink-2 [&_svg]:size-4">
				{icon}
				{title}
				{count !== undefined && <span className="font-num font-normal text-ink-3 tabular-nums">{count}</span>}
			</h2>
			{children}
		</section>
	);
}

/** 筆記列表：釘選的在前（後端排序，前端只依 pinned 分段，不重排） */
function NotesList({
	filters,
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
	filters: NoteFilters;
	query: string;
	filtered: boolean;
	view: Exclude<View, 'review'>;
	today: string;
	timeZone: string;
	onOpen: (note: NoteItem) => void;
	onTag: (tag: string) => void;
	onNew: (kind: Kind) => void;
	onClear: () => void;
}) {
	const { data: notes, isPending, error, isPlaceholderData } = useNotes(filters);
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
	if (error) return <ErrorNote error={error} />;

	if (notes.length === 0) {
		if (filtered)
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
		const note = view === 'note';
		return (
			<Card>
				<EmptyState
					icon={<NotebookPen />}
					title={note ? '還沒有筆記' : view === 'mistake' ? '還沒有錯題' : '還沒有筆記或錯題'}
					description={
						note
							? '整理上課重點或公式，之後用搜尋就能找到。'
							: `把寫錯的題目記下來，系統會在第 ${REVIEW_INTERVALS.join('、')} 天提醒你複習。`
					}
					action={
						<Button variant="primary" onClick={() => onNew(note ? 'note' : 'mistake')}>
							<Plus className="size-4" aria-hidden />
							{note ? '新增第一則筆記' : '新增第一題錯題'}
						</Button>
					}
				/>
			</Card>
		);
	}

	const pinned = notes.filter((n) => n.pinned);
	const rest = notes.filter((n) => !n.pinned);
	const grid = (list: NoteItem[]) => (
		<ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
			{list.map((n) => (
				<li key={n.id} className="min-w-0">
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
				</li>
			))}
		</ul>
	);

	return (
		<div className={cn('space-y-6 transition-opacity duration-120', isPlaceholderData && 'opacity-60')} aria-busy={isPlaceholderData || undefined}>
			<p role="status" className="text-meta text-ink-3">
				{filtered ? '找到' : '共'} <span className="font-num tabular-nums">{notes.length}</span> 則
				{notes.length >= 500 && '，只顯示最近更新的 500 則'}
			</p>
			{pinned.length > 0 && (
				<Section title="已釘選" icon={<Pin className="fill-current" aria-hidden />} count={pinned.length}>
					{grid(pinned)}
				</Section>
			)}
			{rest.length > 0 &&
				(pinned.length > 0 ? (
					<Section title="其他" count={rest.length}>
						{grid(rest)}
					</Section>
				) : (
					<section>
						<h2 className="sr-only">筆記列表</h2>
						{grid(rest)}
					</section>
				))}
		</div>
	);
}

export function NotesPage() {
	const user = useUser();
	const today = todayOf(user.timezone);
	const [params, setParams] = useSearchParams();
	const subjects = useSubjects();
	const summary = useSummary();

	// 畫面狀態放在網址：view、mode（複習方式）、subject、tag（單科頁與考試頁的「複習這科錯題」會帶 mode=cram&subject=）
	const viewParam = params.get('view') as View | null;
	const view: View = viewParam && VIEWS.includes(viewParam) ? viewParam : 'all';
	const mode: ReviewMode = params.get('mode') === 'cram' ? 'cram' : 'due';
	const subjectParam = params.get('subject');
	const subjectId = subjectParam && subjects.data?.some((s) => s.id === subjectParam) ? subjectParam : null;
	const subjectMissing = !!subjectParam && !!subjects.data && !subjectId;
	const tag = params.get('tag') || null;

	const updateParams = useCallback(
		(patch: Record<string, string | null | undefined>) =>
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
	const setView = (v: View) => updateParams({ view: v === 'all' ? null : v, mode: v === 'review' ? undefined : null });

	const [search, setSearch] = useState('');
	const q = useDebounced(search.trim());
	const [opened, setOpened] = useState<{ id: string; note?: NoteItem } | null>(null);
	const [editor, setEditor] = useState<{ note?: NoteItem; kind?: Kind } | null>(null);

	// 深連結：?open=<id> 開啟筆記、?new=mistake|note 新增；處理後由 useDeepLink 用 replace 清掉
	const link = useDeepLink(['open', 'new']);
	const [seenLink, setSeenLink] = useState(0);
	if (link.seq !== seenLink) {
		setSeenLink(link.seq);
		if (link.values.open) setOpened({ id: link.values.open });
		if (link.values.new) setEditor({ kind: link.values.new === 'note' ? 'note' : 'mistake' });
	}

	const { data: openNote, error: openError } = useNote(opened?.id);
	// 深連結的筆記打不開（被刪除、不是本人的、離線）：說明原因；對話框因為沒有內容不會打開
	const openFailed = !!opened && !opened.note && !!openError;
	useEffect(() => {
		if (!openFailed) return;
		toast.error(
			openError instanceof ApiError && openError.status === 404
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

	return (
		<div>
			<PageHeader
				title="筆記與錯題"
				description={due === undefined ? undefined : due > 0 ? `今天有 ${due} 題待複習` : '今天沒有待複習的題目'}
				actions={
					view !== 'review' && (
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

			<div className="mb-5 flex flex-wrap items-center gap-2">
				<Segmented
					label="分類"
					value={view}
					onChange={setView}
					options={[
						{ value: 'all', label: '全部' },
						{ value: 'mistake', label: '錯題' },
						{ value: 'note', label: '筆記' },
						{
							value: 'review',
							label: (
								<span className="inline-flex items-center gap-1.5">
									複習
									{!!due && (
										<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning-soft px-1.5 font-num text-caption font-semibold text-warning tabular-nums">
											{due}
											<span className="sr-only">題待複習</span>
										</span>
									)}
								</span>
							),
						},
					]}
				/>
				{view !== 'review' && (
					<>
						<div className="w-36">
							<SubjectSelect aria-label="科目" value={subjectId} onChange={(v) => updateParams({ subject: v })} emptyLabel="所有科目" />
						</div>
						<div className="relative min-w-48 flex-1 sm:max-w-xs">
							<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
							<Input
								className="pl-9"
								type="search"
								placeholder="搜尋筆記"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								maxLength={100}
								aria-label="搜尋筆記"
							/>
						</div>
						{tag && (
							<button
								type="button"
								onClick={() => updateParams({ tag: null })}
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

			{subjectMissing && (
				<p role="status" className="mb-4 text-meta text-ink-3">
					找不到連結裡的科目，可能已經刪除了，先顯示所有科目。
				</p>
			)}

			{subjectParam && subjects.isPending ? (
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
					filters={filters}
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
