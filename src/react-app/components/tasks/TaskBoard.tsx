import {
	DndContext,
	DragOverlay,
	MouseSensor,
	pointerWithin,
	rectIntersection,
	TouchSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type Announcements,
	type CollisionDetection,
	type DragEndEvent,
	type DragStartEvent,
} from '@dnd-kit/core';
import { Check, Circle, CircleCheck, CircleDot, CirclePlay, Undo2, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EventItem, TaskItem } from '../../../shared/api-types';
import { TASK_STATUS_LABEL } from '../../../shared/labels';
import { neighborStatuses, TASK_STATUS_ORDER, type TaskStatus } from '../../lib/task-sort';
import { DescriptionSnippet, TaskCheckbox, TaskMetaLine, TaskTitleButton } from '../TaskItem';
import { Badge, Button, cn, Highlight, ShowAllToggle, usePrefersReducedMotion } from '../ui';
import { TaskStatusBadges } from './TaskMeta';

const COLUMN_ICON: Record<TaskStatus, LucideIcon> = { todo: Circle, doing: CircleDot, done: CircleCheck };

/** 卡片下方的移動按鈕（鍵盤與螢幕報讀器用；和拖曳的結果相同） */
const MOVE: Record<string, { label: string; icon: LucideIcon }> = {
	'todo>doing': { label: '開始進行', icon: CirclePlay },
	'doing>todo': { label: '移回待辦', icon: Undo2 },
	'doing>done': { label: '標為完成', icon: Check },
	'done>doing': { label: '移回進行中', icon: Undo2 },
};

/** 已完成欄一開始只顯示最近的幾項 */
const DONE_LIMIT = 10;

// 指標在欄內就以那一欄為準；指標剛好在兩欄之間時，改用卡片和欄的重疊面積判斷
const collision: CollisionDetection = (args) => {
	const hits = pointerWithin(args);
	return hits.length ? hits : rectIntersection(args);
};

type DragData = { task: TaskItem };

const cardTitle = (id: string) => document.querySelector<HTMLElement>(`[data-task-card="${CSS.escape(id)}"] [data-task-title]`);
const columnOfCard = (id: string) =>
	document.querySelector(`[data-task-card="${CSS.escape(id)}"]`)?.closest<HTMLElement>('[data-board-column]')?.dataset.boardColumn;
/** 焦點掉到 body（原本的按鈕不見了）時，把焦點放到卡片標題；焦點在別處時不搶 */
function focusCardIfLost(id: string) {
	const active = document.activeElement;
	if (active && active !== document.body) return;
	cardTitle(id)?.focus();
}
const taskOf = (data: { current?: unknown } | undefined) => (data?.current as DragData | undefined)?.task;
const isStatus = (id: unknown): id is TaskStatus => TASK_STATUS_ORDER.includes(id as TaskStatus);

/**
 * 看板（TSK-2）：待辦／進行中／已完成三欄。
 * - 滑鼠拖曳（移動 6px 後開始）、觸控長按 0.2 秒後拖曳；放開後由 onMove 樂觀更新，失敗時退回原欄並顯示 toast。
 * - 鍵盤：沿用卡片下方的按鈕，不啟用 dnd-kit 的鍵盤感應器，卡片本身也不是 Tab 停駐點，不會和按鈕打架。
 * - reduced motion：拿掉放開時的歸位動畫，只保留顏色變化。
 */
export function TaskBoard({
	columns,
	today,
	eventMap,
	query,
	onOpen,
	onMove,
}: {
	columns: Record<TaskStatus, TaskItem[]>;
	today: string;
	eventMap: Map<string, EventItem>;
	query: string;
	onOpen: (task: TaskItem) => void;
	/** 移動卡片；onSettled 在儲存完成時呼叫（failed：是否失敗、已退回原欄），用來處理焦點 */
	onMove: (task: TaskItem, to: TaskStatus, onSettled?: (failed: boolean) => void) => void;
}) {
	const reduced = usePrefersReducedMotion();
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
	);
	const [active, setActive] = useState<TaskItem | null>(null);
	// 放到別欄時卡片會直接出現在新的欄，不播放「飛回原位」的動畫
	const [skipDropAnimation, setSkipDropAnimation] = useState(false);
	const [message, setMessage] = useState('');
	// 用按鈕移動的卡片：卡片第一次換到新的欄時處理一次；儲存失敗、退回原欄時再處理一次，之後就清掉。
	// 「處理」是指：原本的按鈕跟著卡片消失、焦點掉到 body 時，把焦點放到這張卡片的標題（焦點在別處時不動）。
	const follow = useRef<{ id: string; from: TaskStatus; to: TaskStatus; moved: boolean; failed: boolean } | null>(null);
	useEffect(() => {
		const f = follow.current;
		if (!f) return;
		const column = columnOfCard(f.id);
		if (!f.moved && column === f.to) {
			follow.current = { ...f, moved: true };
			focusCardIfLost(f.id);
		} else if (f.failed && column === f.from) {
			follow.current = null;
			focusCardIfLost(f.id);
		}
	}, [columns]);

	const moveByButton = (task: TaskItem, to: TaskStatus) => {
		follow.current = { id: task.id, from: task.status, to, moved: false, failed: false };
		setMessage(`已把「${task.title}」移到「${TASK_STATUS_LABEL[to]}」`);
		onMove(task, to, (failed) => {
			const f = follow.current;
			if (f?.id !== task.id) return;
			if (!failed) {
				follow.current = null;
				return;
			}
			// 失敗：等退回原欄的重繪由上面的 effect 處理；那次重繪沒有發生時，這裡補做一次
			follow.current = { ...f, failed: true };
			window.setTimeout(() => {
				if (follow.current?.id !== task.id || !follow.current.failed) return;
				follow.current = null;
				focusCardIfLost(task.id);
			}, 100);
		});
	};

	const onDragStart = ({ active }: DragStartEvent) => {
		setSkipDropAnimation(false);
		setActive(taskOf(active.data) ?? null);
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		const task = taskOf(active.data);
		const to = over?.id;
		setActive(null);
		if (!task || !isStatus(to) || to === task.status) return;
		setSkipDropAnimation(true);
		onMove(task, to);
	};

	const announcements: Announcements = {
		onDragStart: ({ active }) => `已拿起「${taskOf(active.data)?.title ?? ''}」`,
		onDragOver: ({ active, over }) =>
			over && isStatus(over.id) ? `「${taskOf(active.data)?.title ?? ''}」在「${TASK_STATUS_LABEL[over.id]}」欄上方` : '不在任何一欄上方',
		onDragEnd: ({ active, over }) => {
			const task = taskOf(active.data);
			if (!task) return undefined;
			return over && isStatus(over.id) && over.id !== task.status
				? `已把「${task.title}」移到「${TASK_STATUS_LABEL[over.id]}」`
				: `「${task.title}」放回「${TASK_STATUS_LABEL[task.status]}」`;
		},
		onDragCancel: ({ active }) => `已取消移動，「${taskOf(active.data)?.title ?? ''}」放回原處`,
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={collision}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onDragCancel={() => setActive(null)}
			accessibility={{
				announcements,
				screenReaderInstructions: { draggable: '可以用滑鼠拖曳，或長按後拖曳到其他欄；也可以用卡片下方的按鈕移動。' },
			}}
		>
			<p className="mb-3 text-meta text-ink-3">
				<span className="pointer-coarse:hidden">拖曳卡片到其他欄，或用卡片下方的按鈕移動。</span>
				<span className="hidden pointer-coarse:inline">長按卡片後拖曳到其他欄，或用卡片下方的按鈕移動。</span>
			</p>
			<div className="grid items-start gap-4 md:grid-cols-3">
				{TASK_STATUS_ORDER.map((status) => (
					<BoardColumn
						key={status}
						status={status}
						tasks={columns[status]}
						dragging={active}
						today={today}
						eventMap={eventMap}
						query={query}
						onOpen={onOpen}
						onMove={moveByButton}
					/>
				))}
			</div>
			<p role="status" className="sr-only">
				{message}
			</p>
			{createPortal(
				<DragOverlay
					zIndex={60}
					dropAnimation={reduced || skipDropAnimation ? null : { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
				>
					{active && (
						<CardPreview task={active} today={today} event={active.eventId ? eventMap.get(active.eventId) : undefined} query={query} />
					)}
				</DragOverlay>,
				document.body,
			)}
		</DndContext>
	);
}

function BoardColumn({
	status,
	tasks,
	dragging,
	today,
	eventMap,
	query,
	onOpen,
	onMove,
}: {
	status: TaskStatus;
	tasks: TaskItem[];
	dragging: TaskItem | null;
	today: string;
	eventMap: Map<string, EventItem>;
	query: string;
	onOpen: (task: TaskItem) => void;
	onMove: (task: TaskItem, to: TaskStatus) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: status });
	const [showAll, setShowAll] = useState(false);
	const headingId = useId();
	const Icon = COLUMN_ICON[status];
	const target = !!dragging && dragging.status !== status;
	const limited = status === 'done' && !showAll && tasks.length > DONE_LIMIT;
	const shown = limited ? tasks.slice(0, DONE_LIMIT) : tasks;
	return (
		<section
			ref={setNodeRef}
			data-board-column={status}
			aria-labelledby={headingId}
			className={cn(
				'min-w-0 rounded-xl bg-subtle p-2 transition-[background-color,box-shadow] duration-120 ease-out',
				target && isOver && 'bg-accent-soft ring-2 ring-accent ring-inset',
			)}
		>
			<div className="flex min-h-9 items-center justify-between gap-2 px-2 py-1">
				<h2 id={headingId} className="flex items-center gap-2 text-h3 font-semibold">
					<Icon className={cn('size-4 shrink-0', status === 'done' ? 'text-success' : 'text-ink-3')} aria-hidden />
					{TASK_STATUS_LABEL[status]}
					<span className="font-num text-meta font-normal text-ink-3 tabular-nums">
						<span className="sr-only">，</span>
						{tasks.length}
						<span className="sr-only">項</span>
					</span>
				</h2>
				{target && isOver && <Badge tone="accent">放開以移到這裡</Badge>}
			</div>
			<ul className="min-h-24 space-y-2">
				{shown.map((t) => (
					<BoardCard
						key={t.id}
						task={t}
						today={today}
						event={t.eventId ? eventMap.get(t.eventId) : undefined}
						query={query}
						onOpen={() => onOpen(t)}
						onMove={onMove}
					/>
				))}
				{tasks.length === 0 && (
					<li className="px-2 py-8 text-center text-meta text-ink-3">
						{target ? `拖到這裡，改成「${TASK_STATUS_LABEL[status]}」` : '沒有任務'}
					</li>
				)}
			</ul>
			{status === 'done' && (
				<ShowAllToggle expanded={showAll} onToggle={() => setShowAll((v) => !v)} total={tasks.length} limit={DONE_LIMIT} className="mt-2" />
			)}
		</section>
	);
}

function BoardCard({
	task,
	today,
	event,
	query,
	onOpen,
	onMove,
}: {
	task: TaskItem;
	today: string;
	event?: EventItem;
	query: string;
	onOpen: () => void;
	onMove: (task: TaskItem, to: TaskStatus) => void;
}) {
	// 只接上滑鼠與觸控的監聽；不展開 attributes（role="button"、tabIndex），卡片不會變成另一個 Tab 停駐點
	const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id, data: { task } satisfies DragData });
	const { prev, next } = neighborStatuses(task.status);
	const moves = [prev, next].flatMap((to) => (to ? [{ to, ...MOVE[`${task.status}>${to}`] }] : []));
	return (
		<li
			ref={setNodeRef}
			{...listeners}
			data-task-card={task.id}
			className={cn(
				'cursor-grab rounded-xl border border-line bg-card shadow-sm select-none [-webkit-touch-callout:none]',
				isDragging && 'opacity-40',
			)}
		>
			<div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
				<div className="pt-px">
					<TaskCheckbox task={task} />
				</div>
				<div className="relative min-w-0 flex-1">
					<TaskTitleButton title={task.title} query={query} done={task.status === 'done'} onOpen={onOpen} />
					<DescriptionSnippet task={task} query={query} />
					<TaskMetaLine task={task} today={today} event={event} />
				</div>
				<TaskStatusBadges task={task} showDoing={false} />
			</div>
			<div className="flex flex-wrap justify-end gap-1 border-t border-line px-2 py-1.5">
				{moves.map(({ to, label, icon: MoveIcon }) => (
					<Button key={to} size="sm" variant="ghost" aria-label={`${label}「${task.title}」`} onClick={() => onMove(task, to)}>
						<MoveIcon className="size-4" aria-hidden />
						{label}
					</Button>
				))}
			</div>
		</li>
	);
}

/** 拖曳中跟著指標的卡片（純顯示，沒有可以操作的元素） */
function CardPreview({ task, today, event, query }: { task: TaskItem; today: string; event?: EventItem; query: string }) {
	const done = task.status === 'done';
	return (
		<div aria-hidden className="cursor-grabbing rounded-xl border border-line-strong bg-card shadow-lg">
			<div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
				<span
					className={cn(
						'mt-px grid size-[22px] shrink-0 place-items-center rounded-full border-2',
						done ? 'border-success bg-success text-on-accent' : 'border-line-field',
					)}
				>
					{done && <Check className="size-3.5" strokeWidth={3} />}
				</span>
				<div className="min-w-0 flex-1">
					<p className={cn('text-dense wrap-anywhere', done ? 'text-ink-3 line-through' : 'text-ink')}>
						<Highlight text={task.title} query={query} />
					</p>
					<TaskMetaLine task={task} today={today} event={event} />
				</div>
				<TaskStatusBadges task={task} showDoing={false} />
			</div>
		</div>
	);
}
