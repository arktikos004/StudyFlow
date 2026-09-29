import { Check, Clock, GraduationCap } from 'lucide-react';
import type { EventItem, Task } from '../../shared/api-types';
import { formatDate, formatMinutes, PRIORITY_LABEL } from '../lib/format';
import { useUpdateTask } from '../lib/queries';
import { SubjectTag } from './subjects';
import { Badge, cn } from './ui';

export function TaskCheckbox({ task }: { task: Task }) {
	const update = useUpdateTask();
	const done = task.status === 'done';
	return (
		<button
			role="checkbox"
			aria-checked={done}
			aria-label={done ? `將「${task.title}」標為未完成` : `完成「${task.title}」`}
			disabled={update.isPending}
			onClick={() => update.mutate({ id: task.id, status: done ? 'todo' : 'done' })}
			// 視覺 22px，但點擊範圍放大到 40px，手機比較好按
			className="-m-2 grid size-10 shrink-0 place-items-center rounded-full"
		>
			<span
				className={cn(
					'grid size-[22px] place-items-center rounded-full border-2 transition-colors',
					done ? 'border-success bg-success text-white' : 'border-line-strong hover:border-accent',
				)}
			>
				{done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
			</span>
		</button>
	);
}

export function TaskRow({ task, today, event, onOpen }: { task: Task; today: string; event?: EventItem; onOpen: () => void }) {
	const done = task.status === 'done';
	const overdue = !done && task.dueDate && task.dueDate < today;
	return (
		<div className="flex items-start gap-3 px-4 py-3">
			<div className="pt-0.5">
				<TaskCheckbox task={task} />
			</div>
			<button className="min-w-0 flex-1 text-left" onClick={onOpen}>
				<div className={cn('text-[15px] break-words', done && 'text-ink-3 line-through')}>{task.title}</div>
				<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
					<SubjectTag subjectId={task.subjectId} />
					{task.dueDate && (
						<span className={cn(overdue && 'font-medium text-danger', task.dueDate === today && !done && 'font-medium text-warning')}>
							{overdue ? '逾期・' : task.dueDate === today ? '今天・' : ''}
							{formatDate(task.dueDate)}
						</span>
					)}
					{task.estimatedMinutes && (
						<span className="inline-flex items-center gap-1">
							<Clock className="size-3" aria-hidden />
							{formatMinutes(task.estimatedMinutes)}
						</span>
					)}
					{event && (
						<span className="inline-flex min-w-0 items-center gap-1">
							<GraduationCap className="size-3 shrink-0" aria-hidden />
							<span className="truncate">{event.title}</span>
						</span>
					)}
				</div>
			</button>
			<div className="flex shrink-0 flex-col items-end gap-1">
				{task.priority === 'high' && !done && <Badge tone="danger">優先度{PRIORITY_LABEL.high}</Badge>}
				{task.status === 'doing' && <Badge tone="accent">進行中</Badge>}
			</div>
		</div>
	);
}
