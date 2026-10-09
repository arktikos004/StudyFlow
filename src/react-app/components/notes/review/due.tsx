import { Plus, Sparkles, Zap } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { NoteItem } from '../../../../shared/api-types';
import type { ReviewResults } from '../../../lib/notes-cram';
import type { ReviewMode } from '../../../lib/notes-params';
import { useNotes, useReviewNote } from '../../../lib/queries';
import { SubjectSelect } from '../../subjects';
import { Button, Card, EmptyState, ErrorNote, PageLoader } from '../../ui';
import { ModeSwitch } from './mode-switch';
import { ReviewRunner } from './runner';
import { RoundSummary } from './summary';

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

/** 今天到期：間隔複習，作答後由後端排定下次複習的日期 */
export function DueReview({
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
	const [done, setDone] = useState<{ queue: NoteItem[]; results: ReviewResults } | null>(null);

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
				meta={(n) => <span className="text-meta text-ink-3">{n.mastered ? '已掌握・定期複習' : `第 ${n.reviewStage + 1} 輪`}</span>}
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
