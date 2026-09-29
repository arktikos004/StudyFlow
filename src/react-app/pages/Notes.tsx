import { Brain, CheckCircle2, Image as ImageIcon, NotebookPen, Plus, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { NoteItem } from '../../shared/api-types';
import { localDate, today as todayOf } from '../../shared/dates';
import { MistakeBody, MarkdownView, NoteDetail, NoteEditor, PhotoGrid } from '../components/notes';
import { SubjectSelect, SubjectTag } from '../components/subjects';
import { Badge, Button, Card, cn, EmptyState, ErrorNote, Input, PageHeader, PageLoader, Segmented } from '../components/ui';
import { attachmentUrl } from '../lib/api';
import { formatDate } from '../lib/format';
import { useNote, useNotes, useReviewNote, useUser, type NoteFilters } from '../lib/queries';

type View = 'all' | 'mistake' | 'note' | 'review';

function useDebounced<T>(value: T, ms = 300) {
	const [v, setV] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms);
		return () => clearTimeout(id);
	}, [value, ms]);
	return v;
}

function snippet(n: NoteItem) {
	const text = (n.kind === 'mistake' ? (n.question ?? n.reason ?? n.content) : n.content) ?? '';
	return text.replace(/[#>*`_~-]/g, '').slice(0, 120);
}

function NoteCard({
	note,
	today,
	tz,
	onOpen,
	onTag,
}: {
	note: NoteItem;
	today: string;
	tz: string;
	onOpen: () => void;
	onTag: (t: string) => void;
}) {
	const cover = note.attachments[0];
	return (
		<Card as="article" className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
			<button onClick={onOpen} className="flex flex-1 flex-col text-left">
				{cover && (
					<div className="relative h-32 bg-subtle">
						<img src={attachmentUrl(cover.id)} alt="" loading="lazy" className="size-full object-cover" />
						{note.attachments.length > 1 && (
							<span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
								<ImageIcon className="size-3" aria-hidden />
								{note.attachments.length}
							</span>
						)}
					</div>
				)}
				<div className="flex flex-1 flex-col p-4">
					<div className="mb-1.5 flex flex-wrap items-center gap-1.5">
						<Badge tone={note.kind === 'mistake' ? 'danger' : 'accent'}>{note.kind === 'mistake' ? '錯題' : '筆記'}</Badge>
						{note.mastered && (
							<Badge tone="success">
								<CheckCircle2 className="size-3" aria-hidden />
								已掌握
							</Badge>
						)}
						{!note.mastered && note.nextReviewDate && note.nextReviewDate <= today && (
							<Badge tone="warning">
								<Brain className="size-3" aria-hidden />
								待複習
							</Badge>
						)}
					</div>
					<h3 className="line-clamp-2 font-semibold break-words">{note.title}</h3>
					{snippet(note) && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{snippet(note)}</p>}
					<div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-ink-3">
						<SubjectTag subjectId={note.subjectId} />
						<span className="shrink-0">{formatDate(localDate(note.updatedAt, tz))}</span>
					</div>
				</div>
			</button>
			{note.tags.length > 0 && (
				<div className="flex flex-wrap gap-1 px-4 pb-3">
					{note.tags.map((t) => (
						<button key={t} onClick={() => onTag(t)} className="rounded bg-subtle px-1.5 py-0.5 text-xs text-ink-2 hover:text-ink">
							#{t}
						</button>
					))}
				</div>
			)}
		</Card>
	);
}

/** 複習模式：一次一題，先想答案再翻開 */
function ReviewSession({ subjectId, onExit }: { subjectId: string | null; onExit: () => void }) {
	const { data, isPending, error } = useNotes({ review: 'due', ...(subjectId ? { subjectId } : {}) });
	if (isPending) return <PageLoader />;
	if (error) return <ErrorNote error={error} />;
	return <ReviewRunner initial={data} onExit={onExit} />;
}

function ReviewRunner({ initial, onExit }: { initial: NoteItem[]; onExit: () => void }) {
	const review = useReviewNote();
	// 開始時固定題目順序，避免作答後清單重新整理造成跳題
	const [queue] = useState(initial);
	const [index, setIndex] = useState(0);
	const [revealed, setRevealed] = useState(false);
	const [stats, setStats] = useState({ remembered: 0, forgot: 0 });

	if (queue.length === 0)
		return (
			<Card>
				<EmptyState
					icon={<Sparkles />}
					title="今天沒有需要複習的題目"
					description="新增的錯題會在隔天開始出現在這裡。"
					action={<Button onClick={onExit}>回到列表</Button>}
				/>
			</Card>
		);

	if (index >= queue.length)
		return (
			<Card className="p-8 text-center">
				<Sparkles className="mx-auto mb-3 size-10 text-accent" aria-hidden />
				<h2 className="text-xl font-semibold">今天的複習完成了！</h2>
				<p className="mt-2 text-ink-2">
					記住 {stats.remembered} 題・還不熟 {stats.forgot} 題
				</p>
				<p className="mt-1 text-sm text-ink-3">還不熟的題目明天會再出現，記住的會隔更久再複習。</p>
				<Button variant="primary" className="mt-6" onClick={onExit}>
					回到列表
				</Button>
			</Card>
		);

	const note = queue[index];
	const answer = async (result: 'remembered' | 'forgot') => {
		await review.mutateAsync({ id: note.id, result }).catch(() => {});
		setStats((s) => ({ ...s, [result]: s[result] + 1 }));
		setRevealed(false);
		setIndex((i) => i + 1);
	};

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-3 flex items-center justify-between">
				<span className="text-sm text-ink-2 tabular-nums">
					第 {index + 1} / {queue.length} 題
				</span>
				<Button size="sm" variant="ghost" onClick={onExit}>
					<X className="size-4" aria-hidden />
					結束複習
				</Button>
			</div>
			<div className="mb-4 h-1.5 overflow-hidden rounded-full bg-subtle">
				<div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
			</div>
			<Card className="p-5 sm:p-6">
				<div className="mb-2 flex items-center gap-2">
					<SubjectTag subjectId={note.subjectId} />
					<span className="text-xs text-ink-3">第 {note.reviewStage + 1} 輪</span>
				</div>
				<h2 className="mb-4 text-lg font-semibold break-words">{note.title}</h2>
				{note.kind === 'mistake' ? (
					<MistakeBody note={note} revealAnswer={revealed} />
				) : revealed ? (
					<div className="space-y-4">
						{note.content && <MarkdownView>{note.content}</MarkdownView>}
						<PhotoGrid attachments={note.attachments} />
					</div>
				) : (
					<p className="text-sm text-ink-2">先回想這則筆記的重點，再翻開確認。</p>
				)}
			</Card>
			<div className="sticky bottom-20 mt-4 flex gap-3 md:bottom-4">
				{!revealed ? (
					<Button variant="primary" className="h-12 flex-1 text-base" onClick={() => setRevealed(true)}>
						顯示答案
					</Button>
				) : (
					<>
						<Button className="h-12 flex-1 text-base" onClick={() => answer('forgot')} disabled={review.isPending}>
							還不熟
						</Button>
						<Button variant="primary" className="h-12 flex-1 text-base" onClick={() => answer('remembered')} disabled={review.isPending}>
							記住了
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

export function NotesPage() {
	const user = useUser();
	const today = todayOf(user.timezone);
	const [params, setParams] = useSearchParams();
	const view = (params.get('view') as View) || 'all';
	const [subjectId, setSubjectId] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [tag, setTag] = useState<string | null>(null);
	const q = useDebounced(search.trim());
	const [openId, setOpenId] = useState<string | null>(null);
	const [editor, setEditor] = useState<{ note?: NoteItem; kind?: 'note' | 'mistake' } | null>(null);

	const filters: NoteFilters = useMemo(
		() => ({
			...(view === 'mistake' || view === 'note' ? { kind: view } : {}),
			...(subjectId ? { subjectId } : {}),
			...(q ? { q } : {}),
			...(tag ? { tag } : {}),
		}),
		[view, subjectId, q, tag],
	);
	const { data: notes, isPending, error, isPlaceholderData } = useNotes(filters);
	const { data: dueNotes } = useNotes({ review: 'due' });
	const { data: openNote } = useNote(openId ?? undefined);
	const setView = (v: View) => setParams(v === 'all' ? {} : { view: v }, { replace: true });

	return (
		<div>
			<PageHeader
				title="筆記與錯題"
				description="整理重點、記錄錯題，並用間隔複習把弱點變強項"
				actions={
					view !== 'review' && (
						<>
							<Button onClick={() => setEditor({ kind: 'note' })}>
								<NotebookPen className="size-4" aria-hidden />
								筆記
							</Button>
							<Button variant="primary" onClick={() => setEditor({ kind: 'mistake' })}>
								<Plus className="size-4" aria-hidden />
								錯題
							</Button>
						</>
					)
				}
			/>

			<div className="mb-4 flex flex-wrap items-center gap-2">
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
								<span className="inline-flex items-center gap-1">
									複習
									{!!dueNotes?.length && (
										<span className="rounded-full bg-danger px-1.5 text-[11px] leading-4 text-white">{dueNotes.length}</span>
									)}
								</span>
							),
						},
					]}
				/>
				<div className="w-36">
					<SubjectSelect value={subjectId} onChange={setSubjectId} emptyLabel="所有科目" />
				</div>
				{view !== 'review' && (
					<div className="relative min-w-48 flex-1 sm:max-w-xs">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
						<Input
							className="pl-9"
							type="search"
							placeholder="搜尋標題、內容、題目"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							aria-label="搜尋筆記"
						/>
					</div>
				)}
				{tag && view !== 'review' && (
					<button
						onClick={() => setTag(null)}
						className="inline-flex h-8 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm text-accent-ink"
					>
						#{tag}
						<X className="size-3.5" aria-label="清除標籤篩選" />
					</button>
				)}
			</div>

			{view === 'review' ? (
				<ReviewSession key={subjectId ?? 'all'} subjectId={subjectId} onExit={() => setView('mistake')} />
			) : isPending ? (
				<PageLoader />
			) : error ? (
				<ErrorNote error={error} />
			) : notes.length === 0 ? (
				<Card>
					<EmptyState
						icon={<NotebookPen />}
						title={q || tag ? '找不到符合的內容' : '還沒有筆記或錯題'}
						description={q || tag ? '換個關鍵字試試看。' : '考完試後把錯的題目拍照記下來，系統會提醒你定期複習。'}
						action={
							!q &&
							!tag && (
								<Button size="sm" onClick={() => setEditor({ kind: 'mistake' })}>
									<Plus className="size-4" aria-hidden />
									新增第一題錯題
								</Button>
							)
						}
					/>
				</Card>
			) : (
				<div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', isPlaceholderData && 'opacity-60')}>
					{notes.map((n) => (
						<NoteCard key={n.id} note={n} today={today} tz={user.timezone} onOpen={() => setOpenId(n.id)} onTag={setTag} />
					))}
				</div>
			)}

			<NoteDetail
				note={openId ? (openNote ?? null) : null}
				today={today}
				onClose={() => setOpenId(null)}
				onEdit={(n) => {
					setOpenId(null);
					setEditor({ note: n });
				}}
			/>
			<NoteEditor open={!!editor} note={editor?.note} defaultKind={editor?.kind} onClose={() => setEditor(null)} />
		</div>
	);
}
