import { AlarmClock, Brain, CalendarClock, CalendarDays, ChevronDown, GraduationCap, ListPlus, MapPin, Pencil, Plus } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { EventItem } from '../../shared/api-types';
import { localDate } from '../../shared/dates';
import { PrepProgress } from '../components/dashboard/exams';
import { useSubjectMark } from '../components/dashboard/hooks';
import { EventDialog, TaskDialog } from '../components/forms';
import { SubjectSelect, SubjectTag } from '../components/subjects';
import { Badge, Button, Card, cn, Countdown, EmptyState, ErrorNote, NumDisplay, PageHeader, PageLoader, TextLink } from '../components/ui';
import { eventStartMs } from '../lib/dashboard-format';
import { EVENT_KIND_LABEL, formatDate } from '../lib/format';
import { countdownState, eventsSummary, type CountdownTone } from '../lib/notes-exams';
import { useEvents, useSubjectMap, useSubjects, useUser } from '../lib/queries';
import { useNow } from '../lib/timer';
import { useDeepLink, useMinuteClock } from '../lib/timer-queries';

const DAY_MS = 86_400_000;

const TILE: Record<CountdownTone, string> = {
	urgent: 'bg-danger-soft text-danger',
	today: 'bg-warning-soft text-warning',
	normal: 'bg-subtle text-ink',
	past: 'bg-subtle text-ink-3',
};

/**
 * 倒數磚：幾天後（或幾天前）；24 小時內而且有時間的改成即時倒數（h:mm:ss）。
 * 紅色只給 3 天內的考試（DESIGN.md §1 第 5 條），並加上鬧鐘圖示，不只靠顏色；今天截止的截止日用 warning。
 * 「今天」與考試時間都依使用者時區。
 */
function CountdownTile({ event, today, timeZone, clock }: { event: EventItem; today: string; timeZone: string; clock: number }) {
	// 只有開始前 24 小時內才每 250ms 更新（即時倒數）；其他時候用頁面每 30 秒更新的時鐘
	const start = eventStartMs(event.date, event.time, timeZone);
	const live = start !== null && start - clock > 0 && start - clock < DAY_MS;
	// 停止更新後 tick 會停在最後一次的值，取兩者較新的，倒數結束時才會換成「已開始」
	const now = Math.max(useNow(live), clock);
	const s = countdownState(event, today, now, timeZone);

	let value: ReactNode;
	if (s.secondsLeft !== null) value = <Countdown seconds={s.secondsLeft} size="md" />;
	else if (s.days === 0) value = <span className="text-h2 font-bold">今天</span>;
	else value = <NumDisplay size="lg">{Math.abs(s.days)}</NumDisplay>;

	const icon = s.tone === 'urgent' ? <AlarmClock aria-hidden /> : s.tone === 'today' ? <CalendarClock aria-hidden /> : null;
	return (
		<div className={cn('flex w-[5.25rem] shrink-0 flex-col items-center justify-center rounded-lg px-2 py-2.5 text-center', TILE[s.tone])}>
			{value}
			<span className={cn('mt-1 inline-flex items-center gap-1 text-meta [&_svg]:size-3.5 [&_svg]:shrink-0', s.tone === 'normal' && 'text-ink-2')}>
				{icon}
				{s.label}
			</span>
		</div>
	);
}

function EventCard({
	event,
	today,
	clock,
	timeZone,
	onEdit,
	onAddTask,
}: {
	event: EventItem;
	today: string;
	/** 頁面每 30 秒更新的現在時間 */
	clock: number;
	timeZone: string;
	onEdit: () => void;
	onAddTask: () => void;
}) {
	const markOf = useSubjectMark();
	const subjects = useSubjectMap();
	const past = event.date < today;
	const subject = event.subjectId ? subjects.get(event.subjectId) : undefined;
	const sameYear = event.date.slice(0, 4) === today.slice(0, 4);

	return (
		<Card as="article" variant={past ? 'plain' : 'default'} className="flex h-full flex-col p-4 sm:p-5">
			<div className="flex items-start gap-3 sm:gap-4">
				<CountdownTile event={event} today={today} timeZone={timeZone} clock={clock} />
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-2 pointer-coarse:pt-3">
							<Badge icon={event.kind === 'exam' ? <GraduationCap aria-hidden /> : <CalendarClock aria-hidden />}>{EVENT_KIND_LABEL[event.kind]}</Badge>
							<SubjectTag subjectId={event.subjectId} />
						</div>
						<Button size="icon" variant="ghost" onClick={onEdit} aria-label={`編輯「${event.title}」`} className="-mt-0.5 -mr-2 shrink-0">
							<Pencil className="size-4" aria-hidden />
						</Button>
					</div>
					<h3 className="mt-1 text-h3 font-semibold break-words">{event.title}</h3>
					<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-meta text-ink-2">
						<span className="inline-flex items-center gap-1">
							<CalendarDays className="size-3.5 shrink-0 text-ink-3" aria-hidden />
							<time dateTime={event.time ? `${event.date}T${event.time}` : event.date} className="font-num tabular-nums">
								{formatDate(event.date, !sameYear)}
								{event.time && ` ${event.time}`}
							</time>
						</span>
						{event.location && (
							<span className="inline-flex min-w-0 items-center gap-1">
								<MapPin className="size-3.5 shrink-0 text-ink-3" aria-hidden />
								<span className="break-words">{event.location}</span>
							</span>
						)}
					</div>
				</div>
			</div>
			{event.notes && <p className="mt-3 line-clamp-3 text-meta break-words whitespace-pre-wrap text-ink-2">{event.notes}</p>}

			{past ? (
				event.taskTotal > 0 && <PrepProgress event={event} color={markOf(event.subjectId)} size="sm" className="mt-4" />
			) : (
				<div className="mt-auto pt-4">
					{event.taskTotal > 0 ? (
						<PrepProgress event={event} color={markOf(event.subjectId)} />
					) : (
						<p className="text-meta text-ink-3">還沒有準備任務</p>
					)}
					<div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-2">
						<Button size="sm" variant="ghost" className="-ml-2" onClick={onAddTask}>
							<ListPlus className="size-4" aria-hidden />
							新增準備任務
						</Button>
						{/* 滑鼠等精確指標維持 36px 高，卡片底部的這一列不會比左邊的按鈕高出太多；觸控裝置是 TextLink 預設的 44px */}
						{subject && (
							<TextLink
								to={`/notes?view=review&mode=cram&subject=${subject.id}`}
								aria-label={`複習「${subject.name}」的錯題`}
								className="rounded-sm pointer-fine:min-h-9"
							>
								<Brain className="mr-0.5 size-4 shrink-0" aria-hidden />
								複習這科錯題
							</TextLink>
						)}
					</div>
				</div>
			)}
		</Card>
	);
}

type DialogState = { event?: EventItem; subjectId?: string | null } | null;

export function EventsPage() {
	const user = useUser();
	// 每 30 秒更新「今天」：頁面開著跨過午夜時，倒數也會跟著換日（依使用者時區）
	const clock = useMinuteClock();
	const today = localDate(clock, user.timezone);
	const { data: events, isPending, error } = useEvents();
	const { data: subjects = [] } = useSubjects();
	const [subjectId, setSubjectId] = useState<string | null>(null);
	const [dialog, setDialog] = useState<DialogState>(null);
	const [taskFor, setTaskFor] = useState<EventItem | null>(null);
	const [showPast, setShowPast] = useState(false);
	const pastId = useId();

	// 深連結：?new=1 新增考試、?open=<id> 開啟該考試；處理後由 useDeepLink 用 replace 清掉
	const link = useDeepLink(['new', 'open']);
	const [seenLink, setSeenLink] = useState(0);
	const [pendingOpen, setPendingOpen] = useState<string | null>(null);
	const [missing, setMissing] = useState(0);
	if (link.seq !== seenLink) {
		setSeenLink(link.seq);
		if (link.values.new === '1') setDialog({ subjectId });
		if (link.values.open) setPendingOpen(link.values.open);
	}
	if (pendingOpen && events) {
		const hit = events.find((e) => e.id === pendingOpen);
		setPendingOpen(null);
		if (hit) {
			setDialog({ event: hit });
			if (hit.date < today) setShowPast(true);
		} else setMissing((m) => m + 1);
	}
	useEffect(() => {
		if (missing) toast.error('找不到這場考試，可能已經刪除了');
	}, [missing]);

	const visible = (events ?? []).filter((e) => !subjectId || e.subjectId === subjectId);
	const upcoming = visible.filter((e) => e.date >= today);
	const past = visible.filter((e) => e.date < today).reverse();
	const subjectName = subjectId ? subjects.find((s) => s.id === subjectId)?.name : undefined;

	const card = (e: EventItem) => (
		<li key={e.id} className="min-w-0">
			<EventCard
				event={e}
				today={today}
				clock={clock}
				timeZone={user.timezone}
				onEdit={() => setDialog({ event: e })}
				onAddTask={() => setTaskFor(e)}
			/>
		</li>
	);

	return (
		<div>
			<PageHeader
				title="考試與截止日"
				description={events ? eventsSummary(upcoming, today) : undefined}
				actions={
					<Button variant="primary" onClick={() => setDialog({ subjectId })}>
						<Plus className="size-4" aria-hidden />
						新增考試
					</Button>
				}
			/>
			{subjects.length > 0 && (
				<div className="mb-5 flex flex-wrap items-center gap-2">
					<div className="w-40">
						<SubjectSelect aria-label="科目" value={subjectId} onChange={setSubjectId} emptyLabel="所有科目" />
					</div>
				</div>
			)}

			{isPending ? (
				<PageLoader />
			) : error ? (
				<ErrorNote error={error} />
			) : (
				<>
					<section>
						<h2 className="sr-only">即將到來</h2>
						{upcoming.length === 0 ? (
							<Card>
								<EmptyState
									icon={<GraduationCap />}
									title={subjectName ? `「${subjectName}」沒有即將到來的考試或截止日` : '沒有即將到來的考試或截止日'}
									description="新增考試日期後，可以替它列出準備任務，隨時掌握進度。"
									action={
										<Button variant="primary" onClick={() => setDialog({ subjectId })}>
											<Plus className="size-4" aria-hidden />
											{subjectName ? '新增這科的考試' : '新增考試'}
										</Button>
									}
								/>
							</Card>
						) : (
							<ul className="grid gap-3 sm:gap-4 lg:grid-cols-2">{upcoming.map(card)}</ul>
						)}
					</section>

					{past.length > 0 && (
						<section className="mt-8">
							<h2>
								<Button variant="ghost" className="-ml-3" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} aria-controls={pastId}>
									<ChevronDown
										className={cn('size-4 transition-transform duration-180 ease-out motion-reduce:transition-none', !showPast && '-rotate-90')}
										aria-hidden
									/>
									已結束
									<span className="font-num text-ink-3 tabular-nums">{past.length}</span>
								</Button>
							</h2>
							<ul id={pastId} hidden={!showPast} className="mt-3 grid gap-3 sm:gap-4 lg:grid-cols-2">
								{showPast && past.map(card)}
							</ul>
						</section>
					)}
				</>
			)}

			<EventDialog
				open={!!dialog}
				event={dialog?.event}
				defaults={dialog?.event ? undefined : { subjectId: dialog?.subjectId ?? null }}
				onClose={() => setDialog(null)}
			/>
			<TaskDialog
				open={!!taskFor}
				defaults={{ eventId: taskFor?.id, subjectId: taskFor?.subjectId, dueDate: taskFor?.date }}
				onClose={() => setTaskFor(null)}
			/>
		</div>
	);
}
