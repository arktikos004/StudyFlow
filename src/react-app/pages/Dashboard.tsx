import { BookOpen, Brain, CalendarDays, ChevronRight, Clock, Flame, Play, Plus, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { EventItem, Task } from '../../shared/api-types';
import { StatStrip, type StatItem } from '../components/charts';
import { NextExamCard } from '../components/dashboard/exams';
import { GoalsCard } from '../components/dashboard/goals';
import { useFocusTask } from '../components/dashboard/hooks';
import { TodayTasksCard } from '../components/dashboard/tasks';
import { UpcomingCard } from '../components/dashboard/upcoming';
import { WeekCard } from '../components/dashboard/week';
import { EventDialog, TaskDialog, type TaskDefaults } from '../components/forms';
import { Button, ButtonLink, Card, Duration, EmptyState, ErrorNote, PageHeader, PageLoader, PageStack, Unit } from '../components/ui';
import { daysIntoWeek, greetingFor } from '../lib/dashboard-format';
import { formatDate, formatMinutes } from '../lib/format';
import { useDashboard, useSubjects } from '../lib/queries';
import { useUser } from '../lib/account-queries';
import { useTimerState } from '../lib/timer';

/** 任務對話框：編輯既有任務，或帶預設值新增（例如某場考試的準備任務） */
type TaskDialogState = { task?: Task; defaults?: TaskDefaults } | null;

export function DashboardPage() {
	const user = useUser();
	const { data, isPending, error, refetch, isRefetching } = useDashboard();
	// 等科目也到齊再畫，科目 chip 與顏色不會晚一步才出現
	const subjects = useSubjects();
	const timerActive = useTimerState().phase !== 'idle';
	const [startFocus, focusConfirm, focusingTaskId] = useFocusTask();
	const [eventOpen, setEventOpen] = useState(false);
	const [taskDialog, setTaskDialog] = useState<TaskDialogState>(null);

	if (isPending || subjects.isPending) return <PageLoader />;
	if (error) return <ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
	// 新帳號還沒有科目：最上方先導引去新增科目（任務、考試、統計都依科目整理），這時它是畫面上唯一的主要動作
	const noSubjects = subjects.data?.length === 0;

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

	const TimerIcon = timerActive ? Timer : Play;
	return (
		<div>
			{/* 焦點：日期、問候語、開始專注 */}
			<PageHeader
				eyebrow={<time dateTime={data.today}>{formatDate(data.today, true)}</time>}
				title={`${greetingFor(user.timezone)}，${user.displayName}`}
				actionsClassName="w-full flex-nowrap sm:w-auto"
				actions={
					<>
						<Button size="lg" onClick={() => setTaskDialog({})}>
							<Plus className="size-5" aria-hidden />
							新增任務
						</Button>
						<ButtonLink to="/timer" size="lg" variant={noSubjects ? 'secondary' : 'primary'} className="flex-1 sm:flex-none">
							<TimerIcon className="size-5" aria-hidden />
							{timerActive ? '回到計時' : '開始專注'}
						</ButtonLink>
					</>
				}
			/>

			<PageStack>
				{noSubjects && (
					<Card>
						<EmptyState
							icon={<BookOpen />}
							title="新增第一個科目"
							description="用科目分類考試、任務與筆記；總覽、統計與讀書目標都會依科目整理。"
							action={
								<ButtonLink to="/settings?new=1" variant="primary">
									<Plus className="size-4" aria-hidden />
									新增第一個科目
								</ButtonLink>
							}
						/>
					</Card>
				)}

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

				<div className="grid grid-cols-1 items-start gap-section lg:grid-cols-5">
					<PageStack className="min-w-0 lg:col-span-3">
						<TodayTasksCard
							tasks={data.focusTasks}
							today={data.today}
							openCount={data.openTaskCount}
							onOpen={(task) => setTaskDialog({ task })}
							onNew={() => setTaskDialog({})}
							onFocus={startFocus}
							focusingTaskId={focusingTaskId}
						/>
						<GoalsCard goals={data.goals} todayMinutes={data.todayMinutes} weekMinutes={data.weekMinutes} />
					</PageStack>
					<PageStack className="min-w-0 lg:col-span-2">
						{nextExam && <NextExamCard event={nextExam} today={data.today} timeZone={user.timezone} onAddTask={addPrepTask} />}
						<UpcomingCard events={upcoming} today={data.today} hasNextExam={!!nextExam} onNew={() => setEventOpen(true)} />
						<WeekCard days={data.last7} today={data.today} />
					</PageStack>
				</div>
			</PageStack>

			<EventDialog open={eventOpen} onClose={() => setEventOpen(false)} />
			<TaskDialog open={!!taskDialog} task={taskDialog?.task} defaults={taskDialog?.defaults} onClose={() => setTaskDialog(null)} />
			{focusConfirm}
		</div>
	);
}
