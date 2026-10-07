import { useLayoutEffect, useRef } from 'react';
import type { EventItem, StudySession, Task } from '../../../shared/api-types';
import type { SubjectTone } from '../../../shared/color';
import { formatMinutes, weekdayLabel } from '../../lib/format';
import { EVENT_KIND_LABEL } from '../../../shared/labels';
import { formatClockRange, formatStudyMinutes, spokenDate } from '../../lib/time-format';
import { cn } from '../ui';
import { EventChip, TaskChip } from './chips';
import { EVENT_ICON } from './icons';
import { EVENT_SPAN_MIN, layoutColumns, wallMinute, type DaySegment } from './layout';

/** 一小時的高度（px）；預設捲到 07:00 */
const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const DEFAULT_SCROLL_HOUR = 7;
/** 學習時段畫出來的最小高度 */
const MIN_SESSION_PX = 18;

export type TimedItem =
	| { kind: 'session'; key: string; session: StudySession; seg: DaySegment; startMin: number; endMin: number }
	| { kind: 'event'; key: string; event: EventItem; startMin: number; endMin: number };

export type AllDayItem = { kind: 'event'; event: EventItem } | { kind: 'task'; task: Task };

type Handlers = {
	onSession: (session: StudySession) => void;
	onEvent: (event: EventItem) => void;
	onTask: (task: Task) => void;
	onSelectDay: (date: string) => void;
};

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** 週檢視的欄頭（也用在手機的一週日期列）：星期、日期、當天讀書分鐘數 */
export function DayHeaderButton({
	date,
	today,
	selected,
	minutes,
	onSelect,
	className,
}: {
	date: string;
	today: string;
	selected: boolean;
	minutes: number;
	onSelect: (date: string) => void;
	className?: string;
}) {
	const isToday = date === today;
	return (
		<button
			type="button"
			onClick={() => onSelect(date)}
			aria-pressed={selected}
			aria-current={isToday ? 'date' : undefined}
			aria-label={`${spokenDate(date)}${isToday ? '，今天' : ''}${minutes >= 1 ? `，讀書 ${formatStudyMinutes(minutes)}` : ''}`}
			className={cn(
				'flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 transition-colors duration-120 ease-out hover:bg-subtle',
				selected && 'ring-2 ring-accent ring-inset',
				className,
			)}
		>
			<span className="text-caption text-ink-3">{weekdayLabel(date)}</span>
			<span
				className={cn(
					'grid size-7 place-items-center rounded-full font-num text-sm tabular-nums',
					isToday ? 'bg-accent font-semibold text-on-accent' : 'text-ink',
				)}
			>
				{Number(date.slice(8))}
			</span>
			<span className="h-4 font-num text-caption leading-4 text-ink-3 tabular-nums">{minutes >= 1 ? `${Math.round(minutes)} 分` : ''}</span>
		</button>
	);
}

/**
 * 時間軸：週一到週日（或手機的單日）× 00:00–24:00，預設捲到 07:00。
 * - 頂部的全天列：沒有時間的考試、截止日與任務期限。
 * - 學習紀錄畫成科目色的方塊（tint 底、mark 外框、ink 文字）；跨午夜的紀錄已拆成兩段。
 * - 有時間的考試畫在對應的時段（固定 30 分鐘高，附圖示）。
 * 每個方塊都是按鈕，名稱包含日期、時間、科目與長度；完整清單在下方的當天明細。
 */
export function TimeGrid({
	days,
	today,
	selected,
	nowMin,
	timeZone,
	allDay,
	timed,
	minutesByDate,
	subjectName,
	toneOf,
	showHeader,
	itemsFailed = false,
	...on
}: {
	days: string[];
	today: string;
	selected: string;
	/** 使用者時區現在是當天第幾分鐘（畫現在時間線） */
	nowMin: number;
	timeZone: string;
	allDay: Map<string, AllDayItem[]>;
	timed: Map<string, TimedItem[]>;
	minutesByDate: Map<string, number>;
	subjectName: (subjectId: string | null) => string;
	toneOf: (subjectId: string | null) => SubjectTone;
	/** 週檢視顯示欄頭；手機單日時欄頭改成外面的一週日期列 */
	showHeader: boolean;
	/** 考試與任務載入失敗：單日的全天列不說「沒有…」（錯誤由頁面顯示） */
	itemsFailed?: boolean;
} & Handlers) {
	const scrollRef = useRef<HTMLDivElement>(null);
	// 欄頭是捲動區裡的 sticky 列，scrollTop = 7 小時剛好讓 07:00 貼在欄頭下緣（再往上留一點，時間標籤才不會被切到）。
	// 捲動區關掉 overflow-anchor：資料載入後全天列變高時，瀏覽器不會自動把畫面往下推。
	useLayoutEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_PX - 12;
	}, []);
	const single = days.length === 1;
	const cols = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` };

	return (
		<div
			ref={scrollRef}
			role="region"
			aria-label={single ? `${spokenDate(days[0])}時間軸` : '一週時間軸'}
			tabIndex={0}
			className="relative max-h-[min(40rem,68vh)] overflow-y-auto overscroll-contain [overflow-anchor:none] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
		>
			<div className="sticky top-0 z-20 border-b border-line bg-card">
				{showHeader && (
					<div className="grid px-1 pt-1" style={cols}>
						<span aria-hidden />
						{days.map((d) => (
							<DayHeaderButton
								key={d}
								date={d}
								today={today}
								selected={d === selected}
								minutes={minutesByDate.get(d) ?? 0}
								onSelect={on.onSelectDay}
							/>
						))}
					</div>
				)}
				<div className="grid px-1 py-1" style={cols}>
					<span className="self-center pr-2 text-right text-caption text-ink-3">全天</span>
					{days.map((d) => {
						const items = allDay.get(d) ?? [];
						const shown = single ? items : items.slice(0, 2);
						return (
							// 手機單日顯示全部項目：任務期限很多時最多約 3 列高，其餘在列內捲動，不會把時間軸擠掉
							<div
								key={d}
								className={cn(
									'flex min-w-0 flex-col gap-0.5 px-0.5',
									single ? 'max-h-36 overflow-y-auto overscroll-contain' : 'border-l border-line',
								)}
							>
								{shown.map((it) =>
									it.kind === 'event' ? (
										<button
											key={it.event.id}
											type="button"
											onClick={() => on.onEvent(it.event)}
											className={cn('min-w-0 rounded-sm text-left', single && 'pointer-coarse:min-h-11')}
										>
											<EventChip
												event={it.event}
												tone={toneOf(it.event.subjectId)}
												className={cn(single && 'h-auto min-h-6 py-0.5 text-sm')}
											/>
										</button>
									) : (
										<button
											key={it.task.id}
											type="button"
											onClick={() => on.onTask(it.task)}
											className={cn('min-w-0 rounded-sm text-left hover:bg-subtle', single && 'pointer-coarse:min-h-11')}
										>
											<TaskChip task={it.task} mark={toneOf(it.task.subjectId).mark} className={cn(single && 'h-auto min-h-6 text-sm')} />
										</button>
									),
								)}
								{items.length > shown.length && (
									<button
										type="button"
										onClick={() => on.onSelectDay(d)}
										className="rounded-sm px-1 text-left text-caption text-ink-3 hover:bg-subtle hover:text-ink"
									>
										還有 {items.length - shown.length} 項
									</button>
								)}
								{items.length === 0 && single && (
									<span className="px-1 text-caption text-ink-3">{itemsFailed ? '考試與任務沒有載入' : '沒有考試或任務期限'}</span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="relative grid px-1" style={{ ...cols, height: 24 * HOUR_PX }}>
				<div aria-hidden className="relative">
					{Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
						<span
							key={h}
							className="absolute right-2 -translate-y-1/2 font-num text-caption text-ink-3 tabular-nums"
							style={{ top: h * HOUR_PX }}
						>
							{hhmm(h * 60)}
						</span>
					))}
				</div>
				{days.map((d) => {
					const items = layoutColumns(timed.get(d) ?? [], MIN_SESSION_PX / PX_PER_MIN);
					return (
						<div
							key={d}
							className="relative border-l border-line"
							style={{
								backgroundImage: 'linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
								backgroundSize: `100% ${HOUR_PX}px`,
							}}
						>
							{items.map((it) =>
								it.kind === 'session' ? (
									<SessionBlock
										key={it.key}
										item={it}
										tone={toneOf(it.session.subjectId)}
										name={subjectName(it.session.subjectId)}
										timeZone={timeZone}
										single={single}
										onClick={() => on.onSession(it.session)}
									/>
								) : (
									<EventBlock key={it.key} item={it} tone={toneOf(it.event.subjectId)} onClick={() => on.onEvent(it.event)} />
								),
							)}
							{d === today && (
								<div
									aria-hidden
									className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-accent"
									style={{ top: nowMin * PX_PER_MIN }}
								>
									<span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-accent" />
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

type Placed<T> = T & { col: number; cols: number };

const place = (it: { startMin: number; endMin: number; col: number; cols: number }, minPx: number) => {
	const top = it.startMin * PX_PER_MIN;
	const height = Math.max(minPx, (it.endMin - it.startMin) * PX_PER_MIN);
	// 相鄰的方塊之間留 2px 空隙
	return {
		top: top + 1,
		height: height - 2,
		left: `calc(${(it.col / it.cols) * 100}% + 2px)`,
		width: `calc(${100 / it.cols}% - 4px)`,
	};
};

function SessionBlock({
	item,
	tone,
	name,
	timeZone,
	single,
	onClick,
}: {
	item: Placed<Extract<TimedItem, { kind: 'session' }>>;
	tone: SubjectTone;
	name: string;
	timeZone: string;
	single: boolean;
	onClick: () => void;
}) {
	const { session, seg } = item;
	const style = place(item, MIN_SESSION_PX);
	const range = formatClockRange(session.startedAt, session.endedAt, timeZone);
	const minutes = formatMinutes(session.durationSec / 60);
	const cont = seg.continuesFromPrev ? '（接續前一天）' : seg.continuesToNext ? '（延續到隔天）' : '';
	return (
		<button
			type="button"
			onClick={onClick}
			title={`${name}，${range}，${minutes}`}
			aria-label={`學習紀錄：${name}，${spokenDate(wallMinute(session.startedAt, timeZone).date)} ${range}，${minutes}${cont}`}
			className={cn(
				'absolute z-[1] flex flex-col overflow-hidden rounded-md border px-1.5 text-left leading-tight text-ink transition-shadow duration-120 ease-out hover:z-[2] hover:shadow-md focus-visible:z-[3]',
				style.height >= 30 ? 'py-1' : 'justify-center',
				seg.continuesFromPrev && 'rounded-t-none [border-top-style:dashed]',
				seg.continuesToNext && 'rounded-b-none [border-bottom-style:dashed]',
			)}
			style={{ ...style, background: tone.tint, borderColor: tone.mark }}
		>
			<span className="truncate text-caption font-semibold">{name}</span>
			{style.height >= 34 && <span className="truncate font-num text-caption text-ink-2 tabular-nums">{range}</span>}
			{single && style.height >= 50 && <span className="truncate text-caption text-ink-2">{minutes}</span>}
		</button>
	);
}

function EventBlock({
	item,
	tone,
	onClick,
}: {
	item: Placed<Extract<TimedItem, { kind: 'event' }>>;
	tone: SubjectTone;
	onClick: () => void;
}) {
	const { event } = item;
	const Icon = EVENT_ICON[event.kind];
	const style = place({ ...item, endMin: item.startMin + EVENT_SPAN_MIN }, EVENT_SPAN_MIN * PX_PER_MIN);
	return (
		<button
			type="button"
			onClick={onClick}
			title={`${EVENT_KIND_LABEL[event.kind]}：${event.title}，${event.time}`}
			aria-label={`${EVENT_KIND_LABEL[event.kind]}：${event.title}，${spokenDate(event.date)} ${event.time}`}
			className="absolute z-[1] flex items-center gap-1 overflow-hidden rounded-sm px-1.5 text-left text-caption text-ink transition-shadow duration-120 ease-out hover:z-[2] hover:shadow-md focus-visible:z-[3]"
			style={{ ...style, background: tone.tint, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
		>
			<Icon className="size-3 shrink-0 text-ink-2" aria-hidden />
			<span className="shrink-0 font-num tabular-nums">{event.time}</span>
			<span className="truncate">{event.title}</span>
		</button>
	);
}
