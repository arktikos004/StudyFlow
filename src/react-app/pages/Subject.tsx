import {
	Archive,
	Brain,
	CalendarClock,
	CalendarDays,
	ChevronRight,
	CircleAlert,
	CircleCheck,
	CircleDot,
	Clock,
	Flag,
	GraduationCap,
	ListChecks,
	MapPin,
	Pencil,
	Play,
	Plus,
	SearchX,
	Timer,
	TriangleAlert,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { EventItem, SubjectOverview, TaskItem } from '../../shared/api-types';
import { today as todayOf } from '../../shared/dates';
import { EventDialog, TaskDialog } from '../components/forms';
import { SubjectDialog } from '../components/settings/SubjectDialog';
import { CountdownTile } from '../components/countdown';
import { SubjectIconTile } from '../components/subjects';
import { TaskCheckbox } from '../components/TaskItem';
import {
	Badge,
	Button,
	ButtonLink,
	Card,
	CardHeader,
	cn,
	EmptyState,
	ErrorNote,
	Figure,
	GoalProgress,
	NumDisplay,
	PageHeader,
	PageLoader,
	PageStack,
	ProgressBar,
	ShowAllToggle,
	TextLink,
} from '../components/ui';
import { ApiError } from '../lib/api';
import { EVENT_KIND_LABEL, formatDate, formatMinutes } from '../lib/format';
import { dropKept, keepSaved, mergeKept, pruneKept, type KeptTask } from '../lib/polish-kept';
import { useTaskResults } from '../lib/polish-queries';
import { useSubjectOverview, useSubjects, useUser } from '../lib/queries';
import { useSubjectTone } from '../lib/subject-color';
import { splitMinutes } from '../lib/subjects-format';
import { timer, useTimerState } from '../lib/timer';

// 單科總覽（SUB-3）：/subjects/:id，資料用一次 API（useSubjectOverview）取得。
// 焦點是「下一場考試還有幾天、準備到哪裡」；其次是這科的待辦、讀書時間與錯題。

const EVENT_LIMIT = 3;
const TASK_LIMIT = 6;

// ---- 小元件 ----

/** 卡片底部的「顯示全部 N 項／只顯示前 N 項」（共用的 ShowAllToggle） */
function ShowMore({
	open,
	onToggle,
	total,
	limit,
	unit,
}: {
	open: boolean;
	onToggle: () => void;
	total: number;
	limit: number;
	unit: string;
}) {
	return (
		<div className="border-t border-line px-2 py-1.5 sm:px-3">
			<ShowAllToggle expanded={open} onToggle={onToggle} total={total} limit={limit} unit={unit} />
		</div>
	);
}

/** 分鐘數：數字用數字字型、單位用文字字型（2 小時 30 分） */
function MinutesFigure({ minutes }: { minutes: number }) {
	const { hours, minutes: rest } = splitMinutes(minutes);
	if (!hours) return <NumDisplay unit="分鐘">{rest}</NumDisplay>;
	return (
		<span className="inline-flex flex-wrap items-baseline gap-x-1.5">
			<NumDisplay unit="小時">{hours}</NumDisplay>
			{rest > 0 && <NumDisplay unit="分">{rest}</NumDisplay>}
		</span>
	);
}

// ---- 頁首動作 ----

/**
 * 開始專注：沒有計時的時候，帶入這一科開始番茄鐘並前往計時頁；
 * 已經在計時（含暫停、休息）就只前往計時頁，不會覆蓋目前的計時。
 */
function StartFocusButton({ subjectId }: { subjectId: string }) {
	const state = useTimerState();
	const navigate = useNavigate();
	if (state.phase !== 'idle')
		return (
			<Button variant="primary" onClick={() => navigate('/timer')}>
				<Timer className="size-4" aria-hidden />
				前往計時
			</Button>
		);
	return (
		<Button
			variant="primary"
			onClick={() => {
				timer.configure({ subjectId, taskId: null });
				timer.start();
				navigate('/timer');
			}}
		>
			<Play className="size-4" aria-hidden />
			開始專注
		</Button>
	);
}

// ---- 即將到來 ----

function KindBadge({ kind }: { kind: EventItem['kind'] }) {
	return (
		<Badge tone="outline" icon={kind === 'exam' ? <GraduationCap aria-hidden /> : <CalendarClock aria-hidden />}>
			{EVENT_KIND_LABEL[kind]}
		</Badge>
	);
}

function EventMeta({ event, today }: { event: EventItem; today: string }) {
	const date = formatDate(event.date, event.date.slice(0, 4) !== today.slice(0, 4));
	return (
		<p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-meta text-ink-2">
			<span className="font-num tabular-nums">{event.time ? `${date} ${event.time}` : date}</span>
			{event.location && (
				<span className="inline-flex min-w-0 items-center gap-1">
					<MapPin className="size-3.5 shrink-0" aria-hidden />
					<span className="truncate">{event.location}</span>
				</span>
			)}
		</p>
	);
}

/** 下一場考試或截止日：倒數磚、名稱、時間地點、準備進度（連結到這場的任務完成數） */
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
	const labelId = useId();
	const pct = event.taskTotal ? Math.round((event.taskDone / event.taskTotal) * 100) : 0;
	const progressText = `${event.taskDone}／${event.taskTotal} 項任務，${pct}%`;
	return (
		<div className="flex items-start gap-4 px-4 pt-1 pb-4 sm:px-5">
			<CountdownTile kind={event.kind} date={event.date} time={event.time} today={today} timeZone={timeZone} />
			<div className="min-w-0 flex-1 space-y-3">
				<div>
					<KindBadge kind={event.kind} />
					<button
						type="button"
						onClick={onOpen}
						className="mt-1 block text-left text-h3 font-semibold wrap-anywhere text-ink hover:underline"
					>
						{event.title}
					</button>
					<EventMeta event={event} today={today} />
				</div>
				{event.taskTotal > 0 ? (
					<div className="space-y-1.5">
						<div className="flex items-baseline justify-between gap-3 text-meta">
							<span id={labelId} className="text-ink-2">
								準備進度
							</span>
							<span className="font-num text-ink-2 tabular-nums">
								<span className="font-semibold text-ink">{event.taskDone}</span>／{event.taskTotal} 項任務，{pct}%
							</span>
						</div>
						<ProgressBar
							value={event.taskDone}
							max={event.taskTotal}
							labelledBy={labelId}
							valueText={progressText}
							color={color}
							size="sm"
						/>
					</div>
				) : (
					<p className="text-meta text-ink-3">還沒有準備任務：新增任務時選擇這場{EVENT_KIND_LABEL[event.kind]}，就會計入準備進度。</p>
				)}
			</div>
		</div>
	);
}

function EventRow({ event, today, timeZone, onOpen }: { event: EventItem; today: string; timeZone: string; onOpen: () => void }) {
	const date = formatDate(event.date, event.date.slice(0, 4) !== today.slice(0, 4));
	const meta = [
		EVENT_KIND_LABEL[event.kind],
		event.time ? `${date} ${event.time}` : date,
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

function UpcomingCard({
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

// ---- 未完成的任務 ----

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
 * （規則在 lib/polish-kept.ts）。同一個 key 的 <li> 不會重新掛載，TaskCheckbox 儲存中用的是 aria-disabled，
 * 勾選框的焦點從頭到尾都留在原地，不需要另外把焦點放回去。
 */
function TasksCard({
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

// ---- 讀書時間、錯題 ----

function StudyTimeCard({
	week,
	last30,
	goal,
	color,
	onSetGoal,
}: {
	week: number;
	last30: number;
	goal: number | null;
	color: string;
	onSetGoal: () => void;
}) {
	return (
		<Card>
			<CardHeader title="讀書時間" icon={Clock} />
			<dl className="grid grid-cols-2">
				<Figure label="本週" sub="週一起算">
					<MinutesFigure minutes={week} />
				</Figure>
				<Figure label="近 30 天" sub="含今天" className="border-l border-line">
					<MinutesFigure minutes={last30} />
				</Figure>
			</dl>
			<div className="border-t border-line px-4 py-4 sm:px-5">
				{goal ? (
					<GoalProgress label="每週目標" value={week} goal={goal} unit="" format={formatMinutes} color={color} />
				) : (
					<div className="flex flex-wrap items-center justify-between gap-x-3">
						<p className="text-sm text-ink-2">還沒有設定這一科的每週目標</p>
						<button
							type="button"
							onClick={onSetGoal}
							className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-accent-ink hover:underline"
						>
							設定目標
							<ChevronRight className="size-4" aria-hidden />
						</button>
					</div>
				)}
			</div>
		</Card>
	);
}

function MistakesCard({ mistakes, subjectId, color }: { mistakes: SubjectOverview['mistakes']; subjectId: string; color: string }) {
	const labelId = useId();
	const { total, mastered, due } = mistakes;
	const pct = total ? Math.round((mastered / total) * 100) : 0;
	return (
		<Card>
			<CardHeader title="錯題" icon={Brain} />
			{total === 0 ? (
				<EmptyState
					variant="inline"
					className="pb-4"
					title="還沒有這一科的錯題"
					description="寫錯的題目記下來，考前可以集中複習"
					action={<TextLink to={`/notes?new=mistake&subject=${subjectId}`}>新增錯題</TextLink>}
				/>
			) : (
				<>
					<dl className="grid grid-cols-3">
						<Figure label="總數">
							<NumDisplay unit="題">{total}</NumDisplay>
						</Figure>
						<Figure label="已掌握" className="border-l border-line">
							<NumDisplay unit="題">{mastered}</NumDisplay>
						</Figure>
						<Figure label="待複習" className="border-l border-line">
							<NumDisplay unit="題">{due}</NumDisplay>
						</Figure>
					</dl>
					<div className="space-y-4 border-t border-line px-4 py-4 sm:px-5">
						<div className="space-y-1.5">
							<div className="flex items-baseline justify-between gap-3 text-meta">
								<span id={labelId} className="text-ink-2">
									掌握程度
								</span>
								<span className="font-num text-ink-2 tabular-nums">{pct}%</span>
							</div>
							<ProgressBar
								value={mastered}
								max={total}
								labelledBy={labelId}
								valueText={`已掌握 ${mastered}／${total} 題，${pct}%`}
								color={color}
								size="sm"
							/>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
							{due > 0 ? (
								<span className="inline-flex items-center gap-1 text-meta font-semibold text-warning">
									<Clock className="size-3.5 shrink-0" aria-hidden />
									今天有 {due} 題待複習
								</span>
							) : mastered === total ? (
								<span className="inline-flex items-center gap-1 text-meta font-semibold text-success">
									<CircleCheck className="size-3.5 shrink-0" aria-hidden />
									全部都掌握了
								</span>
							) : (
								<span className="text-meta text-ink-3">今天沒有到期的錯題</span>
							)}
							<ButtonLink to={`/notes?view=review&mode=cram&subject=${subjectId}`}>
								<Brain className="size-4" aria-hidden />
								複習這科
							</ButtonLink>
						</div>
					</div>
				</>
			)}
		</Card>
	);
}

// ---- 頁面 ----

function Overview({ data }: { data: SubjectOverview }) {
	const { subject, upcomingEvents, openTasks, minutes, mistakes } = data;
	const user = useUser();
	const today = todayOf(user.timezone);
	const tone = useSubjectTone()(subject.color);
	const mark = tone.mark;
	const { data: subjects = [] } = useSubjects();
	const navigate = useNavigate();
	const [editing, setEditing] = useState(false);
	const [taskDialog, setTaskDialog] = useState<{ task?: TaskItem } | null>(null);
	const [eventDialog, setEventDialog] = useState<{ event?: EventItem } | null>(null);

	const summary = [
		minutes.week > 0 ? `本週讀了 ${formatMinutes(minutes.week)}` : '本週還沒讀這一科',
		openTasks.length ? `${openTasks.length} 項任務未完成` : '沒有未完成的任務',
	].join('，');

	return (
		<div>
			<PageHeader
				title={
					<span className="flex items-center gap-3">
						{/* 直接用這次 API 回傳的科目資料：不必等科目清單（另一個請求），直接開啟這一頁時方塊不會晚一拍才出現 */}
						<SubjectIconTile name={subject.name} tone={tone} icon={subject.icon} />
						<span className="min-w-0 wrap-anywhere">{subject.name}</span>
					</span>
				}
				description={
					<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
						{subject.archived && <Badge icon={<Archive aria-hidden />}>已封存</Badge>}
						{summary}
					</span>
				}
				actions={
					<>
						<Button onClick={() => setEditing(true)}>
							<Pencil className="size-4" aria-hidden />
							編輯科目
						</Button>
						<StartFocusButton subjectId={subject.id} />
					</>
				}
			/>

			{/* 桌面兩欄（3：2）；手機依 DOM 順序：考試、任務、讀書時間、錯題 */}
			<div className="grid grid-cols-1 items-start gap-section lg:grid-cols-5">
				<PageStack className="min-w-0 lg:col-span-3">
					<UpcomingCard
						events={upcomingEvents}
						today={today}
						timeZone={user.timezone}
						color={mark}
						onOpen={(event) => setEventDialog({ event })}
						onAdd={() => setEventDialog({})}
					/>
					<TasksCard
						tasks={openTasks}
						subjectId={subject.id}
						today={today}
						onOpen={(task) => setTaskDialog({ task })}
						onAdd={() => setTaskDialog({})}
					/>
				</PageStack>
				<PageStack className="min-w-0 lg:col-span-2">
					<StudyTimeCard
						week={minutes.week}
						last30={minutes.last30}
						goal={subject.weeklyGoalMinutes}
						color={mark}
						onSetGoal={() => setEditing(true)}
					/>
					<MistakesCard mistakes={mistakes} subjectId={subject.id} color={mark} />
				</PageStack>
			</div>

			<SubjectDialog
				open={editing}
				onClose={() => setEditing(false)}
				subject={subject}
				subjects={subjects}
				onDeleted={() => navigate('/settings', { replace: true })}
			/>
			<TaskDialog open={!!taskDialog} task={taskDialog?.task} defaults={{ subjectId: subject.id }} onClose={() => setTaskDialog(null)} />
			<EventDialog
				open={!!eventDialog}
				event={eventDialog?.event}
				defaults={{ subjectId: subject.id }}
				onClose={() => setEventDialog(null)}
			/>
		</div>
	);
}

function SubjectNotFound() {
	return (
		<div>
			<PageHeader title="科目總覽" />
			<Card>
				<EmptyState
					icon={<SearchX />}
					title="找不到此科目"
					description="這個科目可能已經刪除，或不屬於你的帳號。"
					action={<ButtonLink to="/settings">查看所有科目</ButtonLink>}
				/>
			</Card>
		</div>
	);
}

/** 單科總覽（SUB-3）。不是本人的科目或不存在時，API 回 404，顯示「找不到此科目」 */
export function SubjectPage() {
	const { id } = useParams();
	const { data, isPending, error, refetch, isRefetching } = useSubjectOverview(id);
	// 科目清單（編輯科目、任務與考試對話框的科目選單要用）和總覽同時開始載入，不必等總覽回來才去要
	useSubjects();
	if (isPending) return <PageLoader />;
	if (error) {
		if (error instanceof ApiError && error.status === 404) return <SubjectNotFound />;
		return <ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
	}
	return <Overview key={data.subject.id} data={data} />;
}
