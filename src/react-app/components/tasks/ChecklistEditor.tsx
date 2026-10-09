import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ChecklistItem } from '../../../shared/api-types';
import {
	addChecklistItem,
	CHECKLIST_ITEM_MAX,
	CHECKLIST_MAX_ITEMS,
	checklistInputError,
	checklistProgress,
	justCompleted,
	moveChecklistItem,
	newChecklistId,
	removeChecklistItem,
	toggleChecklistItem,
} from '../../lib/task-checklist';
import { Button, Checkbox, cn, InlineError, Input } from '../ui';

type FocusTarget = { id: string; action: 'up' | 'down' | 'remove' } | 'input';

/**
 * 子任務清單的編輯器（TSK-1，放在任務對話框裡，跟著表單一起儲存）：
 * 新增、勾選、刪除、上移／下移。最多 30 項、每項 100 字，超過時顯示錯誤、不會加進清單。
 * - Enter 新增（注音選字時的 Enter 不算），不會送出整個表單。
 * - 上移／下移到頭尾時按鈕改成 aria-disabled，焦點留在原處；移動或刪除後焦點跟著項目走。
 * - onAllDone：這次勾選讓全部項目都勾完時呼叫（用來詢問要不要一併完成任務，不會自動完成）。
 */
export function ChecklistEditor({
	items,
	onChange,
	onAllDone,
}: {
	items: ChecklistItem[];
	onChange: (items: ChecklistItem[]) => void;
	onAllDone?: (items: ChecklistItem[]) => void;
}) {
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | null>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const focusAfter = useRef<FocusTarget | null>(null);
	const inputId = useId();
	const noteId = useId();
	const { done, total } = checklistProgress(items);
	const length = draft.trim().length;
	const full = items.length >= CHECKLIST_MAX_ITEMS;
	// 字數超過時立刻提示；其他錯誤（空白、已滿）按下新增時才顯示
	const liveError = length > CHECKLIST_ITEM_MAX ? checklistInputError([], draft) : null;
	const shownError = liveError ?? error;

	// 移動或刪除之後，把焦點放回同一個項目的同一個按鈕（或下一個項目、輸入框）
	useLayoutEffect(() => {
		const target = focusAfter.current;
		if (!target) return;
		focusAfter.current = null;
		if (target === 'input') inputRef.current?.focus();
		else listRef.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(target.id)}"] [data-action="${target.action}"]`)?.focus();
	}, [items]);

	const add = () => {
		const message = checklistInputError(items, draft);
		if (message) {
			setError(message);
			inputRef.current?.focus();
			return;
		}
		onChange(addChecklistItem(items, draft, newChecklistId()));
		setDraft('');
		setError(null);
	};

	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
		e.preventDefault();
		add();
	};

	const toggle = (id: string) => {
		const next = toggleChecklistItem(items, id);
		onChange(next);
		if (justCompleted(items, next)) onAllDone?.(next);
	};

	const move = (id: string, index: number, delta: -1 | 1) => {
		const to = index + delta;
		if (to < 0 || to >= items.length) return;
		focusAfter.current = { id, action: delta < 0 ? 'up' : 'down' };
		onChange(moveChecklistItem(items, id, delta));
	};

	const remove = (id: string, index: number) => {
		const neighbor = items[index + 1] ?? items[index - 1];
		focusAfter.current = neighbor ? { id: neighbor.id, action: 'remove' } : 'input';
		onChange(removeChecklistItem(items, id));
		setError(null);
	};

	const canMove = items.length > 1;

	return (
		<fieldset className="col-span-2 min-w-0" aria-describedby={shownError || full ? noteId : undefined}>
			<legend className="flex w-full items-baseline justify-between gap-2 text-sm font-semibold text-ink-2">
				<span>子項目（選填）</span>
				{total > 0 && (
					<span className="font-num text-meta font-normal text-ink-3 tabular-nums">
						<span className="sr-only">已完成</span>
						{done}／{total}
					</span>
				)}
			</legend>

			{items.length > 0 && (
				<ul ref={listRef} className="mt-1.5 divide-y divide-line rounded-lg border border-line">
					{items.map((item, i) => (
						<li key={item.id} data-item={item.id} className="flex items-center gap-0.5 pr-1 pl-2.5">
							<Checkbox
								checked={item.done}
								onChange={() => toggle(item.id)}
								label={<span className={cn('wrap-anywhere', item.done && 'text-ink-3 line-through')}>{item.title}</span>}
								className="min-w-0 flex-1 py-1"
							/>
							{canMove && (
								<>
									<IconAction
										action="up"
										label={`上移「${item.title}」`}
										disabled={i === 0}
										onClick={() => move(item.id, i, -1)}
										icon={<ChevronUp className="size-[18px]" />}
									/>
									<IconAction
										action="down"
										label={`下移「${item.title}」`}
										disabled={i === items.length - 1}
										onClick={() => move(item.id, i, 1)}
										icon={<ChevronDown className="size-[18px]" />}
									/>
								</>
							)}
							<IconAction
								action="remove"
								label={`刪除「${item.title}」`}
								onClick={() => remove(item.id, i)}
								icon={<X className="size-[18px]" />}
							/>
						</li>
					))}
				</ul>
			)}

			<div className="mt-2 flex items-start gap-2">
				<div className="relative min-w-0 flex-1">
					<label htmlFor={inputId} className="sr-only">
						新增子項目
					</label>
					<Input
						ref={inputRef}
						id={inputId}
						value={draft}
						onChange={(e) => {
							setDraft(e.target.value);
							if (error) setError(null);
						}}
						onKeyDown={onKeyDown}
						placeholder={items.length ? '再加一項' : '例如：讀完第 3 章、做完練習題'}
						enterKeyHint="enter"
						aria-invalid={shownError ? true : undefined}
						aria-describedby={shownError || full || length > 0 ? noteId : undefined}
						className={cn(length > 0 && 'pr-20')}
					/>
					{length > 0 && (
						<span
							aria-hidden
							className={cn(
								'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-num text-caption tabular-nums',
								length > CHECKLIST_ITEM_MAX ? 'font-semibold text-danger' : 'text-ink-3',
							)}
						>
							{length}／{CHECKLIST_ITEM_MAX}
						</span>
					)}
				</div>
				<Button onClick={add}>
					<Plus className="size-4" aria-hidden />
					新增
				</Button>
			</div>
			{shownError ? (
				<InlineError id={noteId} className="mt-1.5">
					{shownError}
				</InlineError>
			) : (
				(full || length > 0) && (
					<p id={noteId} className="mt-1.5 text-meta text-ink-3">
						{full
							? `已有 ${CHECKLIST_MAX_ITEMS} 項，達到上限；要新增請先刪除用不到的項目`
							: `按 Enter 新增，每項最多 ${CHECKLIST_ITEM_MAX} 個字`}
					</p>
				)
			)}
		</fieldset>
	);
}

/** 項目右側的圖示按鈕。到頭尾時用 aria-disabled（焦點不會掉），按了沒有作用 */
function IconAction({
	action,
	label,
	icon,
	disabled = false,
	onClick,
}: {
	action: 'up' | 'down' | 'remove';
	label: string;
	icon: ReactNode;
	disabled?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			data-action={action}
			aria-label={label}
			aria-disabled={disabled || undefined}
			onClick={() => {
				if (!disabled) onClick();
			}}
			className="text-ink-3 hover:text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
		>
			{icon}
		</Button>
	);
}
