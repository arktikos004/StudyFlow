import { CalendarDays, Plus } from 'lucide-react';
import { Link } from 'react-router';
import type { EventItem } from '../../../shared/api-types';
import { diffDays } from '../../../shared/dates';
import { dDay, EVENT_KIND_LABEL, formatDate } from '../../lib/format';
import { SubjectTag } from '../subjects';
import { Button, Card, CardHeader, cn, EmptyState } from '../ui';

/** D-3 這類倒數：3 天內用紅筆（文字本身就是倒數，不只靠顏色） */
function DayChip({ date, today }: { date: string; today: string }) {
	const urgent = diffDays(today, date) <= 3;
	return (
		<span
			className={cn(
				'grid h-9 w-14 shrink-0 place-items-center rounded-lg font-num text-sm font-semibold tabular-nums',
				urgent ? 'bg-danger-soft text-danger' : 'bg-subtle text-ink-2',
			)}
		>
			{dDay(date, today)}
		</span>
	);
}

/** 總覽的「即將到來」：考試與截止日，點一下到考試頁開啟該項目 */
export function UpcomingCard({ events, today, onNew, hasNextExam }: { events: EventItem[]; today: string; onNew: () => void; hasNextExam: boolean }) {
	return (
		<Card>
			<CardHeader
				title="即將到來"
				icon={<CalendarDays className="size-[18px] text-ink-3" aria-hidden />}
				action={
					<Button size="icon" variant="ghost" onClick={onNew} aria-label="新增考試或截止日">
						<Plus className="size-5" aria-hidden />
					</Button>
				}
			/>
			{events.length ? (
				<ul className="space-y-0.5 px-2 pb-2 sm:px-3 sm:pb-3">
					{events.map((e) => (
						<li key={e.id}>
							<Link to={`/events?open=${e.id}`} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors duration-120 ease-out hover:bg-subtle">
								<DayChip date={e.date} today={today} />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-dense text-ink">{e.title}</span>
									<span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
										<span>{EVENT_KIND_LABEL[e.kind]}</span>
										<span className="font-num tabular-nums">
											{formatDate(e.date)}
											{e.time && ` ${e.time}`}
										</span>
										<SubjectTag subjectId={e.subjectId} />
									</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<EmptyState
					variant="inline"
					className="pb-4 sm:pb-5"
					title={hasNextExam ? '之後沒有其他考試或截止日' : '近期沒有考試或截止日'}
					description={hasNextExam ? undefined : '新增後會幫你倒數'}
					action={
						<Button size="sm" variant="ghost" onClick={onNew}>
							<Plus className="size-4" aria-hidden />
							新增考試或截止日
						</Button>
					}
				/>
			)}
		</Card>
	);
}
