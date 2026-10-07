import { CircleCheck, RotateCcw } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { NoteItem } from '../../../../shared/api-types';
import type { ReviewResults } from '../../../lib/notes-cram';
import { retryQueue, tally } from '../../../lib/notes-cram';
import { SubjectTag } from '../../subjects';
import { Card, NumDisplay, SectionLabel } from '../../ui';

/** 一輪複習的結果：記住與還不熟的題數、還不熟的題目（點了打開那則筆記），以及接下來的動作 */
export function RoundSummary({
	title,
	results,
	queue,
	note,
	actions,
	onOpenNote,
}: {
	title: string;
	results: ReviewResults;
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
