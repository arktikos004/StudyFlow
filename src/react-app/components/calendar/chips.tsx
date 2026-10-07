import { CircleCheck } from 'lucide-react';
import type { EventItem, Task } from '../../../shared/api-types';
import type { SubjectTone } from '../../../shared/color';
import { EVENT_KIND_LABEL } from '../../../shared/labels';
import { cn } from '../ui';
import { EVENT_ICON } from './icons';

// 月曆的 chip：ink 文字、科目 tint 底加圖示（考試 GraduationCap、截止日 Flag），文字不用科目色。

/** 考試／截止日的 chip（純顯示，放在可點的格子或按鈕裡） */
export function EventChip({
	event,
	tone,
	showTime = true,
	className,
}: {
	event: EventItem;
	tone: SubjectTone;
	/** 月格空間小，只顯示標題（時間在當天明細） */
	showTime?: boolean;
	className?: string;
}) {
	const Icon = EVENT_ICON[event.kind];
	return (
		<span
			className={cn('flex h-5 min-w-0 items-center gap-1 rounded-sm px-1 text-caption text-ink', className)}
			style={{ background: tone.tint, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
		>
			<Icon className="size-3 shrink-0 text-ink-2" role="img" aria-label={EVENT_KIND_LABEL[event.kind]} />
			{showTime && event.time && <span className="shrink-0 font-num tabular-nums">{event.time}</span>}
			<span className="truncate">{event.title}</span>
		</span>
	);
}

/** 任務期限：未完成是科目色圓點，已完成是打勾圖示加刪除線（不只靠顏色） */
export function TaskChip({ task, mark, className }: { task: Task; mark: string; className?: string }) {
	const done = task.status === 'done';
	return (
		<span
			className={cn('flex h-5 min-w-0 items-center gap-1 px-1 text-caption', done ? 'text-ink-3 line-through' : 'text-ink-2', className)}
		>
			{done ? (
				<CircleCheck className="size-3 shrink-0" role="img" aria-label="已完成" />
			) : (
				<span className="mx-0.5 size-2 shrink-0 rounded-full" style={{ background: mark }} aria-hidden />
			)}
			<span className="truncate">{task.title}</span>
		</span>
	);
}
