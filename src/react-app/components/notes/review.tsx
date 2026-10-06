import { Brain, Check, CircleAlert, CircleCheck, Eye, Plus, Repeat, RotateCcw, Shuffle, SkipForward, Sparkles, X, Zap } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { NoteItem } from '../../../shared/api-types';
import { ApiError } from '../../lib/api';
import { cramPool, cramQueue, cramTags, retryQueue, tally, type ReviewResult } from '../../lib/notes-cram';
import { useNotes, useReviewNote, useSubjectMap } from '../../lib/queries';
import { SubjectSelect, SubjectTag } from '../subjects';
import {
	Badge,
	Button,
	Card,
	cn,
	EmptyState,
	ErrorNote,
	Field,
	NumDisplay,
	PageLoader,
	ProgressBar,
	SectionLabel,
	Segmented,
	Select,
	Switch,
} from '../ui';
import { KindBadge, MistakeAnswer, MistakeQuestion, NoteBody } from './content';

// 複習（NOTE-2）：「今天到期」走間隔複習（呼叫 /notes/:id/review），
// 「考前衝刺」只在前端記錄這一輪的結果，不呼叫 useReviewNote，不影響複習排程。

export type ReviewMode = 'due' | 'cram';
type Results = Record<string, ReviewResult>;

function ModeSwitch({ value, onChange }: { value: ReviewMode; onChange: (m: ReviewMode) => void }) {
	return (
		<Segmented
			label="複習方式"
			value={value}
			onChange={onChange}
			options={[
				{ value: 'due', label: '今天到期' },
				{ value: 'cram', label: '考前衝刺' },
			]}
		/>
	);
}

// ---- 一次一題 ----

/**
 * 一次一題：先看題目、想好再「顯示答案」，然後選「還不熟」或「記住了」。
 * 焦點：顯示答案後移到答案區，換下一題時移到題目標題（按鈕會換掉，焦點不能掉到 body）。
 * record 回傳 Promise：今天到期模式送出後才換題。失敗時留在這一題，顯示原因與「跳過這題」；
 * 題目在別處被刪除（404）時自動略過。
 */
function ReviewRunner({
	queue: initialQueue,
	title,
	meta,
	record,
	autoFocus = false,
	onDone,
	onExit,
	exitLabel,
}: {
	queue: NoteItem[];
	title: string;
	meta?: (note: NoteItem) => ReactNode;
	record?: (note: NoteItem, result: ReviewResult) => Promise<void>;
	autoFocus?: boolean;
	onDone: (results: Results, queue: NoteItem[]) => void;
	onExit: (results: Results, queue: NoteItem[]) => void;
	exitLabel: string;
}) {
	// 開始時固定題目：今天到期的清單在每次作答後會重新取得（答過的不再到期），不能跟著縮短，否則會跳題
	const [queue] = useState(initialQueue);
	const [index, setIndex] = useState(0);
	const [revealed, setRevealed] = useState(false);
	const [results, setResults] = useState<Results>({});
	const [saving, setSaving] = useState<ReviewResult | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const answerRef = useRef<HTMLDivElement>(null);
	const focusNext = useRef<'heading' | 'answer' | null>(autoFocus ? 'heading' : null);
	const progressId = useId();

	useEffect(() => {
		const target = focusNext.current;
		focusNext.current = null;
		if (target === 'heading') headingRef.current?.focus();
		if (target === 'answer') answerRef.current?.focus();
	}, [index, revealed]);

	const note = queue[index];
	const counts = tally(results);

	const reveal = () => {
		focusNext.current = 'answer';
		setRevealed(true);
	};

	/** 換下一題（或結束）；略過時 next 就是原本的結果 */
	const advance = (next: Results) => {
		setFailure(null);
		setResults(next);
		if (index + 1 >= queue.length) return onDone(next, queue);
		focusNext.current = 'heading';
		setRevealed(false);
		setIndex(index + 1);
	};

	const answer = async (result: ReviewResult) => {
		if (saving) return;
		if (record) {
			setSaving(result);
			try {
				await record(note, result);
			} catch (e) {
				if (e instanceof ApiError && e.status === 404) {
					toast.info('這題已經被刪除，先跳過');
					return advance(results);
				}
				setFailure(e instanceof Error ? e.message : '請稍後再試');
				answerRef.current?.focus();
				return;
			} finally {
				setSaving(null);
			}
		}
		advance({ ...results, [note.id]: result });
	};

	return (
		<div>
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="min-w-0 truncate text-meta text-ink-2" title={title}>
					{title}
				</p>
				<Button size="sm" variant="ghost" className="-mr-2" onClick={() => onExit(results, queue)}>
					<X className="size-4" aria-hidden />
					{exitLabel}
				</Button>
			</div>
			<div className="mb-1.5 flex items-baseline justify-between gap-3 text-meta">
				<span id={progressId} className="text-ink-2">
					第 <span className="font-num font-semibold text-ink tabular-nums">{index + 1}</span>
					<span className="font-num tabular-nums">／{queue.length}</span> 題
				</span>
				<span className="text-ink-3">
					記住 <span className="font-num tabular-nums">{counts.remembered}</span>，還不熟{' '}
					<span className="font-num tabular-nums">{counts.forgot}</span>
				</span>
			</div>
			<ProgressBar value={index} max={queue.length} size="sm" labelledBy={progressId} valueText={`已作答 ${index}／${queue.length} 題`} />

			<Card as="article" className="mt-4 p-4 sm:p-6">
				<div className="mb-2 flex flex-wrap items-center gap-1.5">
					<KindBadge kind={note.kind} />
					<SubjectTag subjectId={note.subjectId} />
					{meta?.(note)}
				</div>
				<h2 ref={headingRef} tabIndex={-1} className="mb-4 rounded-sm text-h2 font-semibold wrap-anywhere outline-offset-4">
					{note.title}
				</h2>
				{note.kind === 'mistake' && <MistakeQuestion note={note} />}
				{revealed ? (
					<div
						ref={answerRef}
						tabIndex={-1}
						role="region"
						aria-label="答案"
						className={cn('rounded-sm outline-offset-4', note.kind === 'mistake' && 'mt-5 border-t border-line pt-5')}
					>
						{note.kind === 'mistake' ? <MistakeAnswer note={note} /> : <NoteBody note={note} />}
					</div>
				) : (
					<p className={cn('text-meta text-ink-3', note.kind === 'mistake' && 'mt-4')}>
						{note.kind === 'mistake' ? '先在心裡作答，再顯示答案對照。' : '先回想這則筆記的重點，再顯示內容確認。'}
					</p>
				)}
			</Card>

			{failure && (
				<div
					role="alert"
					className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-danger-soft py-2 pr-2 pl-4 text-sm text-danger"
				>
					<span className="inline-flex min-w-0 items-start gap-1.5 py-1">
						<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
						這題沒有記錄成功（{failure}），可以再選一次，或先跳過
					</span>
					<Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => advance(results)}>
						<SkipForward className="size-4" aria-hidden />
						跳過這題
					</Button>
				</div>
			)}

			{/* 手機：貼在底部導覽上方（64px + 1px 邊框 + safe area），實心底蓋住捲到後面的內容 */}
			<div className="sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-1 flex gap-3 bg-page px-4 py-3 md:bottom-0 md:mx-0 md:px-0 md:py-4">
				{!revealed ? (
					<Button variant="primary" size="lg" className="flex-1" onClick={reveal}>
						<Eye className="size-5" aria-hidden />
						顯示答案
					</Button>
				) : (
					<>
						<Button
							size="lg"
							className="flex-1"
							onClick={() => answer('forgot')}
							loading={saving === 'forgot'}
							aria-disabled={!!saving || undefined}
						>
							<RotateCcw className="size-5" aria-hidden />
							還不熟
						</Button>
						<Button
							variant="primary"
							size="lg"
							className="flex-1"
							onClick={() => answer('remembered')}
							loading={saving === 'remembered'}
							aria-disabled={!!saving || undefined}
						>
							<Check className="size-5" aria-hidden />
							記住了
						</Button>
					</>
				)}
			</div>
		</div>
	);
}

// ---- 結果 ----

function RoundSummary({
	title,
	results,
	queue,
	note,
	actions,
	onOpenNote,
}: {
	title: string;
	results: Results;
	queue: NoteItem[];
	note: string;
	actions: ReactNode;
	onOpenNote: (id: string) => void;
}) {
	const counts = tally(results);
	const forgot = retryQueue(queue, results);
	const headingRef = useRef<HTMLHeadingElement>(null);
	useEffect(() => headingRef.current?.focus(), []);
	return (
		<Card className="overflow-hidden">
			<div className="flex flex-col items-center px-4 pt-8 pb-6 text-center sm:px-8">
				<span className="mb-3 grid size-12 place-items-center rounded-full bg-success-soft text-success" aria-hidden>
					<CircleCheck className="size-6" />
				</span>
				<h2 ref={headingRef} tabIndex={-1} className="rounded-sm text-h2 font-semibold outline-offset-4">
					{title}
				</h2>
				<p className="mt-1 max-w-md text-sm text-pretty text-ink-2">{note}</p>
			</div>
			<dl className="grid grid-cols-2 border-t border-line">
				<div className="px-4 py-3 text-center sm:px-5">
					<dt className="text-meta text-ink-2">記住了</dt>
					<dd>
						<NumDisplay unit="題">{counts.remembered}</NumDisplay>
					</dd>
				</div>
				<div className="border-l border-line px-4 py-3 text-center sm:px-5">
					<dt className="text-meta text-ink-2">還不熟</dt>
					<dd>
						<NumDisplay unit="題">{counts.forgot}</NumDisplay>
					</dd>
				</div>
			</dl>
			{forgot.length > 0 && (
				<div className="border-t border-line px-2 py-2 sm:px-3">
					<SectionLabel as="h3" className="px-2 pt-1 pb-1">
						還不熟的題目
					</SectionLabel>
					<ul>
						{forgot.map((n) => (
							<li key={n.id}>
								<button
									type="button"
									onClick={() => onOpenNote(n.id)}
									className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-dense transition-colors duration-120 ease-out hover:bg-subtle"
								>
									<RotateCcw className="size-4 shrink-0 text-ink-3" aria-hidden />
									<span className="min-w-0 flex-1 truncate">{n.title}</span>
									<SubjectTag subjectId={n.subjectId} variant="compact" className="hidden shrink-0 sm:inline-flex" />
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			<div className="flex flex-wrap justify-center gap-2 border-t border-line px-4 py-4 sm:px-5">{actions}</div>
		</Card>
	);
}

// ---- 今天到期 ----

/**
 * 今天沒有到期的題目：分成「根本還沒有錯題」與「到期的都複習完了」兩種，文案不一樣。
 * 只在佇列是空的時候才掛載，所以只有這時候才多查一次錯題清單（key 和考前衝刺相同，共用快取）。
 */
function DueEmpty({
	subjectId,
	onMode,
	onNewMistake,
}: {
	subjectId: string | null;
	onMode: (m: ReviewMode) => void;
	onNewMistake: () => void;
}) {
	const { data } = useNotes({ kind: 'mistake', ...(subjectId ? { subjectId } : {}) });
	if (!data) return <PageLoader />;
	if (data.length === 0)
		return (
			<Card>
				<EmptyState
					icon={<Sparkles />}
					title={subjectId ? '這一科還沒有錯題要複習' : '還沒有錯題要複習'}
					description="把寫錯的題目記下來，隔天就會出現在這裡提醒你複習。"
					action={
						<Button variant="primary" onClick={onNewMistake}>
							<Plus className="size-4" aria-hidden />
							新增錯題
						</Button>
					}
				/>
			</Card>
		);
	return (
		<Card>
			<EmptyState
				icon={<Sparkles />}
				title={subjectId ? '這一科今天的複習都完成了' : '今天的複習都完成了'}
				description="之後到期的錯題會出現在這裡。想多練習，可以改用考前衝刺。"
				action={
					<Button variant="primary" onClick={() => onMode('cram')}>
						<Zap className="size-4" aria-hidden />
						改用考前衝刺
					</Button>
				}
			/>
		</Card>
	);
}

function DueReview({
	subjectId,
	onSubject,
	onMode,
	onOpenNote,
	onBack,
	onNewMistake,
}: {
	subjectId: string | null;
	onSubject: (id: string | null) => void;
	onMode: (m: ReviewMode) => void;
	onOpenNote: (id: string) => void;
	onBack: () => void;
	onNewMistake: () => void;
}) {
	const { data, error, isFetching, isFetchedAfterMount, isPlaceholderData, refetch } = useNotes({
		review: 'due',
		...(subjectId ? { subjectId } : {}),
	});
	const review = useReviewNote();
	const [queue, setQueue] = useState<NoteItem[] | null>(null);
	const [done, setDone] = useState<{ queue: NoteItem[]; results: Results } | null>(null);

	// 換科目：重新開始
	const [seenSubject, setSeenSubject] = useState(subjectId);
	if (seenSubject !== subjectId) {
		setSeenSubject(subjectId);
		setQueue(null);
		setDone(null);
	}

	// 進入（或換科目）時一定重新取得一次：快取可能是舊的，已掌握或不再到期的題目不能再問，
	// 作答也會再推進一次排程。取得完成後才固定題目，之後作答造成的重新取得都不影響進行中的複習。
	useEffect(() => {
		void refetch({ cancelRefetch: false });
	}, [subjectId, refetch]);
	if (queue === null && data && isFetchedAfterMount && !isFetching && !isPlaceholderData && !error) setQueue(data);

	let body: ReactNode;
	if (done)
		body = (
			<RoundSummary
				title="今天的複習完成了"
				note="還不熟的題目明天會再出現，記住的會隔更久再複習。"
				results={done.results}
				queue={done.queue}
				onOpenNote={onOpenNote}
				actions={
					<>
						<Button onClick={() => onMode('cram')}>
							<Zap className="size-4" aria-hidden />
							再做考前衝刺
						</Button>
						<Button variant="primary" onClick={onBack}>
							回到錯題列表
						</Button>
					</>
				}
			/>
		);
	else if (queue && queue.length === 0) body = <DueEmpty subjectId={subjectId} onMode={onMode} onNewMistake={onNewMistake} />;
	else if (queue)
		// 已經開始：之後的重新取得（包括失敗）都不影響進行中的複習
		body = (
			<ReviewRunner
				key={subjectId ?? 'all'}
				queue={queue}
				title="作答後會排定下次複習的日期"
				meta={(n) => <span className="text-meta text-ink-3">第 {n.reviewStage + 1} 輪</span>}
				record={async (n, result) => {
					await review.mutateAsync({ id: n.id, result });
				}}
				onDone={(results, q) => setDone({ queue: q, results })}
				onExit={onBack}
				exitLabel="結束複習"
			/>
		);
	else if (error && !isFetching) body = <ErrorNote error={error} onRetry={() => void refetch()} />;
	else body = <PageLoader />;

	return (
		<>
			{!done && (
				<div className="mb-4 flex flex-wrap items-center gap-2">
					<ModeSwitch value="due" onChange={onMode} />
					<SubjectSelect aria-label="科目" value={subjectId} onChange={onSubject} emptyLabel="所有科目" />
				</div>
			)}
			{body}
		</>
	);
}

// ---- 考前衝刺 ----

/** queue 是這一輪實際作答的題目；pool 是這次衝刺的完整題目（「再練還不熟」之後「整輪重來」仍用完整題目） */
type CramStage =
	| { step: 'setup' }
	| { step: 'run'; queue: NoteItem[]; pool: NoteItem[]; round: number }
	| { step: 'done'; queue: NoteItem[]; pool: NoteItem[]; results: Results; complete: boolean };

/** 後端列表最多回傳 500 則（routes/notes.ts 的 limit） */
const LIST_LIMIT = 500;

function CramReview({
	subjectId,
	tag,
	onScope,
	onMode,
	onOpenNote,
	onNewMistake,
}: {
	subjectId: string | null;
	tag: string | null;
	onScope: (scope: { subject?: string | null; tag?: string | null }) => void;
	onMode: (m: ReviewMode) => void;
	onOpenNote: (id: string) => void;
	onNewMistake: () => void;
}) {
	const { data, isPending, error, isPlaceholderData, refetch, isRefetching } = useNotes({
		kind: 'mistake',
		...(subjectId ? { subjectId } : {}),
	});
	const subjects = useSubjectMap();
	const [random, setRandom] = useState(true);
	const [includeMastered, setIncludeMastered] = useState(false);
	const [stage, setStage] = useState<CramStage>({ step: 'setup' });
	const [round, setRound] = useState(0);

	// 從一輪回到設定時，焦點放在設定卡的標題（按鈕會消失，焦點不能掉到 body）
	const setupHeading = useRef<HTMLHeadingElement>(null);
	const focusSetup = useRef(false);
	const toSetup = () => {
		focusSetup.current = true;
		setStage({ step: 'setup' });
	};
	useEffect(() => {
		if (stage.step !== 'setup' || !focusSetup.current) return;
		focusSetup.current = false;
		setupHeading.current?.focus();
	}, [stage]);

	// 從別的連結換了科目或標籤：回到設定
	const scope = `${subjectId}|${tag}`;
	const [seenScope, setSeenScope] = useState(scope);
	if (scope !== seenScope) {
		setSeenScope(scope);
		setStage({ step: 'setup' });
	}

	const subjectName = subjectId ? subjects.get(subjectId)?.name : undefined;
	const scopeText = [subjectName ?? '所有科目', tag && `標籤「${tag}」`].filter(Boolean).join('，');
	const notes = data ?? [];
	const pool = cramPool(notes, { tag, includeMastered });
	const masteredLeft = includeMastered ? 0 : cramPool(notes, { tag, includeMastered: true }).length - pool.length;
	const tags = cramTags(notes, includeMastered);
	if (tag && !tags.some((t) => t.tag === tag)) tags.unshift({ tag, count: 0 });

	const run = (queue: NoteItem[], all: NoteItem[]) => {
		setRound((r) => r + 1);
		setStage({ step: 'run', queue, pool: all, round: round + 1 });
	};
	const start = () => {
		const queue = cramQueue(pool, random);
		run(queue, queue);
	};

	if (stage.step === 'run')
		return (
			<ReviewRunner
				key={stage.round}
				queue={stage.queue}
				title={`考前衝刺，${scopeText}`}
				meta={(n) =>
					n.mastered && (
						<Badge tone="success" icon={<CircleCheck aria-hidden />}>
							已掌握
						</Badge>
					)
				}
				autoFocus
				onDone={(results) => setStage({ step: 'done', queue: stage.queue, pool: stage.pool, results, complete: true })}
				onExit={(results) =>
					Object.keys(results).length
						? setStage({ step: 'done', queue: stage.queue, pool: stage.pool, results, complete: false })
						: toSetup()
				}
				exitLabel="結束衝刺"
			/>
		);

	if (stage.step === 'done') {
		const { queue, pool: all, results, complete } = stage;
		const forgot = retryQueue(queue, results);
		const answered = Object.keys(results).length;
		return (
			<>
				<div className="mb-4">
					<ModeSwitch value="cram" onChange={onMode} />
				</div>
				<RoundSummary
					title={complete ? '這一輪衝刺完成了' : `這一輪答了 ${answered}／${queue.length} 題`}
					note="衝刺的作答只記在這一輪，不會改變間隔複習的排程。"
					results={results}
					queue={queue}
					onOpenNote={onOpenNote}
					actions={
						<>
							<Button variant="ghost" onClick={toSetup}>
								調整範圍
							</Button>
							<Button variant={forgot.length ? 'secondary' : 'primary'} onClick={() => run(cramQueue(all, random), all)}>
								{random ? <Shuffle className="size-4" aria-hidden /> : <Repeat className="size-4" aria-hidden />}
								整輪重來（{all.length} 題）
							</Button>
							{forgot.length > 0 && (
								<Button variant="primary" onClick={() => run(forgot, all)}>
									<RotateCcw className="size-4" aria-hidden />
									再練還不熟的 {forgot.length} 題
								</Button>
							)}
						</>
					}
				/>
			</>
		);
	}

	const loading = isPending || isPlaceholderData;
	return (
		<>
			<div className="mb-4">
				<ModeSwitch value="cram" onChange={onMode} />
			</div>
			<Card>
				<div className="flex items-center gap-2 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
					<Zap className="size-[18px] shrink-0 text-ink-3" aria-hidden />
					<h2 ref={setupHeading} tabIndex={-1} className="rounded-sm text-h2 font-semibold outline-offset-4">
						考前衝刺
					</h2>
				</div>
				<div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
					<p className="text-sm text-ink-2">把某一科或某個標籤的錯題一次複習完。衝刺的作答只記在這一輪，不會改變間隔複習的排程。</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="科目">
							{(id, aria) => (
								<SubjectSelect
									id={id}
									{...aria}
									value={subjectId}
									onChange={(v) => onScope({ subject: v, tag: null })}
									emptyLabel="所有科目"
								/>
							)}
						</Field>
						<Field label="標籤">
							{(id, aria) => (
								<Select
									id={id}
									{...aria}
									value={tag ?? ''}
									onChange={(e) => onScope({ tag: e.target.value || null })}
									disabled={loading && !data}
								>
									<option value="">所有標籤</option>
									{tags.map((t) => (
										<option key={t.tag} value={t.tag}>
											{t.tag}（{t.count} 題）
										</option>
									))}
								</Select>
							)}
						</Field>
					</div>
					<div className="flex flex-col gap-x-6 sm:flex-row sm:flex-wrap">
						<Switch checked={random} onChange={setRandom} label="隨機排序" />
						<Switch checked={includeMastered} onChange={setIncludeMastered} label="包含已掌握的題目" />
					</div>
					{notes.length >= LIST_LIMIT && (
						<p className="text-meta text-ink-3">
							錯題超過 {LIST_LIMIT} 題，這裡只包含最近更新的 {LIST_LIMIT} 題。
						</p>
					)}
				</div>
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
					{error ? (
						<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />
					) : (
						<CramCount loading={loading} total={pool.length} masteredLeft={masteredLeft} hasAny={notes.length > 0} />
					)}
					<div className="flex w-full gap-2 sm:w-auto">
						{!loading && !error && notes.length === 0 && (
							<Button size="lg" className="flex-1 sm:flex-none" onClick={onNewMistake}>
								<Plus className="size-5" aria-hidden />
								新增錯題
							</Button>
						)}
						<Button variant="primary" size="lg" onClick={start} disabled={loading || pool.length === 0} className="flex-1 sm:flex-none">
							<Zap className="size-5" aria-hidden />
							開始衝刺
						</Button>
					</div>
				</div>
			</Card>
		</>
	);
}

function CramCount({ loading, total, masteredLeft, hasAny }: { loading: boolean; total: number; masteredLeft: number; hasAny: boolean }) {
	let content: ReactNode;
	if (loading && !hasAny) content = <span className="text-ink-3">正在計算題數</span>;
	else if (total > 0)
		content = (
			<span className={cn(loading && 'opacity-60')}>
				這一輪 <NumDisplay size="md">{total}</NumDisplay> 題
				{masteredLeft > 0 && <span className="text-ink-3">，另有 {masteredLeft} 題已掌握</span>}
			</span>
		);
	else if (masteredLeft > 0)
		content = (
			<span className="inline-flex items-start gap-1.5">
				<CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
				這個範圍的錯題都掌握了，打開「包含已掌握的題目」就能再練一次
			</span>
		);
	else
		content = (
			<span className="inline-flex items-start gap-1.5">
				<Brain className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
				這個範圍還沒有錯題，先把寫錯的題目記下來
			</span>
		);
	return (
		<p role="status" className="min-w-0 flex-1 text-sm text-ink-2">
			{content}
		</p>
	);
}

// ---- 複習頁 ----

/** 複習：「今天到期」（間隔複習）或「考前衝刺」（只在這一輪記錄，不影響排程） */
export function ReviewView({
	mode,
	subjectId,
	tag,
	onParams,
	onOpenNote,
	onNewMistake,
	onBack,
}: {
	mode: ReviewMode;
	subjectId: string | null;
	tag: string | null;
	/** 更新網址上的畫面狀態（mode、subject、tag） */
	onParams: (patch: { mode?: ReviewMode; subject?: string | null; tag?: string | null }) => void;
	onOpenNote: (id: string) => void;
	onNewMistake: () => void;
	onBack: () => void;
}) {
	const onMode = (m: ReviewMode) => onParams({ mode: m });
	return (
		<div className="max-w-2xl">
			{mode === 'cram' ? (
				<CramReview
					subjectId={subjectId}
					tag={tag}
					onScope={onParams}
					onMode={onMode}
					onOpenNote={onOpenNote}
					onNewMistake={onNewMistake}
				/>
			) : (
				<DueReview
					subjectId={subjectId}
					onSubject={(subject) => onParams({ subject })}
					onMode={onMode}
					onOpenNote={onOpenNote}
					onBack={onBack}
					onNewMistake={onNewMistake}
				/>
			)}
		</div>
	);
}
