import { Brain, CalendarClock, CalendarDays, ChevronDown, GraduationCap, ListPlus, MapPin, Pencil, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { EventItem } from '../../shared/api-types';
import { localDate } from '../../shared/dates';
import { PrepProgress } from '../components/dashboard/exams';
import { useSubjectMark } from '../components/dashboard/hooks';
import { EventDialog, TaskDialog } from '../components/forms';
import { SubjectSelect, SubjectTag } from '../components/subjects';
import { CountdownTile } from '../components/countdown';
import { Badge, Button, Card, cn, EmptyState, ErrorNote, PageHeader, PageLoader, PageStack, TextLink } from '../components/ui';
import { formatDate } from '../lib/format';
import { EVENT_KIND_LABEL } from '../../shared/labels';
import { eventsSummary } from '../lib/events-format';
import { useEvents, useSubjectMap, useSubjects, useUser } from '../lib/queries';
import { useDeepLink, useOpenDeepLink } from '../lib/deep-link';
import { useMinuteClock } from '../lib/clock';

function EventCard({
	event,
	today,
	timeZone,
	onEdit,
	onAddTask,
}: {
	event: EventItem;
	today: string;
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
				{/* 倒數磚：規則與文案全站統一（components/countdown.tsx）；固定寬度讓卡片之間對齊 */}
				<CountdownTile
					kind={event.kind}
					date={event.date}
					time={event.time}
					today={today}
					timeZone={timeZone}
					className="w-[5.25rem] px-2"
				/>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-2 pointer-coarse:pt-3">
							<Badge icon={event.kind === 'exam' ? <GraduationCap aria-hidden /> : <CalendarClock aria-hidden />}>
								{EVENT_KIND_LABEL[event.kind]}
							</Badge>
							<SubjectTag subjectId={event.subjectId} />
						</div>
						<Button size="icon" variant="ghost" onClick={onEdit} aria-label={`編輯「${event.title}」`} className="-mt-0.5 -mr-2 shrink-0">
							<Pencil className="size-4" aria-hidden />
						</Button>
					</div>
					<h3 className="mt-1 text-h3 font-semibold wrap-anywhere">{event.title}</h3>
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
								<span className="wrap-anywhere">{event.location}</span>
							</span>
						)}
					</div>
				</div>
			</div>
			{event.notes && <p className="mt-3 line-clamp-3 text-meta wrap-anywhere whitespace-pre-wrap text-ink-2">{event.notes}</p>}

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
	const { data: events, isPending, isFetching, error, refetch, isRefetching } = useEvents();
	const { data: subjects = [] } = useSubjects();
	const [subjectId, setSubjectId] = useState<string | null>(null);
	const [dialog, setDialog] = useState<DialogState>(null);
	const [taskFor, setTaskFor] = useState<EventItem | null>(null);
	const [showPast, setShowPast] = useState(false);
	const pastId = useId();

	// 深連結：?new=1 新增考試、?open=<id> 開啟該考試
	const [openId, setOpenId] = useState<string | null>(null);
	useDeepLink(['new', 'open'], ({ new: isNew, open }) => {
		if (isNew === '1') setDialog({ subjectId });
		if (open) setOpenId(open);
	});
	useOpenDeepLink(openId, {
		items: events,
		isFetching,
		onFound: (event) => {
			setDialog({ event });
			if (event.date < today) setShowPast(true);
		},
		onMissing: () => toast.error('找不到這場考試，可能已經刪除了'),
		onSettled: () => setOpenId(null),
	});

	const visible = (events ?? []).filter((e) => !subjectId || e.subjectId === subjectId);
	const upcoming = visible.filter((e) => e.date >= today);
	const past = visible.filter((e) => e.date < today).reverse();
	const subjectName = subjectId ? subjects.find((s) => s.id === subjectId)?.name : undefined;
	// 一場考試或截止日都沒有：頁首不放主要動作、篩選列隱藏，由空狀態負責唯一的 primary（跨頁慣例）
	const empty = events?.length === 0;

	const card = (e: EventItem) => (
		<li key={e.id} className="min-w-0">
			<EventCard event={e} today={today} timeZone={user.timezone} onEdit={() => setDialog({ event: e })} onAddTask={() => setTaskFor(e)} />
		</li>
	);

	return (
		<div>
			<PageHeader
				title="考試與截止日"
				description={events ? eventsSummary(upcoming, today) : undefined}
				actions={
					// 還在載入時也不放：不知道有沒有資料，避免先出現再換成空狀態（review B1）
					!empty &&
					!isPending && (
						<Button variant="primary" onClick={() => setDialog({ subjectId })}>
							<Plus className="size-4" aria-hidden />
							新增考試或截止日
						</Button>
					)
				}
			/>
			{subjects.length > 0 && !empty && !isPending && (
				<div className="mb-5 flex flex-wrap items-center gap-2">
					<div className="w-40">
						<SubjectSelect aria-label="科目" value={subjectId} onChange={setSubjectId} emptyLabel="所有科目" />
					</div>
				</div>
			)}

			{isPending ? (
				<PageLoader />
			) : error ? (
				<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />
			) : (
				<PageStack>
					<section>
						<h2 className="sr-only">即將到來</h2>
						{upcoming.length === 0 ? (
							<Card>
								{empty ? (
									<EmptyState
										icon={<GraduationCap />}
										title="還沒有考試或截止日"
										description="新增考試日期後，可以替它列出準備任務，隨時掌握進度。"
										action={
											<Button variant="primary" onClick={() => setDialog({ subjectId: null })}>
												<Plus className="size-4" aria-hidden />
												新增考試或截止日
											</Button>
										}
									/>
								) : (
									// 有資料、只是篩選後（或只剩已結束的）沒有即將到來的：頁首已經有主要動作，這裡用 secondary
									<EmptyState
										icon={<GraduationCap />}
										title={subjectName ? `「${subjectName}」沒有即將到來的考試或截止日` : '沒有即將到來的考試或截止日'}
										description={subjectName ? '換個科目，或看看所有科目。' : '已結束的考試在下方。'}
										action={subjectName && <Button onClick={() => setSubjectId(null)}>清除篩選</Button>}
									/>
								)}
							</Card>
						) : (
							<ul className="grid gap-3 sm:gap-4 lg:grid-cols-2">{upcoming.map(card)}</ul>
						)}
					</section>

					{past.length > 0 && (
						<section>
							<h2>
								<Button
									variant="ghost"
									className="-ml-3"
									onClick={() => setShowPast((v) => !v)}
									aria-expanded={showPast}
									aria-controls={pastId}
								>
									<ChevronDown
										className={cn(
											'size-4 transition-transform duration-180 ease-out motion-reduce:transition-none',
											!showPast && '-rotate-90',
										)}
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
				</PageStack>
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
