import { CalendarClock, CalendarDays, CircleAlert, CircleDot, Clock, Flag, GraduationCap, ListChecks, TriangleAlert } from 'lucide-react';
import type { EventItem, Task } from '../../../shared/api-types';
import { formatDate } from '../../lib/format';
import { checklistProgress } from '../../lib/task-checklist';
import { dueInfo, formatTaskTime } from '../../lib/task-format';
import { Badge, cn } from '../ui';

// 任務列與看板卡片共用的 meta：期限、子項目進度、投入時間、考試、優先度與狀態 badge。
// 狀態一律圖示加文字；圖示和總覽（components/dashboard/tasks.tsx）一致。

/** 期限：逾期（CircleAlert）、今天到期（CalendarClock）用 badge，其他日期用一般文字 */
export function DueLabel({ dueDate, today, done }: { dueDate: string; today: string; done: boolean }) {
	const info = dueInfo(dueDate, today, done);
	if (info.kind === 'overdue')
		return (
			<Badge tone="danger" icon={<CircleAlert aria-hidden />}>
				{info.label}
			</Badge>
		);
	if (info.kind === 'today')
		return (
			<Badge tone="warning" icon={<CalendarClock aria-hidden />}>
				{info.label}
			</Badge>
		);
	return (
		<span className="inline-flex items-center gap-1">
			<CalendarDays className="size-3.5 shrink-0" aria-hidden />
			{/* 文字和日期包在同一個 span：外層的 gap 不會把「明天，」和日期撐開 */}
			<span>
				<span className="sr-only">期限</span>
				{info.kind === 'tomorrow' && '明天，'}
				<time dateTime={dueDate} className="font-num tabular-nums">
					{formatDate(dueDate)}
				</time>
			</span>
		</span>
	);
}

/** 子項目進度「2／5」（純顯示；清單上可展開的版本在 TaskRow） */
export function ChecklistCount({ checklist }: { checklist: Task['checklist'] }) {
	const { done, total } = checklistProgress(checklist);
	if (!total) return null;
	return (
		<span className="inline-flex items-center gap-1">
			<ListChecks className="size-3.5 shrink-0" aria-hidden />
			<span className="sr-only">子項目完成</span>
			<span className="font-num tabular-nums">
				{done}／{total}
			</span>
		</span>
	);
}

/** 已投入／預估時間（TSK-4）：超過預估時用警示色，另外加上圖示與「超過 15 分」文字 */
export function TaskTimeLabel({ spent, estimate }: { spent: number; estimate: number | null | undefined }) {
	const time = formatTaskTime(spent, estimate);
	if (!time.text) return null;
	const over = time.over > 0;
	return (
		<span className={cn('inline-flex items-start gap-1', over && 'font-semibold text-warning')}>
			{over ? (
				<TriangleAlert className="mt-[3px] size-3.5 shrink-0" aria-hidden />
			) : (
				<Clock className="mt-[3px] size-3.5 shrink-0" aria-hidden />
			)}
			<span className="font-num tabular-nums">
				{time.text}
				{over && `，超過 ${time.overText}`}
			</span>
		</span>
	);
}

/** 連結的考試或截止日 */
export function EventLabel({ event }: { event: EventItem }) {
	return (
		<span className="inline-flex max-w-full min-w-0 items-center gap-1">
			<GraduationCap className="size-3.5 shrink-0" aria-hidden />
			<span className="sr-only">為了</span>
			<span className="truncate">{event.title}</span>
		</span>
	);
}

/** 右側的 badge：高優先（outline＋Flag）、進行中（CircleDot）。已完成的任務不顯示 */
export function TaskStatusBadges({ task, showDoing = true }: { task: Task; showDoing?: boolean }) {
	if (task.status === 'done') return null;
	const high = task.priority === 'high';
	const doing = showDoing && task.status === 'doing';
	if (!high && !doing) return null;
	return (
		<div className="flex shrink-0 flex-col items-end gap-1">
			{high && (
				<Badge tone="outline" icon={<Flag aria-hidden />}>
					高優先
				</Badge>
			)}
			{doing && (
				<Badge tone="accent" icon={<CircleDot aria-hidden />}>
					進行中
				</Badge>
			)}
		</div>
	);
}
