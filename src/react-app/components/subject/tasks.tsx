import { CalendarDays, CircleAlert, CircleCheck, CircleDot, Clock, Flag, ListChecks, Plus, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TaskItem } from '../../../shared/api-types';
import { formatDate, formatMinutes } from '../../lib/format';
import { dropKept, keepSaved, mergeKept, pruneKept, type KeptTask } from '../../lib/kept-tasks';
import { useTaskResults } from '../../lib/task-queries';
import { TaskCheckbox } from '../TaskItem';
import { Badge, Button, Card, CardHeader, cn, EmptyState } from '../ui';
import { ShowMore } from './show-more';

// 單科總覽的「未完成的任務」。

/** 先列出幾項任務，其餘收在「顯示全部」 */
const TASK_LIMIT = 6;

function DueLabel({ due, today }: { due: string | null; today: string }) {
	if (!due) return null;
	if (due < today)
		return (
			<span className="inline-flex items-center gap-1 font-semibold text-danger">
				<CircleAlert className="size-3.5 shrink-0" aria-hidden />
				逾期 {formatDate(due)}
			</span>
		);
	if (due === today)
		return (
			<span className="inline-flex items-center gap-1 font-semibold text-warning">
				<Clock className="size-3.5 shrink-0" aria-hidden />
				今天到期
			</span>
		);
	return (
		<span className="inline-flex items-center gap-1">
			<CalendarDays className="size-3.5 shrink-0" aria-hidden />
			{formatDate(due)}
		</span>
	);
}

function TaskLine({ task, today, onOpen }: { task: TaskItem; today: string; onOpen: () => void }) {
	const done = task.status === 'done';
	const checked = task.checklist.filter((c) => c.done).length;
	const over = !!task.estimatedMinutes && task.spentMinutes > task.estimatedMinutes;
	const time = [
		task.spentMinutes > 0 && `已投入 ${formatMinutes(task.spentMinutes)}`,
		task.estimatedMinutes && `預估 ${formatMinutes(task.estimatedMinutes)}`,
	]
		.filter(Boolean)
		.join('／');
	return (
		<li data-task={task.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
			<span className="pt-0.5">
				<TaskCheckbox task={task} />
			</span>
			<div className="min-w-0 flex-1">
				<button
					type="button"
					onClick={onOpen}
					className={cn('text-left text-dense wrap-anywhere hover:underline', done ? 'text-ink-3 line-through' : 'text-ink')}
				>
					{task.title}
				</button>
				<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-3">
					{done ? (
						<span className="inline-flex items-center gap-1 font-semibold text-success">
							<CircleCheck className="size-3.5 shrink-0" aria-hidden />
							剛完成
						</span>
					) : (
						<DueLabel due={task.dueDate} today={today} />
					)}
					{task.checklist.length > 0 && (
						<span className="inline-flex items-center gap-1">
							<ListChecks className="size-3.5 shrink-0" aria-hidden />
							<span className="sr-only">子項目完成</span>
							<span className="font-num tabular-nums">
								{checked}／{task.checklist.length}
							</span>
						</span>
					)}
					{time && (
						<span className={cn('inline-flex items-center gap-1', over && 'font-semibold text-warning')}>
							{over ? <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> : <Clock className="size-3.5 shrink-0" aria-hidden />}
							{over && <span className="sr-only">超過預估，</span>}
							{time}
						</span>
					)}
				</div>
			</div>
			{!done && (task.priority === 'high' || task.status === 'doing') && (
				<div className="flex shrink-0 flex-col items-end gap-1">
					{task.priority === 'high' && (
						<Badge tone="outline" icon={<Flag aria-hidden />}>
							高優先
						</Badge>
					)}
					{task.status === 'doing' && (
						<Badge tone="accent" icon={<CircleDot aria-hidden />}>
							進行中
						</Badge>
					)}
				</div>
			)}
		</li>
	);
}

/**
 * 這一科還沒完成的任務，可以直接勾選（TaskCheckbox）。
 * 在這裡完成的任務會從 API 的清單消失；為了能馬上取消、焦點也不會掉，把伺服器回傳的那一筆留在原位顯示「剛完成」
 * （規則在 lib/kept-tasks.ts）。同一個 key 的 <li> 不會重新掛載，TaskCheckbox 儲存中用的是 aria-disabled，
 * 勾選框的焦點從頭到尾都留在原地，不需要另外把焦點放回去。
 */
export function TasksCard({
	tasks,
	subjectId,
	today,
	onOpen,
	onAdd,
}: {
	tasks: TaskItem[];
	subjectId: string;
	today: string;
	onOpen: (task: TaskItem) => void;
	onAdd: () => void;
}) {
	const [kept, setKept] = useState<readonly KeptTask[]>([]);
	const [showAll, setShowAll] = useState(false);
	// 清單更新後，已經回到清單（取消完成、在別處改回未完成）的那幾筆不再留著，之後不會又冒出來
	const live = pruneKept(tasks, kept);
	if (live !== kept) setKept(live);
	const shown = mergeKept(tasks, live);
	const visible = showAll ? shown : shown.slice(0, TASK_LIMIT);

	// 儲存結果回來時要知道「當下清單上有哪些任務、排在第幾個」
	const shownIds = useRef<readonly string[]>([]);
	useEffect(() => {
		shownIds.current = shown.map((t) => t.id);
	});
	useTaskResults({
		onSaved: (task) => {
			const ids = shownIds.current;
			setKept((prev) => keepSaved(prev, task, subjectId, ids));
		},
		onRemoved: (id) => setKept((prev) => dropKept(prev, id)),
	});

	const add = (
		<Button variant="ghost" size="sm" onClick={onAdd}>
			<Plus className="size-4" aria-hidden />
			新增任務
		</Button>
	);

	return (
		<Card>
			<CardHeader
				title="未完成的任務"
				icon={ListChecks}
				meta={tasks.length ? `${tasks.length} 項` : undefined}
				action={shown.length > 0 && add}
			/>
			{shown.length ? (
				<>
					<ul className="divide-y divide-line border-t border-line">
						{visible.map((t) => (
							<TaskLine key={t.id} task={t} today={today} onOpen={() => onOpen(t)} />
						))}
					</ul>
					{shown.length > TASK_LIMIT && (
						<ShowMore open={showAll} onToggle={() => setShowAll((v) => !v)} total={shown.length} limit={TASK_LIMIT} unit="項" />
					)}
				</>
			) : (
				<EmptyState variant="inline" className="pb-4" title="這一科沒有未完成的任務" description="把接下來要讀的內容排進來" action={add} />
			)}
		</Card>
	);
}
