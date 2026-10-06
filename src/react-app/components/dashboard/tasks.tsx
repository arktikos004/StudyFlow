import { CalendarClock, CircleAlert, CircleDot, ListChecks, Play, Plus, Timer } from 'lucide-react';
import type { Task } from '../../../shared/api-types';
import { diffDays } from '../../../shared/dates';
import { SubjectTag } from '../subjects';
import { TaskCheckbox } from '../TaskItem';
import { Badge, Button, Card, CardHeader, EmptyState, MoreLink } from '../ui';

/** 任務狀態的 badge：一律圖示加文字 */
function TaskBadges({ task, today }: { task: Task; today: string }) {
	const overdue = task.dueDate && task.dueDate < today ? diffDays(task.dueDate, today) : 0;
	return (
		<>
			{overdue > 0 && (
				<Badge tone="danger" icon={<CircleAlert aria-hidden />}>
					逾期 {overdue} 天
				</Badge>
			)}
			{task.dueDate === today && (
				<Badge tone="warning" icon={<CalendarClock aria-hidden />}>
					今天到期
				</Badge>
			)}
			{task.status === 'doing' && (
				<Badge tone="accent" icon={<CircleDot aria-hidden />}>
					進行中
				</Badge>
			)}
		</>
	);
}

/** 總覽的「今天要處理」：到期、逾期或進行中的任務；每一列都有 ▶ 可以直接開始專注（DASH-1） */
export function TodayTasksCard({
	tasks,
	today,
	openCount,
	onOpen,
	onNew,
	onFocus,
	focusingTaskId,
}: {
	tasks: Task[];
	today: string;
	/** 全部未完成的任務數 */
	openCount: number;
	onOpen: (task: Task) => void;
	onNew: () => void;
	onFocus: (task: Task) => void;
	/** 正在計時的任務：按鈕改成「回到計時」 */
	focusingTaskId: string | null;
}) {
	return (
		<Card>
			<CardHeader
				title="今天要處理"
				icon={<ListChecks className="size-[18px] text-ink-3" aria-hidden />}
				meta={tasks.length ? `${tasks.length} 項` : undefined}
				action={
					openCount > 0 && (
						<MoreLink to="/tasks">
							全部 {openCount} 項<span className="sr-only">未完成的任務</span>
						</MoreLink>
					)
				}
			/>
			{tasks.length ? (
				<ul className="divide-y divide-line px-2 pb-2 sm:px-3">
					{tasks.map((t) => (
						<li key={t.id} className="flex items-center gap-3 px-2 py-1.5">
							<TaskCheckbox task={t} />
							<button type="button" className="group min-w-0 flex-1 rounded-md py-1.5 text-left" onClick={() => onOpen(t)}>
								<span className="block truncate text-dense text-ink decoration-line-strong underline-offset-4 group-hover:underline">{t.title}</span>
								<span className="mt-1 flex flex-wrap items-center gap-1.5">
									<SubjectTag subjectId={t.subjectId} />
									<TaskBadges task={t} today={today} />
								</span>
							</button>
							{t.id === focusingTaskId ? (
								<Button size="icon" variant="soft" onClick={() => onFocus(t)} aria-label={`回到計時：${t.title}`} title="正在專注，回到計時">
									<Timer className="size-[18px]" aria-hidden />
								</Button>
							) : (
								<Button size="icon" variant="ghost" className="text-accent-ink" onClick={() => onFocus(t)} aria-label={`開始專注：${t.title}`} title="開始專注">
									<Play className="size-[18px]" aria-hidden />
								</Button>
							)}
						</li>
					))}
				</ul>
			) : (
				<EmptyState
					variant="inline"
					className="pb-4 sm:pb-5"
					title="今天沒有到期的任務"
					description="可以先處理之後的任務"
					action={
						<Button size="sm" variant="ghost" onClick={onNew}>
							<Plus className="size-4" aria-hidden />
							新增任務
						</Button>
					}
				/>
			)}
		</Card>
	);
}
