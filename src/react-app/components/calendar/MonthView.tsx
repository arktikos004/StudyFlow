import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { EventItem, Task } from '../../../shared/api-types';
import type { SubjectTone } from '../../../shared/color';
import { formatStudyMinutes, spokenDate } from '../../lib/time-format';
import { cn } from '../ui';
import { EventChip, TaskChip } from './chips';
import { monthGrid, moveDate } from './layout';

export type DayItems = { events: EventItem[]; tasks: Task[] };

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_HEAD_FULL = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

/** 格子的報讀：日期、今天、考試／截止日／任務數、讀書時間 */
function cellLabel(date: string, today: string, items: DayItems | undefined, minutes: number) {
	const parts = [spokenDate(date)];
	if (date === today) parts.push('今天');
	const exams = items?.events.filter((e) => e.kind === 'exam').length ?? 0;
	const deadlines = (items?.events.length ?? 0) - exams;
	const tasks = items?.tasks.length ?? 0;
	if (exams) parts.push(`${exams} 場考試`);
	if (deadlines) parts.push(`${deadlines} 個截止日`);
	if (tasks) parts.push(`${tasks} 項任務到期`);
	if (minutes >= 1) parts.push(`讀書 ${formatStudyMinutes(minutes)}`);
	if (!exams && !deadlines && !tasks && minutes < 1) parts.push('沒有安排');
	return parts.join('，');
}

/**
 * 月檢視：WAI-ARIA grid（grid、row、gridcell 三層），只有一個 tab stop（選取的那天）。
 * 左右方向鍵 ±1 天、上下方向鍵 ±7 天、Home／End 到週一／週日、PageUp／PageDown 換月（Shift 換年）；
 * 今天加 aria-current="date"，選取中用內框 ring。每一格顯示當天的讀書分鐘數。
 */
export function MonthView({
	month,
	selected,
	today,
	labelledBy,
	itemsByDate,
	minutesByDate,
	toneOf,
	onSelect,
	onMove,
	onCreate,
}: {
	month: string;
	selected: string;
	today: string;
	labelledBy: string;
	itemsByDate: Map<string, DayItems>;
	minutesByDate: Map<string, number>;
	toneOf: (subjectId: string | null) => SubjectTone;
	onSelect: (date: string) => void;
	/** 鍵盤移動：可能跨月 */
	onMove: (date: string) => void;
	onCreate: (date: string) => void;
}) {
	const days = monthGrid(month);
	const gridRef = useRef<HTMLDivElement>(null);
	const focusAfterMove = useRef(false);
	// 唯一的 tab stop：選取的那天在畫面上就用它，否則用今天，再不然用這個月 1 號
	const tabStop = days.includes(selected) ? selected : days.includes(today) ? today : `${month}-01`;

	useEffect(() => {
		if (!focusAfterMove.current) return;
		focusAfterMove.current = false;
		gridRef.current?.querySelector<HTMLElement>(`[data-date="${selected}"]`)?.focus();
	}, [selected, month]);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, date: string) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(date);
			return;
		}
		const next = moveDate(date, e.key, e.shiftKey);
		if (!next) return;
		e.preventDefault();
		focusAfterMove.current = true;
		onMove(next);
	};

	return (
		<div ref={gridRef} role="grid" aria-labelledby={labelledBy} className="select-none">
			<div role="row" className="grid grid-cols-7 border-b border-line">
				{WEEK_HEAD.map((d, i) => (
					<div
						key={d}
						role="columnheader"
						aria-label={WEEK_HEAD_FULL[i]}
						className="py-2 text-center text-caption font-semibold text-ink-3"
					>
						{d}
					</div>
				))}
			</div>
			{Array.from({ length: 6 }, (_, row) => (
				<div key={row} role="row" className="grid grid-cols-7">
					{days.slice(row * 7, row * 7 + 7).map((d, col) => {
						const items = itemsByDate.get(d);
						const minutes = minutesByDate.get(d) ?? 0;
						const inMonth = d.startsWith(month);
						const isToday = d === today;
						const isSel = d === selected;
						const list = [...(items?.events ?? []), ...(items?.tasks ?? [])];
						return (
							<div
								key={d}
								role="gridcell"
								data-date={d}
								tabIndex={d === tabStop ? 0 : -1}
								aria-selected={isSel}
								aria-current={isToday ? 'date' : undefined}
								aria-label={cellLabel(d, today, items, minutes)}
								onClick={() => onSelect(d)}
								onDoubleClick={() => onCreate(d)}
								onKeyDown={(e) => onKeyDown(e, d)}
								className={cn(
									'relative flex min-h-18 min-w-0 cursor-pointer flex-col gap-1 border-line p-1 outline-none transition-colors duration-120 ease-out sm:min-h-28 sm:p-1.5',
									col < 6 && 'border-r',
									row < 5 && 'border-b',
									!inMonth && 'bg-subtle/50',
									isSel ? 'ring-2 ring-accent ring-inset' : 'hover:bg-subtle',
									'focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
								)}
							>
								<span
									aria-hidden
									className={cn(
										'grid size-6 shrink-0 place-items-center self-center rounded-full font-num text-caption tabular-nums sm:self-start',
										isToday ? 'bg-accent font-semibold text-on-accent' : inMonth ? 'text-ink' : 'text-ink-3',
									)}
								>
									{Number(d.slice(8))}
								</span>
								{/* 手機：色點；sm 以上：chip */}
								<span aria-hidden className="flex flex-wrap justify-center gap-0.5 sm:hidden">
									{list.slice(0, 4).map((it) => (
										<span
											key={it.id}
											className={cn('size-1.5 rounded-full', 'status' in it && it.status === 'done' && 'opacity-40')}
											style={{ background: toneOf(it.subjectId).mark }}
										/>
									))}
								</span>
								<span aria-hidden className="hidden min-w-0 flex-col gap-0.5 sm:flex">
									{items?.events.slice(0, 2).map((e) => (
										<EventChip key={e.id} event={e} tone={toneOf(e.subjectId)} showTime={false} />
									))}
									{items?.tasks.slice(0, Math.max(0, 3 - Math.min(2, items.events.length))).map((t) => (
										<TaskChip key={t.id} task={t} mark={toneOf(t.subjectId).mark} />
									))}
									{list.length > 3 && <span className="px-1 text-caption text-ink-3">還有 {list.length - 3} 項</span>}
								</span>
								{minutes >= 1 && (
									<span aria-hidden className="mt-auto self-center font-num text-caption text-ink-2 tabular-nums sm:self-end">
										{Math.round(minutes)}
										<span className="font-sans"> 分</span>
									</span>
								)}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}
