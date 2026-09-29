import { GraduationCap, ListPlus, MapPin, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { EventItem } from '../../shared/api-types';
import { today as todayOf } from '../../shared/dates';
import { EventDialog, TaskDialog } from '../components/forms';
import { SubjectTag } from '../components/subjects';
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader, PageLoader, cn } from '../components/ui';
import { dDay, EVENT_KIND_LABEL, formatDate, relativeDay } from '../lib/format';
import { useEvents, useUser } from '../lib/queries';

function EventCard({ event, today, onEdit, onAddTask }: { event: EventItem; today: string; onEdit: () => void; onAddTask: () => void }) {
	const rel = relativeDay(event.date, today);
	const past = rel.days < 0;
	const pct = event.taskTotal ? Math.round((event.taskDone / event.taskTotal) * 100) : 0;
	return (
		<Card as="article" className={cn('p-4', past && 'opacity-70')}>
			<div className="flex items-start gap-4">
				<div
					className={cn(
						'flex w-16 shrink-0 flex-col items-center rounded-xl py-2',
						past
							? 'bg-subtle text-ink-3'
							: rel.days <= 3
								? 'bg-danger-soft text-danger'
								: rel.days <= 14
									? 'bg-warning-soft text-warning'
									: 'bg-accent-soft text-accent-ink',
					)}
				>
					<span className="text-lg leading-tight font-bold">{dDay(event.date, today)}</span>
					<span className="text-[11px]">{rel.label}</span>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<Badge tone={event.kind === 'exam' ? 'accent' : 'neutral'}>{EVENT_KIND_LABEL[event.kind]}</Badge>
						<SubjectTag subjectId={event.subjectId} />
					</div>
					<h3 className="mt-1 text-[16px] font-semibold break-words">{event.title}</h3>
					<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-2">
						<span>
							{formatDate(event.date, true)} {event.time}
						</span>
						{event.location && (
							<span className="inline-flex items-center gap-1">
								<MapPin className="size-3.5" aria-hidden />
								{event.location}
							</span>
						)}
					</div>
					{event.notes && <p className="mt-2 text-sm whitespace-pre-wrap text-ink-2">{event.notes}</p>}
					{event.taskTotal > 0 && (
						<div className="mt-3">
							<div className="mb-1 flex justify-between text-xs text-ink-2">
								<span>準備進度</span>
								<span className="tabular-nums">
									{event.taskDone}/{event.taskTotal} 項任務・{pct}%
								</span>
							</div>
							<div
								className="h-2 overflow-hidden rounded-full bg-subtle"
								role="progressbar"
								aria-valuenow={pct}
								aria-valuemin={0}
								aria-valuemax={100}
							>
								<div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
							</div>
						</div>
					)}
				</div>
				<div className="flex shrink-0 flex-col gap-1">
					<Button size="icon" variant="ghost" onClick={onEdit} aria-label="編輯">
						<Pencil className="size-4" />
					</Button>
					{!past && (
						<Button size="icon" variant="ghost" onClick={onAddTask} aria-label="新增準備任務">
							<ListPlus className="size-4" />
						</Button>
					)}
				</div>
			</div>
		</Card>
	);
}

export function EventsPage() {
	const user = useUser();
	const today = todayOf(user.timezone);
	const { data: events, isPending, error } = useEvents();
	const [dialog, setDialog] = useState<{ event?: EventItem } | null>(null);
	const [taskFor, setTaskFor] = useState<EventItem | null>(null);
	const [showPast, setShowPast] = useState(false);

	const upcoming = (events ?? []).filter((e) => e.date >= today);
	const past = (events ?? []).filter((e) => e.date < today).reverse();

	return (
		<div>
			<PageHeader
				title="考試與截止日"
				description="倒數計時，並追蹤每場考試的準備進度"
				actions={
					<Button variant="primary" onClick={() => setDialog({})}>
						<Plus className="size-4" aria-hidden />
						新增
					</Button>
				}
			/>
			{isPending ? (
				<PageLoader />
			) : error ? (
				<ErrorNote error={error} />
			) : (
				<>
					{upcoming.length === 0 ? (
						<Card>
							<EmptyState
								icon={<GraduationCap />}
								title="沒有即將到來的考試或截止日"
								description="新增考試日期後，可以替它建立準備任務，隨時掌握進度。"
								action={
									<Button size="sm" onClick={() => setDialog({})}>
										<Plus className="size-4" aria-hidden />
										新增考試
									</Button>
								}
							/>
						</Card>
					) : (
						<div className="grid gap-3 lg:grid-cols-2">
							{upcoming.map((e) => (
								<EventCard key={e.id} event={e} today={today} onEdit={() => setDialog({ event: e })} onAddTask={() => setTaskFor(e)} />
							))}
						</div>
					)}

					{past.length > 0 && (
						<div className="mt-8">
							<button
								className="mb-3 text-sm font-medium text-ink-2 hover:text-ink"
								onClick={() => setShowPast((v) => !v)}
								aria-expanded={showPast}
							>
								{showPast ? '▾' : '▸'} 已結束（{past.length}）
							</button>
							{showPast && (
								<div className="grid gap-3 lg:grid-cols-2">
									{past.map((e) => (
										<EventCard key={e.id} event={e} today={today} onEdit={() => setDialog({ event: e })} onAddTask={() => {}} />
									))}
								</div>
							)}
						</div>
					)}
				</>
			)}

			<EventDialog open={!!dialog} event={dialog?.event} onClose={() => setDialog(null)} />
			<TaskDialog
				open={!!taskFor}
				defaults={{ eventId: taskFor?.id, subjectId: taskFor?.subjectId, dueDate: taskFor?.date }}
				onClose={() => setTaskFor(null)}
			/>
		</div>
	);
}
