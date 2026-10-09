import { CalendarClock, CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { EventItem, Task, TaskItem } from '../../../shared/api-types';
import type { TaskGroup, TaskGroupKey } from '../../lib/task-sort';
import { TaskRow } from '../TaskItem';
import { Card, SectionLabel, ShowAllToggle, type SectionLabelTone } from '../ui';

/**
 * 已完成那一組一開始只顯示最近的幾項。清單一列只有一行、佔滿整個寬度，20 項大約是一個畫面高；
 * 看板的卡片比較高，用另一個數字（TaskBoard 的 DONE_SHOWN_IN_COLUMN）。
 */
const DONE_SHOWN_IN_LIST = 20;

const GROUP_ICON: Partial<Record<TaskGroupKey, LucideIcon>> = { overdue: CircleAlert, today: CalendarClock, done: CircleCheck };
const GROUP_TONE: Partial<Record<TaskGroupKey, SectionLabelTone>> = { overdue: 'danger', today: 'warning', done: 'success' };

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
		// 群組之間 20px（同一個清單裡的分組，比區塊間距小，單項的群組不會讓節奏跳太大）
		<div className="space-y-5">
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
	const limited = group.key === 'done' && !showAll && group.items.length > DONE_SHOWN_IN_LIST;
	const items = limited ? group.items.slice(0, DONE_SHOWN_IN_LIST) : group.items;
	return (
		<section aria-labelledby={headingId}>
			<SectionLabel
				id={headingId}
				size="sm"
				tone={GROUP_TONE[group.key]}
				icon={GROUP_ICON[group.key]}
				count={group.items.length}
				className="mb-2 px-1"
			>
				{group.title}
			</SectionLabel>
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
				{group.key === 'done' && group.items.length > DONE_SHOWN_IN_LIST && (
					<div className="border-t border-line px-2 py-1.5">
						<ShowAllToggle
							expanded={showAll}
							onToggle={() => setShowAll((v) => !v)}
							total={group.items.length}
							limit={DONE_SHOWN_IN_LIST}
						/>
					</div>
				)}
			</Card>
		</section>
	);
}
