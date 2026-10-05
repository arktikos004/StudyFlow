import { Check, ChevronDown, ListChecks } from 'lucide-react';
import { useId, useState } from 'react';
import type { EventItem, Task, TaskItem } from '../../shared/api-types';
import { useUpdateTask } from '../lib/queries';
import { checklistProgress } from '../lib/task-checklist';
import { spentOf } from '../lib/task-format';
import { descriptionSnippet, searchTerms } from '../lib/task-sort';
import { SubjectTag } from './subjects';
import { ChecklistCount, DueLabel, EventLabel, TaskStatusBadges, TaskTimeLabel } from './tasks/TaskMeta';
import { Checkbox, cn, Highlight } from './ui';

/**
 * 完成任務的圓形勾選框（總覽、月曆、單科總覽、任務頁共用，簽名凍結：只收 task）。
 * - 視覺 22px，點擊範圍 44px。
 * - 儲存中用 aria-disabled（不用 disabled，焦點才不會掉到 body），並忽略點擊。
 * - 送出後到清單更新前先顯示要改成的狀態；資料更新（updatedAt 或狀態改變）或失敗時改回顯示實際狀態。
 */
export function TaskCheckbox({ task }: { task: Task }) {
	const update = useUpdateTask();
	const [pending, setPending] = useState<{ done: boolean; status: Task['status']; updatedAt: number } | null>(null);
	if (pending && (pending.updatedAt !== task.updatedAt || pending.status !== task.status)) setPending(null);
	const done = pending ? pending.done : task.status === 'done';
	const busy = update.isPending || !!pending;
	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={done}
			aria-disabled={busy || undefined}
			aria-label={`完成「${task.title}」`}
			onClick={() => {
				if (busy) return;
				const next = !done;
				setPending({ done: next, status: task.status, updatedAt: task.updatedAt });
				update.mutate({ id: task.id, status: next ? 'done' : 'todo' }, { onError: () => setPending(null) });
			}}
			className="group -m-[11px] grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-none aria-disabled:cursor-progress"
		>
			<span
				aria-hidden
				className={cn(
					'grid size-[22px] place-items-center rounded-full border-2 transition-colors duration-180 ease-out',
					'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
					done ? 'border-success bg-success text-on-accent' : 'border-line-field group-hover:border-accent',
				)}
			>
				{done && <Check className="size-3.5" strokeWidth={3} />}
			</span>
		</button>
	);
}

/**
 * 任務列（任務頁的清單）：勾選框、標題（整格可點，開啟編輯）、meta 與右側 badge。
 * - query：搜尋關鍵字，標題與說明片段用 <mark> 標出；只有說明符合時顯示說明片段。
 * - onToggleItem：給了才可以展開子項目直接勾選（不必打開編輯視窗）。
 */
export function TaskRow({
	task,
	today,
	event,
	onOpen,
	query = '',
	onToggleItem,
}: {
	task: Task | TaskItem;
	today: string;
	event?: EventItem;
	onOpen: () => void;
	query?: string;
	onToggleItem?: (task: Task | TaskItem, itemId: string) => void;
}) {
	const done = task.status === 'done';
	return (
		<div className="flex items-start gap-3 px-4 py-3 sm:px-5">
			<div className="pt-px">
				<TaskCheckbox task={task} />
			</div>
			<div className="relative min-w-0 flex-1">
				<TaskTitleButton title={task.title} query={query} done={done} onOpen={onOpen} />
				<DescriptionSnippet task={task} query={query} />
				<TaskMetaLine task={task} today={today} event={event} onToggleItem={onToggleItem} />
			</div>
			<TaskStatusBadges task={task} />
		</div>
	);
}

/**
 * 任務標題按鈕：::after 撐滿外層（需要 relative 的容器），整格都可以點；
 * 同一格裡的其他按鈕要加 relative 才會疊在上面。焦點框畫在整格外圍。
 */
export function TaskTitleButton({ title, query, done, onOpen }: { title: string; query: string; done: boolean; onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			data-task-title
			className={cn(
				'block w-full text-left text-dense break-words decoration-line-strong underline-offset-4 hover:underline',
				"after:absolute after:-inset-1 after:rounded-md after:content-['']",
				'focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent',
				done ? 'text-ink-3 line-through' : 'text-ink',
			)}
		>
			<Highlight text={title} query={query} />
		</button>
	);
}

/** 搜尋時只有說明符合：在標題下方顯示說明裡符合的片段（用 <mark> 標出），讓人知道為什麼會找到 */
export function DescriptionSnippet({ task, query }: { task: Pick<Task, 'title' | 'description'>; query: string }) {
	const snippet = query ? descriptionSnippet(task, searchTerms(query)) : null;
	if (!snippet) return null;
	return (
		<p className="mt-0.5 line-clamp-2 text-meta break-words text-ink-2">
			<Highlight text={snippet} query={query} />
		</p>
	);
}

/** 標題下方的 meta 列：科目、期限、子項目、投入時間、考試 */
export function TaskMetaLine({
	task,
	today,
	event,
	onToggleItem,
}: {
	task: Task | TaskItem;
	today: string;
	event?: EventItem;
	onToggleItem?: (task: Task | TaskItem, itemId: string) => void;
}) {
	const done = task.status === 'done';
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const expandable = !!onToggleItem && task.checklist.length > 0;
	const { done: checked, total } = checklistProgress(task.checklist);
	return (
		<>
			<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-ink-3">
				<SubjectTag subjectId={task.subjectId} />
				{task.dueDate && <DueLabel dueDate={task.dueDate} today={today} done={done} />}
				{expandable ? (
					<button
						type="button"
						aria-expanded={open}
						aria-controls={panelId}
						onClick={() => setOpen((v) => !v)}
						className={cn(
							'relative inline-flex h-6 items-center gap-1 rounded-sm bg-subtle px-1.5 text-ink-2 transition-colors duration-120 ease-out hover:bg-line hover:text-ink',
							"pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:content-['']",
						)}
					>
						<ListChecks className="size-3.5 shrink-0" aria-hidden />
						<span className="sr-only">子項目，已完成</span>
						<span className="font-num tabular-nums">
							{checked}／{total}
						</span>
						<ChevronDown
							className={cn(
								'size-3.5 shrink-0 transition-transform duration-180 ease-out motion-reduce:transition-none',
								open && 'rotate-180',
							)}
							aria-hidden
						/>
					</button>
				) : (
					<ChecklistCount checklist={task.checklist} />
				)}
				<TaskTimeLabel spent={spentOf(task)} estimate={task.estimatedMinutes} />
				{event && <EventLabel event={event} />}
			</div>
			{expandable && open && (
				<ul id={panelId} aria-label={`「${task.title}」的子項目`} className="relative mt-2 -ml-2.5">
					{task.checklist.map((item) => (
						<li key={item.id}>
							<Checkbox
								checked={item.done}
								onChange={() => onToggleItem(task, item.id)}
								label={<span className={cn('break-words', item.done && 'text-ink-3 line-through')}>{item.title}</span>}
								className="w-full rounded-md px-2.5 hover:bg-subtle"
							/>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
