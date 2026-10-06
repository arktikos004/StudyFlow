import { ChevronLeft, ChevronRight, ListPlus, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { EventItem, StudySession, Task } from '../../shared/api-types';
import { addDays, today as todayOf } from '../../shared/dates';
import { DayPanel } from '../components/calendar/DayPanel';
import {
	EVENT_SPAN_MIN,
	eventStartMinute,
	minutesByDate,
	monthGrid,
	shiftMonth,
	splitByDay,
	wallMinute,
	weekDays,
} from '../components/calendar/layout';
import { MonthView, type DayItems } from '../components/calendar/MonthView';
import { DayHeaderButton, TimeGrid, type AllDayItem, type TimedItem } from '../components/calendar/TimeGrid';
import { EventDialog, TaskDialog } from '../components/forms';
import { SessionDialog } from '../components/SessionDialog';
import { SubjectTag } from '../components/subjects';
import { Button, Card, ErrorNote, PageHeader, PageStack, Segmented } from '../components/ui';
import { formatDate, formatMinutes, formatMonthDay } from '../lib/format';
import { useEvents, useSubjectMap, useTasks, useUser } from '../lib/queries';
import { useSubjectTone } from '../lib/subject-color';
import { useDeepLink, useEventsKeep, useMediaQuery, useMinuteClock, useSessionsKeep } from '../lib/timer-queries';

type View = 'month' | 'week';
const VIEW_KEY = 'studyflow:calendar-view';
const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function readView(): View {
	try {
		return localStorage.getItem(VIEW_KEY) === 'week' ? 'week' : 'month';
	} catch {
		return 'month';
	}
}

/** ?open=<id>：在全部考試與任務裡找（找到就回報，找不到回報 null） */
function OpenTarget({ id, onResolve }: { id: string; onResolve: (hit: { event?: EventItem; task?: Task } | null) => void }) {
	const { data: events } = useEvents();
	const { data: tasks } = useTasks();
	useEffect(() => {
		if (!events || !tasks) return;
		const event = events.find((e) => e.id === id);
		const task = tasks.find((t) => t.id === id);
		onResolve(event ? { event } : task ? { task } : null);
	}, [events, tasks, id, onResolve]);
	return null;
}

export function CalendarPage() {
	const user = useUser();
	const tz = user.timezone;
	const today = todayOf(tz);
	const nowMs = useMinuteClock();
	// 7 欄的週檢視需要約 90px 一欄：lg 以上才畫整週，手機與直向平板改成單日時間軸
	const wide = useMediaQuery('(min-width: 64rem)');
	const titleId = useId();
	const [view, setViewState] = useState<View>(readView);
	const [selected, setSelected] = useState(today);
	const [month, setMonth] = useState(today.slice(0, 7));
	const [eventDialog, setEventDialog] = useState<{ event?: EventItem; date?: string } | null>(null);
	const [taskDialog, setTaskDialog] = useState<{ task?: Task; date?: string } | null>(null);
	const [sessionDialog, setSessionDialog] = useState<{ session?: StudySession; date?: string } | null>(null);
	const [openId, setOpenId] = useState<string | null>(null);
	const subjectMap = useSubjectMap();
	const tone = useSubjectTone();
	const toneOf = (id: string | null) => tone(id ? subjectMap.get(id)?.color : null);
	const subjectName = (id: string | null) => (id && subjectMap.get(id)?.name) || '未分類';

	const setView = (v: View) => {
		setViewState(v);
		if (v === 'month') setMonth(selected.slice(0, 7));
		try {
			localStorage.setItem(VIEW_KEY, v);
		} catch {
			// 只影響下次開啟時的預設檢視
		}
	};
	const selectDate = (date: string, followMonth = true) => {
		setSelected(date);
		if (followMonth) setMonth(date.slice(0, 7));
	};

	// 深連結：?new=1 新增考試、?open=<id> 開啟考試或任務、?date=YYYY-MM-DD 選取日期、?view=week|month
	const link = useDeepLink(['new', 'open', 'date', 'view']);
	const [seenLink, setSeenLink] = useState(0);
	if (link.seq !== seenLink) {
		setSeenLink(link.seq);
		const { date, view: v, open } = link.values;
		if (v === 'week' || v === 'month') setViewState(v);
		if (isDate(date)) selectDate(date);
		if (link.values.new === '1') setEventDialog({ date: isDate(date) ? date : selected });
		if (open) setOpenId(open);
	}
	const onResolve = useMemo(
		() => (hit: { event?: EventItem; task?: Task } | null) => {
			setOpenId(null);
			const date = hit?.event?.date ?? hit?.task?.dueDate;
			if (date) {
				setSelected(date);
				setMonth(date.slice(0, 7));
			}
			if (hit?.event) setEventDialog({ event: hit.event });
			else if (hit?.task) setTaskDialog({ task: hit.task });
		},
		[],
	);

	// 目前畫面的日期範圍
	const single = view === 'week' && !wide;
	const grid = monthGrid(month);
	const week = weekDays(selected);
	const [from, to] = view === 'month' ? [grid[0], grid[41]] : [week[0], week[6]];
	// 換月份或週次時保留上一個範圍的資料，新資料到之前 chip、分鐘數、方塊不會閃成空白
	const eventsQuery = useEventsKeep({ from, to });
	const tasksQuery = useTasks();
	// 前一天開始、跨午夜到範圍第一天的紀錄也要畫出來
	const sessionsQuery = useSessionsKeep({ from: addDays(from, -1), to });
	const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
	const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
	const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
	// 載入失敗不能顯示成「沒有安排」：頁面上方顯示錯誤與「重新載入」，摘要與日面板也不說「沒有…」
	const failed = [eventsQuery, tasksQuery, sessionsQuery].filter((q) => q.error);
	const itemsFailed = !!eventsQuery.error || !!tasksQuery.error;
	const sessionsFailed = !!sessionsQuery.error;

	const itemsByDate = useMemo(() => {
		const map = new Map<string, DayItems>();
		const at = (d: string) => {
			let v = map.get(d);
			if (!v) map.set(d, (v = { events: [], tasks: [] }));
			return v;
		};
		events.forEach((e) => at(e.date).events.push(e));
		tasks.forEach((t) => t.dueDate && at(t.dueDate).tasks.push(t));
		return map;
	}, [events, tasks]);
	const minutes = useMemo(() => minutesByDate(sessions, tz), [sessions, tz]);

	const { allDay, timed } = useMemo(() => {
		const allDay = new Map<string, AllDayItem[]>();
		const timed = new Map<string, TimedItem[]>();
		const push = <T,>(map: Map<string, T[]>, d: string, item: T) => map.set(d, [...(map.get(d) ?? []), item]);
		for (const e of events) {
			const start = eventStartMinute(e.time);
			if (start === null) push(allDay, e.date, { kind: 'event', event: e });
			else push(timed, e.date, { kind: 'event', key: e.id, event: e, startMin: start, endMin: start + EVENT_SPAN_MIN });
		}
		for (const t of tasks) if (t.dueDate) push(allDay, t.dueDate, { kind: 'task', task: t });
		for (const s of sessions)
			splitByDay(s.startedAt, s.endedAt, tz).forEach((seg, i) =>
				push(timed, seg.date, { kind: 'session', key: `${s.id}:${i}`, session: s, seg, startMin: seg.startMin, endMin: seg.endMin }),
			);
		return { allDay, timed };
	}, [events, tasks, sessions, tz]);

	const selectedItems = itemsByDate.get(selected);
	const selectedSessions = sessions.filter((s) => wallMinute(s.startedAt, tz).date === selected);
	const nowMin = wallMinute(nowMs, tz).minute;

	// 即時摘要：這個月（或這週）的考試、截止日、任務期限與讀書時間
	const rangeDays = view === 'month' ? grid.filter((d) => d.startsWith(month)) : week;
	const summary = (() => {
		let exams = 0;
		let deadlines = 0;
		let due = 0;
		let studied = 0;
		for (const d of rangeDays) {
			const it = itemsByDate.get(d);
			exams += it?.events.filter((e) => e.kind === 'exam').length ?? 0;
			deadlines += it?.events.filter((e) => e.kind === 'deadline').length ?? 0;
			due += it?.tasks.filter((t) => t.status !== 'done').length ?? 0;
			studied += minutes.get(d) ?? 0;
		}
		const parts = [exams && `${exams} 場考試`, deadlines && `${deadlines} 個截止日`, due && `${due} 項任務到期`].filter(Boolean).join('、');
		const lead = view === 'month' ? `${Number(month.slice(5))} 月` : '這週';
		if (failed.length) return undefined;
		if (!parts && studied < 1) return `${lead}還沒有安排`;
		return `${lead}${parts ? `：${parts}` : ''}${studied >= 1 ? `${parts ? '，' : '：'}已讀 ${formatMinutes(studied)}` : ''}`;
	})();

	// 範圍內出現的科目（圖例）
	const legendSubjects = [...new Set([...events, ...sessions].map((x) => x.subjectId))].sort((a, b) =>
		a === null ? 1 : b === null ? -1 : (subjectMap.get(a)?.sortOrder ?? 0) - (subjectMap.get(b)?.sortOrder ?? 0),
	);

	const [y, m] = month.split('-');
	const title =
		view === 'month'
			? `${y} 年 ${Number(m)} 月`
			: single
				? formatDate(selected, selected.slice(0, 4) !== today.slice(0, 4))
				: `${week[0].slice(0, 4)} 年 ${formatMonthDay(week[0])}–${formatMonthDay(week[6])}`;
	const step =
		view === 'month'
			? { prev: '上個月', next: '下個月' }
			: single
				? { prev: '前一天', next: '後一天' }
				: { prev: '上一週', next: '下一週' };
	const go = (delta: 1 | -1) => {
		if (view === 'week') return selectDate(addDays(selected, single ? delta : delta * 7));
		const next = shiftMonth(month, delta);
		setMonth(next);
		// 換月時選取也跟著換：新月份有今天就選今天，否則選 1 號
		setSelected(today.startsWith(next) ? today : `${next}-01`);
	};

	const grid_ = (
		<Card className="min-w-0 overflow-hidden">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
				<h2 id={titleId} className="px-1 text-h2 font-semibold tabular-nums" aria-live="polite">
					{title}
				</h2>
				<div className="flex items-center gap-1">
					<Button size="sm" variant="ghost" onClick={() => selectDate(today)}>
						今天
					</Button>
					<Button size="icon" variant="ghost" onClick={() => go(-1)} aria-label={step.prev}>
						<ChevronLeft className="size-5" />
					</Button>
					<Button size="icon" variant="ghost" onClick={() => go(1)} aria-label={step.next}>
						<ChevronRight className="size-5" />
					</Button>
					<Segmented<View>
						label="檢視方式"
						value={view}
						onChange={setView}
						className="ml-1"
						options={[
							{ value: 'month', label: '月' },
							{ value: 'week', label: '週' },
						]}
					/>
				</div>
			</div>
			{view === 'month' ? (
				<MonthView
					month={month}
					selected={selected}
					today={today}
					labelledBy={titleId}
					itemsByDate={itemsByDate}
					minutesByDate={minutes}
					toneOf={toneOf}
					onSelect={(d) => selectDate(d, false)}
					onMove={(d) => selectDate(d)}
					onCreate={(d) => setEventDialog({ date: d })}
				/>
			) : (
				<>
					{single && (
						<div className="grid grid-cols-7 gap-0.5 border-b border-line px-1 py-1">
							{week.map((d) => (
								<DayHeaderButton
									key={d}
									date={d}
									today={today}
									selected={d === selected}
									minutes={minutes.get(d) ?? 0}
									onSelect={(x) => selectDate(x)}
								/>
							))}
						</div>
					)}
					<TimeGrid
						days={single ? [selected] : week}
						today={today}
						selected={selected}
						nowMin={nowMin}
						timeZone={tz}
						allDay={allDay}
						timed={timed}
						minutesByDate={minutes}
						subjectName={subjectName}
						toneOf={toneOf}
						showHeader={!single}
						itemsFailed={itemsFailed}
						onSession={(session) => setSessionDialog({ session })}
						onEvent={(event) => setEventDialog({ event })}
						onTask={(task) => setTaskDialog({ task })}
						onSelectDay={(d) => selectDate(d)}
					/>
				</>
			)}
			{legendSubjects.length > 0 && (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5" aria-label="科目圖例" role="group">
					{legendSubjects.map((id) =>
						id ? (
							<SubjectTag key={id} subjectId={id} variant="compact" />
						) : (
							<span key="none" className="inline-flex items-center gap-1.5 text-xs text-ink-2">
								<span aria-hidden className="size-2 rounded-full" style={{ background: toneOf(null).mark }} />
								未分類
							</span>
						),
					)}
				</div>
			)}
		</Card>
	);

	return (
		<div>
			<PageHeader
				title="月曆"
				description={summary}
				actions={
					<>
						<Button onClick={() => setTaskDialog({ date: selected })}>
							<ListPlus className="size-4" aria-hidden />
							任務
						</Button>
						<Button variant="primary" onClick={() => setEventDialog({ date: selected })}>
							<Plus className="size-4" aria-hidden />
							考試／截止日
						</Button>
					</>
				}
			/>

			<PageStack>
				{failed.length > 0 && (
					<ErrorNote
						error={failed[0].error}
						onRetry={() => failed.forEach((q) => void q.refetch())}
						retrying={failed.some((q) => q.isRefetching)}
					/>
				)}
				<div className={view === 'month' ? 'grid gap-section lg:grid-cols-[minmax(0,1fr)_20rem]' : 'flex flex-col gap-section'}>
					{grid_}
					<DayPanel
						className={view === 'month' ? 'self-start' : 'w-full lg:max-w-2xl'}
						date={selected}
						today={today}
						timeZone={tz}
						events={selectedItems?.events ?? []}
						tasks={selectedItems?.tasks ?? []}
						sessions={selectedSessions}
						onEvent={(event) => setEventDialog({ event })}
						onTask={(task) => setTaskDialog({ task })}
						onSession={(session) => setSessionDialog({ session })}
						onNewEvent={() => setEventDialog({ date: selected })}
						onNewTask={() => setTaskDialog({ date: selected })}
						onNewSession={() => setSessionDialog({ date: selected })}
						itemsFailed={itemsFailed}
						sessionsFailed={sessionsFailed}
					/>
				</div>
			</PageStack>

			{openId && <OpenTarget id={openId} onResolve={onResolve} />}
			<EventDialog open={!!eventDialog} event={eventDialog?.event} defaultDate={eventDialog?.date} onClose={() => setEventDialog(null)} />
			<TaskDialog
				open={!!taskDialog}
				task={taskDialog?.task}
				defaults={{ dueDate: taskDialog?.date }}
				onClose={() => setTaskDialog(null)}
			/>
			<SessionDialog
				open={!!sessionDialog}
				session={sessionDialog?.session}
				defaultDate={sessionDialog?.date}
				onClose={() => setSessionDialog(null)}
			/>
		</div>
	);
}
