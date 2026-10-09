import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { StudySession } from '../../../shared/api-types';
import { addDays } from '../../../shared/dates';
import { STUDY_MODE_LABEL } from '../../../shared/labels';
import { useUser } from '../../lib/account-queries';
import { formatMinutes } from '../../lib/format';
import { useDeleteSession, useStudySessions, useSubjectMap } from '../../lib/queries';
import { sessionRowLabel } from '../../lib/session-format';
import { formatClockRange, relativeDateLabel } from '../../lib/time-format';
import { SubjectTag } from '../subjects';
import { Button, Card, CardHeader, cn, EmptyState, ErrorNote, PageLoader, useConfirm } from '../ui';

/**
 * 學習紀錄列表（TMR-2）：可以切換日期，每筆都能編輯（整列）與刪除。
 * 時間依 user.timezone 顯示。
 * errorShownAbove：今天的紀錄載入失敗時，頁面上方已經顯示錯誤與「重新載入」，這裡只說明，不重複一個錯誤橫幅。
 */
export function SessionLog({
	date,
	today,
	onDateChange,
	onEdit,
	onCreate,
	errorShownAbove,
	className,
}: {
	date: string;
	today: string;
	onDateChange: (date: string) => void;
	onEdit: (session: StudySession) => void;
	onCreate: () => void;
	errorShownAbove: boolean;
	className?: string;
}) {
	const user = useUser();
	const tz = user.timezone;
	const subjectMap = useSubjectMap();
	const { data: sessions, isPending, error, refetch, isRefetching } = useStudySessions({ from: date, to: date });
	const remove = useDeleteSession();
	const [confirm, confirmDialog] = useConfirm();
	const list = sessions ?? [];
	const total = list.reduce((sum, x) => sum + x.durationSec, 0) / 60;
	const dateLabel = relativeDateLabel(date, today);

	const onDelete = async (x: StudySession) => {
		const range = formatClockRange(x.startedAt, x.endedAt, tz);
		if (
			await confirm({
				title: '刪除這筆學習紀錄？',
				message: `${dateLabel} ${range}，${formatMinutes(x.durationSec / 60)}。刪除後無法復原。`,
			})
		)
			remove.mutate(x.id);
	};

	return (
		<Card className={cn('self-start', className)}>
			<CardHeader
				title="學習紀錄"
				action={
					<Button size="sm" variant="ghost" onClick={onCreate}>
						<Plus className="size-4" aria-hidden />
						補登
					</Button>
				}
			/>
			<div className="flex items-center justify-between gap-2 px-4 pb-3 sm:px-5">
				<div className="flex items-center gap-0.5">
					<Button size="icon" variant="ghost" aria-label="前一天" onClick={() => onDateChange(addDays(date, -1))}>
						<ChevronLeft className="size-5" />
					</Button>
					<p className="min-w-24 text-center text-dense font-semibold" aria-live="polite">
						{dateLabel}
					</p>
					<Button size="icon" variant="ghost" aria-label="後一天" disabled={date >= today} onClick={() => onDateChange(addDays(date, 1))}>
						<ChevronRight className="size-5" />
					</Button>
				</div>
				{date !== today && (
					<Button size="sm" variant="ghost" onClick={() => onDateChange(today)}>
						回到今天
					</Button>
				)}
			</div>
			{!error && (
				<div className="flex items-baseline gap-3 px-4 pb-3 sm:px-5">
					<span className="font-num text-num-lg font-semibold tabular-nums">{formatMinutes(total)}</span>
					<span className="text-meta text-ink-3">{list.length} 段學習</span>
				</div>
			)}
			{error && date === today && errorShownAbove ? (
				<p className="border-t border-line px-4 py-3 text-meta text-ink-3 sm:px-5">學習紀錄沒有載入，請按頁面上方的「重新載入」</p>
			) : error ? (
				<div className="px-4 pb-4 sm:px-5">
					<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />
				</div>
			) : isPending ? (
				<PageLoader />
			) : list.length === 0 ? (
				<EmptyState
					variant="inline"
					className="border-t border-line"
					title={date === today ? '今天還沒有紀錄' : '這天沒有學習紀錄'}
					description={date === today ? '完成的專注時間會自動記錄在這裡' : '忘了計時可以補登'}
					action={
						date !== today && (
							<Button size="sm" variant="ghost" onClick={onCreate}>
								補登
							</Button>
						)
					}
				/>
			) : (
				<ul className="divide-y divide-line border-t border-line">
					{list.map((x) => {
						const range = formatClockRange(x.startedAt, x.endedAt, tz);
						const subject = x.subjectId ? subjectMap.get(x.subjectId)?.name : undefined;
						const minutes = formatMinutes(x.durationSec / 60);
						return (
							<li key={x.id} className="flex items-center pr-2 sm:pr-3">
								<button
									type="button"
									onClick={() => onEdit(x)}
									aria-label={sessionRowLabel(x, subject, tz)}
									className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 pl-4 text-left transition-colors duration-120 ease-out hover:bg-subtle sm:pl-5"
								>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-baseline gap-x-2 text-sm">
											<span className="font-num font-semibold tabular-nums">{range}</span>
											<span className="text-meta text-ink-3">{STUDY_MODE_LABEL[x.mode]}</span>
										</span>
										<span className="mt-1 flex min-w-0 items-center gap-2">
											{subject ? <SubjectTag subjectId={x.subjectId} /> : <span className="text-meta text-ink-3">未分類</span>}
											{x.note && <span className="truncate text-meta text-ink-3">{x.note}</span>}
										</span>
									</span>
									<span className="shrink-0 font-num text-sm text-ink-2 tabular-nums">{minutes}</span>
									<Pencil className="size-4 shrink-0 text-ink-3" aria-hidden />
								</button>
								<Button size="icon" variant="ghost" aria-label={`刪除 ${range} 的紀錄`} onClick={() => onDelete(x)}>
									<Trash2 className="size-4" />
								</Button>
							</li>
						);
					})}
				</ul>
			)}
			{confirmDialog}
		</Card>
	);
}
