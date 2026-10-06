import { CalendarClock, CircleAlert, CircleCheck } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { EventItem, Task, TaskItem } from '../../../shared/api-types';
import type { TaskGroup, TaskGroupKey } from '../../lib/task-sort';
import { TaskRow } from '../TaskItem';
import { Button, Card, cn } from '../ui';

/** 已完成那一組一開始只顯示最近的幾項 */
const DONE_LIMIT = 20;

const GROUP_ICON: Partial<Record<TaskGroupKey, ReactNode>> = {
	overdue: <CircleAlert className="size-4 shrink-0" aria-hidden />,
	today: <CalendarClock className="size-4 shrink-0" aria-hidden />,
	done: <CircleCheck className="size-4 shrink-0" aria-hidden />,
};
const GROUP_TONE: Partial<Record<TaskGroupKey, string>> = { overdue: 'text-danger', today: 'text-warning', done: 'text-success' };

/** 清單檢視：依期限分組（或依排序方式排成一組），已完成的在最後 */
export function TaskList({
	groups,
	today,
	eventMap,
	query,
	onOpen,
	onToggleItem,
}: {
	groups: TaskGroup<TaskItem>[];
	today: string;
	eventMap: Map<string, EventItem>;
	query: string;
	onOpen: (task: TaskItem) => void;
	onToggleItem: (task: Task | TaskItem, itemId: string) => void;
}) {
	return (
		<div className="space-y-6">
			{groups.map((g) => (
				<GroupSection key={g.key} group={g} today={today} eventMap={eventMap} query={query} onOpen={onOpen} onToggleItem={onToggleItem} />
			))}
		</div>
	);
}

function GroupSection({
	group,
	today,
	eventMap,
	query,
	onOpen,
	onToggleItem,
}: {
	group: TaskGroup<TaskItem>;
	today: string;
	eventMap: Map<string, EventItem>;
	query: string;
	onOpen: (task: TaskItem) => void;
	onToggleItem: (task: Task | TaskItem, itemId: string) => void;
}) {
	const headingId = useId();
	const [showAll, setShowAll] = useState(false);
	const limited = group.key === 'done' && !showAll && group.items.length > DONE_LIMIT;
	const items = limited ? group.items.slice(0, DONE_LIMIT) : group.items;
	return (
		<section aria-labelledby={headingId}>
			<h2 id={headingId} className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-2">
				<span className={cn('inline-flex items-center gap-1.5', GROUP_TONE[group.key])}>
					{GROUP_ICON[group.key]}
					{group.title}
				</span>
				<span className="font-num font-normal text-ink-3 tabular-nums">
					<span className="sr-only">，</span>
					{group.items.length}
					<span className="sr-only">項</span>
				</span>
			</h2>
			<Card as="div">
				<ul className="divide-y divide-line">
					{items.map((t) => (
						<li key={t.id}>
							<TaskRow
								task={t}
								today={today}
								event={t.eventId ? eventMap.get(t.eventId) : undefined}
								query={query}
								onOpen={() => onOpen(t)}
								onToggleItem={onToggleItem}
							/>
						</li>
					))}
				</ul>
				{group.key === 'done' && group.items.length > DONE_LIMIT && (
					<div className="border-t border-line px-2 py-1.5">
						<Button variant="ghost" size="sm" className="w-full" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
							{showAll ? `只顯示前 ${DONE_LIMIT} 項` : `顯示全部 ${group.items.length} 項`}
						</Button>
					</div>
				)}
			</Card>
		</section>
	);
}
