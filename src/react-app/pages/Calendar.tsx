import { ChevronLeft, ChevronRight, GraduationCap, ListPlus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EventItem, Task } from '../../shared/api-types';
import { addDays, today as todayOf, weekStart } from '../../shared/dates';
import { useSubjectColor } from '../components/charts';
import { EventDialog, TaskDialog } from '../components/forms';
import { SubjectTag } from '../components/subjects';
import { TaskCheckbox } from '../components/TaskItem';
import { Badge, Button, Card, cn, PageHeader } from '../components/ui';
import { EVENT_KIND_LABEL, formatDate } from '../lib/format';
import { useEvents, useSubjectMap, useTasks, useUser } from '../lib/queries';

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日'];

function monthGrid(month: string) {
	// month = 'YYYY-MM'，回傳涵蓋整個月的 6 週（從週一開始）
	const first = `${month}-01`;
	const start = weekStart(first);
	return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function shiftMonth(month: string, delta: number) {
	const [y, m] = month.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return d.toISOString().slice(0, 7);
}

type DayItem = { kind: 'event'; event: EventItem } | { kind: 'task'; task: Task };

export function CalendarPage() {
	const user = useUser();
	const today = todayOf(user.timezone);
	const [month, setMonth] = useState(today.slice(0, 7));
	const [selected, setSelected] = useState(today);
	const [eventDialog, setEventDialog] = useState<{ event?: EventItem; date?: string } | null>(null);
	const [taskDialog, setTaskDialog] = useState<{ task?: Task; date?: string } | null>(null);
	const subjectMap = useSubjectMap();
	const colorOf = useSubjectColor();

	const days = monthGrid(month);
	const { data: events = [] } = useEvents({ from: days[0], to: days[41] });
	const { data: tasks = [] } = useTasks();

	const byDate = useMemo(() => {
		const map = new Map<string, DayItem[]>();
		const push = (d: string, item: DayItem) => map.set(d, [...(map.get(d) ?? []), item]);
		events.forEach((e) => push(e.date, { kind: 'event', event: e }));
		tasks.filter((t) => t.dueDate).forEach((t) => push(t.dueDate!, { kind: 'task', task: t }));
		return map;
	}, [events, tasks]);

	const [y, m] = month.split('-');
	const selectedItems = byDate.get(selected) ?? [];
	const colorFor = (subjectId: string | null) => colorOf(subjectId ? subjectMap.get(subjectId)?.color : null);

	return (
		<div>
			<PageHeader
				title="月曆"
				description="一次看到所有考試、截止日與任務期限"
				actions={
					<>
						<Button onClick={() => setTaskDialog({ date: selected })}>
							<ListPlus className="size-4" aria-hidden />
							任務
						</Button>
						<Button variant="primary" onClick={() => setEventDialog({ date: selected })}>
							<Plus className="size-4" aria-hidden />
							考試／截止日
						</Button>
					</>
				}
			/>

			<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
				<Card className="overflow-hidden">
					<div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
						<h2 className="px-1 text-lg font-semibold tabular-nums">
							{y} 年 {Number(m)} 月
						</h2>
						<div className="flex items-center gap-1">
							<Button
								size="sm"
								variant="ghost"
								onClick={() => {
									setMonth(today.slice(0, 7));
									setSelected(today);
								}}
							>
								今天
							</Button>
							<Button size="icon" variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="上個月">
								<ChevronLeft className="size-5" />
							</Button>
							<Button size="icon" variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="下個月">
								<ChevronRight className="size-5" />
							</Button>
						</div>
					</div>
					<div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-ink-3">
						{WEEK_HEAD.map((d) => (
							<div key={d} className="py-2">
								{d}
							</div>
						))}
					</div>
					<div className="grid grid-cols-7" role="grid" aria-label={`${y} 年 ${Number(m)} 月`}>
						{days.map((d, i) => {
							const items = byDate.get(d) ?? [];
							const inMonth = d.startsWith(month);
							const isToday = d === today;
							const isSel = d === selected;
							return (
								<button
									key={d}
									role="gridcell"
									aria-selected={isSel}
									aria-label={`${formatDate(d)}，${items.length} 個項目`}
									onClick={() => setSelected(d)}
									onDoubleClick={() => setEventDialog({ date: d })}
									className={cn(
										'flex min-h-16 flex-col items-stretch gap-1 border-line p-1 text-left transition-colors sm:min-h-24 sm:p-1.5',
										i % 7 !== 6 && 'border-r',
										i < 35 && 'border-b',
										isSel ? 'bg-accent-soft' : 'hover:bg-subtle',
										!inMonth && 'bg-subtle/40',
									)}
								>
									<span
										className={cn(
											'grid size-6 place-items-center self-center rounded-full text-xs tabular-nums sm:self-start',
											isToday ? 'bg-accent font-semibold text-on-accent' : inMonth ? 'text-ink' : 'text-ink-3',
										)}
									>
										{Number(d.slice(8))}
									</span>
									{/* 手機：只顯示色點；桌面：顯示標題 */}
									<div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
										{items.slice(0, 4).map((it, j) => (
											<span
												key={j}
												className={cn('size-1.5 rounded-full', it.kind === 'task' && it.task.status === 'done' && 'opacity-40')}
												style={{ background: colorFor(it.kind === 'event' ? it.event.subjectId : it.task.subjectId) }}
											/>
										))}
									</div>
									<div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
										{items.slice(0, 3).map((it) =>
											it.kind === 'event' ? (
												<span
													key={it.event.id}
													className="truncate rounded px-1 py-0.5 text-[11px] leading-tight font-medium text-ink"
													style={{ background: `color-mix(in srgb, ${colorFor(it.event.subjectId)} 18%, transparent)` }}
												>
													{it.event.kind === 'exam' ? '📝 ' : '⏰ '}
													{it.event.title}
												</span>
											) : (
												<span
													key={it.task.id}
													className={cn(
														'flex min-w-0 items-center gap-1 px-1 text-[11px] leading-tight text-ink-2',
														it.task.status === 'done' && 'line-through opacity-60',
													)}
												>
													<span className="size-1.5 shrink-0 rounded-full" style={{ background: colorFor(it.task.subjectId) }} />
													<span className="truncate">{it.task.title}</span>
												</span>
											),
										)}
										{items.length > 3 && <span className="px-1 text-[11px] text-ink-3">還有 {items.length - 3} 項</span>}
									</div>
								</button>
							);
						})}
					</div>
				</Card>

				<Card className="self-start">
					<div className="flex items-center justify-between border-b border-line px-4 py-3">
						<h2 className="font-semibold">
							{formatDate(selected)}
							{selected === today && <span className="ml-2 text-sm font-normal text-accent-ink">今天</span>}
						</h2>
						<div className="flex gap-1">
							<Button size="icon" variant="ghost" onClick={() => setTaskDialog({ date: selected })} aria-label="這天新增任務">
								<ListPlus className="size-4" />
							</Button>
							<Button size="icon" variant="ghost" onClick={() => setEventDialog({ date: selected })} aria-label="這天新增考試或截止日">
								<GraduationCap className="size-4" />
							</Button>
						</div>
					</div>
					{selectedItems.length === 0 ? (
						<p className="px-4 py-8 text-center text-sm text-ink-3">這天沒有安排</p>
					) : (
						<ul className="divide-y divide-line">
							{selectedItems.map((it) =>
								it.kind === 'event' ? (
									<li key={it.event.id}>
										<button
											className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-subtle"
											onClick={() => setEventDialog({ event: it.event })}
										>
											<span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: colorFor(it.event.subjectId) }} />
											<span className="min-w-0 flex-1">
												<span className="flex items-center gap-2">
													<Badge tone={it.event.kind === 'exam' ? 'accent' : 'neutral'}>{EVENT_KIND_LABEL[it.event.kind]}</Badge>
													{it.event.time && <span className="text-xs text-ink-3">{it.event.time}</span>}
												</span>
												<span className="mt-1 block text-[15px] break-words">{it.event.title}</span>
												{it.event.location && <span className="block text-xs text-ink-3">{it.event.location}</span>}
											</span>
										</button>
									</li>
								) : (
									<li key={it.task.id} className="flex items-center gap-3 px-4 py-3">
										<TaskCheckbox task={it.task} />
										<button className="min-w-0 flex-1 text-left" onClick={() => setTaskDialog({ task: it.task })}>
											<span className={cn('block text-[15px] break-words', it.task.status === 'done' && 'text-ink-3 line-through')}>
												{it.task.title}
											</span>
											<SubjectTag subjectId={it.task.subjectId} />
										</button>
									</li>
								),
							)}
						</ul>
					)}
				</Card>
			</div>

			<EventDialog open={!!eventDialog} event={eventDialog?.event} defaultDate={eventDialog?.date} onClose={() => setEventDialog(null)} />
			<TaskDialog
				open={!!taskDialog}
				task={taskDialog?.task}
				defaults={{ dueDate: taskDialog?.date }}
				onClose={() => setTaskDialog(null)}
			/>
		</div>
	);
}
