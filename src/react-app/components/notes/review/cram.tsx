import { Brain, CircleCheck, Plus, Repeat, RotateCcw, Shuffle, Zap } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { NoteItem } from '../../../../shared/api-types';
import { NOTES_LIST_LIMIT } from '../../../../shared/schemas';
import type { ReviewResults } from '../../../lib/notes-cram';
import { cramPool, cramQueue, cramTags, retryQueue } from '../../../lib/notes-cram';
import { useNotes, useSubjectMap } from '../../../lib/queries';
import { SubjectSelect } from '../../subjects';
import { Badge, Button, Card, cn, ErrorNote, Field, NumDisplay, Select, Switch } from '../../ui';
import { ModeSwitch, type ReviewMode } from './mode-switch';
import { ReviewRunner } from './runner';
import { RoundSummary } from './summary';

/** queue 是這一輪實際作答的題目；pool 是這次衝刺的完整題目（「再練還不熟」之後「整輪重來」仍用完整題目） */
type CramStage =
	| { step: 'setup' }
	| { step: 'run'; queue: NoteItem[]; pool: NoteItem[]; round: number }
	| { step: 'done'; queue: NoteItem[]; pool: NoteItem[]; results: ReviewResults; complete: boolean };

/** 考前衝刺：選科目與標籤，一次練完範圍內的錯題；結果只記在這一輪 */
export function CramReview({
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
					{notes.length >= NOTES_LIST_LIMIT && (
						<p className="text-meta text-ink-3">
							錯題超過 {NOTES_LIST_LIMIT} 題，這裡只包含最近更新的 {NOTES_LIST_LIMIT} 題。
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
