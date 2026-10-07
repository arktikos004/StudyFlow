import { Check, CircleAlert, Eye, RotateCcw, SkipForward, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { NoteItem } from '../../../../shared/api-types';
import { isNotFound } from '../../../lib/api';
import type { ReviewResults } from '../../../lib/notes-cram';
import { tally, type ReviewResult } from '../../../lib/notes-cram';
import { SubjectTag } from '../../subjects';
import { Button, Card, cn, ProgressBar } from '../../ui';
import { KindBadge, MistakeAnswer, MistakeQuestion, NoteBody } from '../content';

/**
 * 一次一題：先看題目、想好再「顯示答案」，然後選「還不熟」或「記住了」。
 * 焦點：顯示答案後移到答案區，換下一題時移到題目標題（按鈕會換掉，焦點不能掉到 body）。
 * record 回傳 Promise：今天到期模式送出後才換題。失敗時留在這一題，顯示原因與「跳過這題」；
 * 題目在別處被刪除（404）時自動略過。
 */
export function ReviewRunner({
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
	onDone: (results: ReviewResults, queue: NoteItem[]) => void;
	onExit: (results: ReviewResults, queue: NoteItem[]) => void;
	exitLabel: string;
}) {
	// 開始時固定題目：今天到期的清單在每次作答後會重新取得（答過的不再到期），不能跟著縮短，否則會跳題
	const [queue] = useState(initialQueue);
	const [index, setIndex] = useState(0);
	const [revealed, setRevealed] = useState(false);
	const [results, setResults] = useState<ReviewResults>({});
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
	const advance = (next: ReviewResults) => {
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
				if (isNotFound(e)) {
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
