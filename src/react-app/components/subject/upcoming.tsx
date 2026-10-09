import { ChevronRight, GraduationCap, Plus } from 'lucide-react';
import { useState } from 'react';
import type { EventItem } from '../../../shared/api-types';
import { EVENT_KIND_LABEL } from '../../../shared/labels';
import { formatDateForToday } from '../../lib/format';
import { CountdownTile } from '../countdown';
import { PrepProgress } from '../dashboard/exams';
import { EventKindBadge, EventWhenWhere } from '../event-meta';
import { Button, Card, CardHeader, EmptyState } from '../ui';
import { ShowMore } from './show-more';

// 單科總覽的「即將到來」：最近一場考試或截止日放大顯示，其他列在下面。

/** 最近一場以外先列出幾場，其餘收在「顯示全部」 */
const EVENT_LIMIT = 3;

/** 日期與時間（9/29（一） 14:00）；不是今年時加上年份 */
const eventWhen = (event: EventItem, today: string) => [formatDateForToday(event.date, today), event.time].filter(Boolean).join(' ');

/** 下一場考試或截止日：倒數磚、名稱、時間地點、準備進度（和考試頁、總覽一樣的 PrepProgress） */
function NextEvent({
	event,
	today,
	timeZone,
	color,
	onOpen,
}: {
	event: EventItem;
	today: string;
	timeZone: string;
	color: string;
	onOpen: () => void;
}) {
	return (
		<div className="flex items-start gap-4 px-4 pt-1 pb-4 sm:px-5">
			<CountdownTile kind={event.kind} date={event.date} time={event.time} today={today} timeZone={timeZone} />
			<div className="min-w-0 flex-1 space-y-3">
				<div>
					<EventKindBadge kind={event.kind} />
					<button
						type="button"
						onClick={onOpen}
						className="mt-1 block text-left text-h3 font-semibold wrap-anywhere text-ink hover:underline"
					>
						{event.title}
					</button>
					<EventWhenWhere event={event} today={today} className="mt-0.5" />
				</div>
				{event.taskTotal > 0 ? (
					<PrepProgress event={event} color={color} size="sm" />
				) : (
					<p className="text-meta text-ink-3">還沒有準備任務：新增任務時選擇這場{EVENT_KIND_LABEL[event.kind]}，就會計入準備進度。</p>
				)}
			</div>
		</div>
	);
}

function EventRow({ event, today, timeZone, onOpen }: { event: EventItem; today: string; timeZone: string; onOpen: () => void }) {
	const meta = [
		EVENT_KIND_LABEL[event.kind],
		eventWhen(event, today),
		event.taskTotal ? `準備 ${event.taskDone}／${event.taskTotal}` : null,
	];
	return (
		<button
			type="button"
			onClick={onOpen}
			className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-120 ease-out hover:bg-subtle sm:px-5"
		>
			<CountdownTile kind={event.kind} date={event.date} today={today} timeZone={timeZone} size="sm" className="w-[4.75rem]" />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-dense text-ink">{event.title}</span>
				<span className="block truncate text-meta text-ink-3">{meta.filter(Boolean).join('，')}</span>
			</span>
			<ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
		</button>
	);
}

export function UpcomingCard({
	events,
	today,
	timeZone,
	color,
	onOpen,
	onAdd,
}: {
	events: EventItem[];
	today: string;
	timeZone: string;
	color: string;
	onOpen: (event: EventItem) => void;
	onAdd: () => void;
}) {
	const [showAll, setShowAll] = useState(false);
	const [next, ...rest] = events;
	const visible = showAll ? rest : rest.slice(0, EVENT_LIMIT);
	return (
		<Card>
			<CardHeader title="即將到來" icon={GraduationCap} meta={events.length ? `${events.length} 場` : undefined} />
			{next ? (
				<>
					<NextEvent event={next} today={today} timeZone={timeZone} color={color} onOpen={() => onOpen(next)} />
					{rest.length > 0 && (
						<ul className="divide-y divide-line border-t border-line">
							{visible.map((e) => (
								<li key={e.id}>
									<EventRow event={e} today={today} timeZone={timeZone} onOpen={() => onOpen(e)} />
								</li>
							))}
						</ul>
					)}
					{rest.length > EVENT_LIMIT && (
						<ShowMore open={showAll} onToggle={() => setShowAll((v) => !v)} total={rest.length} limit={EVENT_LIMIT} unit="場" />
					)}
				</>
			) : (
				<EmptyState
					variant="inline"
					className="pb-4"
					title="近期沒有這一科的考試或截止日"
					description="新增時選擇這一科，就會出現在這裡"
					action={
						<Button variant="ghost" size="sm" onClick={onAdd}>
							<Plus className="size-4" aria-hidden />
							新增考試
						</Button>
					}
				/>
			)}
		</Card>
	);
}
