import { Brain, CalendarDays, Clock, Flame, GraduationCap, ListChecks, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Task } from '../../shared/api-types';
import { MiniDailyBars, StatTile } from '../components/charts';
import { EventDialog, TaskDialog } from '../components/forms';
import { SubjectTag } from '../components/subjects';
import { TaskCheckbox } from '../components/TaskItem';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, PageLoader } from '../components/ui';
import { dDay, EVENT_KIND_LABEL, formatDate, formatMinutes, relativeDay } from '../lib/format';
import { useDashboard, useUser } from '../lib/queries';

function greeting() {
	const h = new Date().getHours();
	if (h < 5) return '夜深了';
	if (h < 12) return '早安';
	if (h < 18) return '午安';
	return '晚安';
}

export function DashboardPage() {
	const user = useUser();
	const navigate = useNavigate();
	const { data, isPending, error } = useDashboard();
	const [eventOpen, setEventOpen] = useState(false);
	const [taskOpen, setTaskOpen] = useState(false);
	const [editTask, setEditTask] = useState<Task>();

	if (isPending) return <PageLoader />;
	if (error) return <ErrorNote error={error} />;

	return (
		<div className="space-y-5">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="text-sm text-ink-2">{formatDate(data.today, true)}</p>
					<h1 className="mt-0.5 text-2xl font-bold tracking-tight">
						{greeting()}，{user.displayName}
					</h1>
				</div>
				<div className="flex gap-2">
					<Button onClick={() => setTaskOpen(true)}>
						<Plus className="size-4" aria-hidden />
						任務
					</Button>
					<Button variant="primary" onClick={() => navigate('/timer')}>
						<Play className="size-4" aria-hidden />
						開始專注
					</Button>
				</div>
			</header>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatTile label="今天" icon={<Clock className="size-4" aria-hidden />} value={formatMinutes(data.todayMinutes)} sub="學習時間" />
				<StatTile
					label="本週"
					icon={<CalendarDays className="size-4" aria-hidden />}
					value={formatMinutes(data.weekMinutes)}
					sub="週一起算"
				/>
				<StatTile
					label="連續學習"
					icon={<Flame className="size-4" aria-hidden />}
					value={`${data.streak} 天`}
					sub={data.streak ? '保持下去！' : '今天開始累積吧'}
				/>
				<Link to="/notes?view=review" className="block rounded-xl transition-transform hover:-translate-y-0.5">
					<StatTile
						label="待複習錯題"
						icon={<Brain className="size-4" aria-hidden />}
						value={`${data.reviewDueCount} 題`}
						sub={data.reviewDueCount ? '點這裡開始複習 →' : '今天都複習完了'}
					/>
				</Link>
			</div>

			<div className="grid gap-5 lg:grid-cols-5">
				<Card className="lg:col-span-3">
					<CardHeader
						title="今天要處理的任務"
						icon={<ListChecks className="size-[18px] text-ink-3" aria-hidden />}
						action={
							<Link to="/tasks" className="text-sm text-accent-ink hover:underline">
								全部 {data.openTaskCount} 項 →
							</Link>
						}
					/>
					{data.focusTasks.length ? (
						<ul className="divide-y divide-line px-2 pb-2">
							{data.focusTasks.map((t) => (
								<li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
									<TaskCheckbox task={t} />
									<button className="min-w-0 flex-1 text-left" onClick={() => setEditTask(t)}>
										<div className="truncate text-[15px]">{t.title}</div>
										<div className="mt-0.5 flex items-center gap-2">
											<SubjectTag subjectId={t.subjectId} />
											{t.dueDate && t.dueDate < data.today && <Badge tone="danger">逾期 {formatDate(t.dueDate)}</Badge>}
											{t.dueDate === data.today && <Badge tone="warning">今天到期</Badge>}
											{t.status === 'doing' && <Badge tone="accent">進行中</Badge>}
										</div>
									</button>
								</li>
							))}
						</ul>
					) : (
						<EmptyState
							icon={<ListChecks />}
							title="今天沒有到期的任務"
							description="可以提前處理之後的任務，或安排新的學習計畫。"
							action={
								<Button size="sm" onClick={() => setTaskOpen(true)}>
									<Plus className="size-4" aria-hidden />
									新增任務
								</Button>
							}
						/>
					)}
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader
						title="即將到來"
						icon={<GraduationCap className="size-[18px] text-ink-3" aria-hidden />}
						action={
							<Button size="sm" variant="ghost" onClick={() => setEventOpen(true)} aria-label="新增考試或截止日">
								<Plus className="size-4" aria-hidden />
							</Button>
						}
					/>
					{data.upcomingEvents.length ? (
						<ul className="space-y-1 px-2 pb-3">
							{data.upcomingEvents.map((e) => {
								const rel = relativeDay(e.date, data.today);
								return (
									<li key={e.id}>
										<Link to="/events" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-subtle">
											<div
												className={
													rel.days <= 3
														? 'w-14 shrink-0 rounded-lg bg-danger-soft py-1.5 text-center text-sm font-semibold text-danger'
														: 'w-14 shrink-0 rounded-lg bg-subtle py-1.5 text-center text-sm font-semibold text-ink-2'
												}
											>
												{dDay(e.date, data.today)}
											</div>
											<div className="min-w-0 flex-1">
												<div className="truncate text-[15px]">{e.title}</div>
												<div className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
													<span>
														{EVENT_KIND_LABEL[e.kind]} · {formatDate(e.date)} {e.time ?? ''}
													</span>
													<SubjectTag subjectId={e.subjectId} />
												</div>
											</div>
										</Link>
									</li>
								);
							})}
						</ul>
					) : (
						<EmptyState icon={<GraduationCap />} title="近期沒有考試或截止日" description="新增考試日期，系統會幫你倒數。" />
					)}
				</Card>
			</div>

			<Card>
				<CardHeader
					title="近 7 天學習時間"
					action={
						<Link to="/stats" className="text-sm text-accent-ink hover:underline">
							詳細統計 →
						</Link>
					}
				/>
				<div className="px-3 pb-3 sm:px-4">
					<MiniDailyBars data={data.last7} today={data.today} />
				</div>
			</Card>

			<EventDialog open={eventOpen} onClose={() => setEventOpen(false)} />
			<TaskDialog open={taskOpen || !!editTask} task={editTask} onClose={() => (setTaskOpen(false), setEditTask(undefined))} />
		</div>
	);
}
