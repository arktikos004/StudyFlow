import { Brain, CalendarDays, ChevronRight, Clock, Flame, Play, Plus, RotateCw, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { EventItem, Task } from '../../shared/api-types';
import { StatStrip, type StatItem } from '../components/charts';
import { NextExamCard } from '../components/dashboard/exams';
import { Duration, Unit } from '../components/dashboard/parts';
import { TodayTasksCard } from '../components/dashboard/tasks';
import { UpcomingCard } from '../components/dashboard/upcoming';
import { WeekCard } from '../components/dashboard/week';
import { EventDialog, TaskDialog, type TaskDefaults } from '../components/forms';
import { Button, ErrorNote, PageLoader } from '../components/ui';
import { daysIntoWeek, greetingFor } from '../lib/dashboard-format';
import { formatDate, formatMinutes } from '../lib/format';
import { useDashboard, useSubjects, useUser } from '../lib/queries';
import { useTimerState } from '../lib/timer';

/** 任務對話框：編輯既有任務，或帶預設值新增（例如某場考試的準備任務） */
type TaskDialogState = { task?: Task; defaults?: TaskDefaults } | null;

export function DashboardPage() {
	const user = useUser();
	const navigate = useNavigate();
	const { data, isPending, error, refetch, isRefetching } = useDashboard();
	// 等科目也到齊再畫，科目 chip 與顏色不會晚一步才出現
	const subjects = useSubjects();
	const timerActive = useTimerState().phase !== 'idle';
	const [eventOpen, setEventOpen] = useState(false);
	const [taskDialog, setTaskDialog] = useState<TaskDialogState>(null);

	if (isPending || subjects.isPending) return <PageLoader />;
	if (error)
		return (
			<div className="space-y-3">
				<ErrorNote error={error} />
				<Button onClick={() => refetch()} loading={isRefetching}>
					<RotateCw className="size-4" aria-hidden />
					重新載入
				</Button>
			</div>
		);

	const nextExam = data.upcomingEvents.find((e) => e.kind === 'exam');
	const upcoming = data.upcomingEvents.filter((e) => e !== nextExam);
	const yesterday = data.last7.at(-2);

	const stats: StatItem[] = [
		{
			key: 'today',
			label: '今天',
			icon: <Clock aria-hidden />,
			value: <Duration minutes={data.todayMinutes} />,
			sub: yesterday && (yesterday.minutes > 0 ? `昨天 ${formatMinutes(yesterday.minutes)}` : '昨天沒有紀錄'),
		},
		{
			key: 'week',
			label: '本週',
			icon: <CalendarDays aria-hidden />,
			value: <Duration minutes={data.weekMinutes} />,
			sub: `平均每天 ${formatMinutes(data.weekMinutes / daysIntoWeek(data.today))}`,
		},
		{
			key: 'streak',
			label: '連續學習',
			icon: <Flame aria-hidden />,
			value: (
				<>
					{data.streak}
					<Unit>天</Unit>
				</>
			),
			sub: data.streak === 0 ? '今天讀書就能開始累積' : data.todayMinutes > 0 ? '已包含今天' : '今天讀書就能延續',
		},
	];

	const addPrepTask = (e: EventItem) => setTaskDialog({ defaults: { eventId: e.id, subjectId: e.subjectId } });

	return (
		<div>
			{/* 焦點：日期、問候語、開始專注 */}
			<header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
				<div className="min-w-0">
					<p className="text-meta text-ink-2">
						<time dateTime={data.today}>{formatDate(data.today, true)}</time>
					</p>
					<h1 className="mt-1 text-[1.375rem] leading-[1.3] font-bold text-balance sm:text-h1">
						{greetingFor(user.timezone)}，{user.displayName}
					</h1>
				</div>
				<div className="flex w-full gap-2 sm:w-auto">
					<Button size="lg" onClick={() => setTaskDialog({})}>
						<Plus className="size-5" aria-hidden />
						新增任務
					</Button>
					<Button size="lg" variant="primary" className="flex-1 sm:flex-none" onClick={() => navigate('/timer')}>
						{timerActive ? <Timer className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
						{timerActive ? '回到計時' : '開始專注'}
					</Button>
				</div>
			</header>

			<StatStrip
				items={stats}
				footer={
					data.reviewDueCount > 0 && (
						<Link
							to="/notes?view=review"
							className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-dense transition-colors duration-120 ease-out hover:bg-subtle focus-visible:-outline-offset-2 sm:px-5"
						>
							<Brain className="size-[18px] shrink-0 text-warning" aria-hidden />
							<span className="min-w-0 flex-1 text-ink">
								<span className="font-num font-semibold tabular-nums">{data.reviewDueCount}</span> 題錯題待複習
							</span>
							<span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-accent-ink">
								開始複習
								<ChevronRight className="size-4" aria-hidden />
							</span>
						</Link>
					)
				}
			/>

			<div className="mt-6 grid grid-cols-1 items-start gap-6 md:mt-8 lg:grid-cols-5">
				<div className="min-w-0 space-y-6 lg:col-span-3">
					<TodayTasksCard
						tasks={data.focusTasks}
						today={data.today}
						openCount={data.openTaskCount}
						onOpen={(task) => setTaskDialog({ task })}
						onNew={() => setTaskDialog({})}
					/>
				</div>
				<div className="min-w-0 space-y-6 lg:col-span-2">
					{nextExam && <NextExamCard event={nextExam} today={data.today} timeZone={user.timezone} onAddTask={addPrepTask} />}
					<UpcomingCard events={upcoming} today={data.today} hasNextExam={!!nextExam} onNew={() => setEventOpen(true)} />
					<WeekCard days={data.last7} today={data.today} />
				</div>
			</div>

			<EventDialog open={eventOpen} onClose={() => setEventOpen(false)} />
			<TaskDialog open={!!taskDialog} task={taskDialog?.task} defaults={taskDialog?.defaults} onClose={() => setTaskDialog(null)} />
		</div>
	);
}
