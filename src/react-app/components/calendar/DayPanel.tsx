import { CalendarPlus, ListPlus, Pencil, Plus } from 'lucide-react';
import { useId } from 'react';
import type { EventItem, StudySession, Task } from '../../../shared/api-types';
import { formatDate, formatMinutes } from '../../lib/format';
import { EVENT_KIND_LABEL, STUDY_MODE_LABEL } from '../../../shared/labels';
import { formatClockRange, relativeDateLabel } from '../../lib/timer-format';
import { SubjectTag } from '../subjects';
import { TaskCheckbox } from '../TaskItem';
import { Badge, Button, Card, CardHeader, cn, EmptyState } from '../ui';
import { EVENT_ICON } from './icons';

/**
 * 選取那天的明細：考試與截止日、任務期限、學習紀錄（依開始時間算在這天）。
 * 也是月格與時間軸的清單版本：每一列都是 44px 以上的按鈕。
 * itemsFailed／sessionsFailed：那一類資料載入失敗（錯誤與「重新載入」由頁面顯示），
 * 這裡不能說「沒有…」，免得使用者以為資料不見了。
 */
export function DayPanel({
	date,
	today,
	timeZone,
	events,
	tasks,
	sessions,
	className,
	onEvent,
	onTask,
	onSession,
	onNewEvent,
	onNewTask,
	onNewSession,
	itemsFailed = false,
	sessionsFailed = false,
}: {
	date: string;
	today: string;
	timeZone: string;
	events: EventItem[];
	tasks: Task[];
	sessions: StudySession[];
	className?: string;
	onEvent: (event: EventItem) => void;
	onTask: (task: Task) => void;
	onSession: (session: StudySession) => void;
	onNewEvent: () => void;
	onNewTask: () => void;
	onNewSession: () => void;
	itemsFailed?: boolean;
	sessionsFailed?: boolean;
}) {
	const titleId = useId();
	const sessionsId = useId();
	const total = sessions.reduce((sum, s) => sum + s.durationSec, 0) / 60;
	const label = relativeDateLabel(date, today);

	return (
		<section aria-labelledby={titleId} className={className}>
			<Card as="div">
				<CardHeader
					title={
						<span id={titleId} className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
							<span className="whitespace-nowrap">{formatDate(date, date.slice(0, 4) !== today.slice(0, 4))}</span>
							{label === '今天' && <Badge tone="accent">今天</Badge>}
						</span>
					}
					action={
						<>
							{/* 有文字的按鈕（原本只有圖示，看不出差別）；無障礙名稱「新增任務」包含看得到的「任務」。側欄只有 20rem，左右內距縮成 8px */}
							<Button size="sm" variant="ghost" className="px-2" onClick={onNewTask}>
								<ListPlus className="size-4" aria-hidden />
								<span className="sr-only">新增</span>任務
							</Button>
							<Button size="sm" variant="ghost" className="px-2" onClick={onNewEvent}>
								<CalendarPlus className="size-4" aria-hidden />
								<span className="sr-only">新增</span>考試
							</Button>
						</>
					}
				/>

				{events.length + tasks.length === 0 ? (
					<EmptyState
						variant="inline"
						className="border-t border-line"
						title={itemsFailed ? '考試與任務沒有載入' : '沒有考試或任務期限'}
						description={itemsFailed ? '請按頁面上方的「重新載入」' : undefined}
					/>
				) : (
					<ul className="divide-y divide-line border-t border-line">
						{events.map((e) => {
							const Icon = EVENT_ICON[e.kind];
							return (
								<li key={e.id}>
									<button
										type="button"
										onClick={() => onEvent(e)}
										className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-120 ease-out hover:bg-subtle sm:px-5"
									>
										<Icon className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
										<span className="min-w-0 flex-1">
											<span className="flex flex-wrap items-center gap-2">
												<Badge tone={e.kind === 'exam' ? 'accent' : 'neutral'}>{EVENT_KIND_LABEL[e.kind]}</Badge>
												{e.time && <span className="font-num text-meta text-ink-2 tabular-nums">{e.time}</span>}
												<SubjectTag subjectId={e.subjectId} variant="compact" />
											</span>
											<span className="mt-1 block text-dense wrap-anywhere">{e.title}</span>
											{e.location && <span className="block text-meta text-ink-3">{e.location}</span>}
										</span>
									</button>
								</li>
							);
						})}
						{tasks.map((t) => (
							<li key={t.id} className="flex items-center gap-3 px-4 py-2 sm:px-5">
								<TaskCheckbox task={t} />
								<button type="button" className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left" onClick={() => onTask(t)}>
									<span className={cn('block text-dense wrap-anywhere', t.status === 'done' && 'text-ink-3 line-through')}>{t.title}</span>
									<span className="flex items-center gap-2 text-meta text-ink-3">
										任務期限
										<SubjectTag subjectId={t.subjectId} variant="compact" />
									</span>
								</button>
							</li>
						))}
					</ul>
				)}

				<section aria-labelledby={sessionsId} className="border-t border-line">
					<div className="flex items-center justify-between gap-2 py-2 pr-2 pl-4 sm:pl-5">
						<h3 id={sessionsId} className="flex items-baseline gap-2 text-h3 font-semibold">
							學習紀錄
							{total >= 1 && <span className="font-num text-meta font-normal text-ink-2 tabular-nums">{formatMinutes(total)}</span>}
						</h3>
						<Button size="sm" variant="ghost" onClick={onNewSession}>
							<Plus className="size-4" aria-hidden />
							補登
						</Button>
					</div>
					{sessions.length === 0 ? (
						<p className="px-4 pb-4 text-meta text-ink-3 sm:px-5">
							{sessionsFailed ? '學習紀錄沒有載入，請按頁面上方的「重新載入」' : date > today ? '還沒到這天' : '這天沒有學習紀錄'}
						</p>
					) : (
						<ul className="divide-y divide-line border-t border-line">
							{sessions.map((s) => {
								const range = formatClockRange(s.startedAt, s.endedAt, timeZone);
								const minutes = formatMinutes(s.durationSec / 60);
								return (
									<li key={s.id}>
										<button
											type="button"
											onClick={() => onSession(s)}
											aria-label={`編輯學習紀錄：${range}，${STUDY_MODE_LABEL[s.mode]}，${minutes}`}
											className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-120 ease-out hover:bg-subtle sm:px-5"
										>
											<span className="min-w-0 flex-1">
												<span className="block font-num text-sm font-semibold tabular-nums">{range}</span>
												<span className="mt-0.5 flex items-center gap-2">
													{s.subjectId ? <SubjectTag subjectId={s.subjectId} /> : <span className="text-meta text-ink-3">未分類</span>}
													<span className="text-meta text-ink-3">{STUDY_MODE_LABEL[s.mode]}</span>
												</span>
											</span>
											<span className="shrink-0 font-num text-sm text-ink-2 tabular-nums">{minutes}</span>
											<Pencil className="size-4 shrink-0 text-ink-3" aria-hidden />
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</section>
			</Card>
		</section>
	);
}
