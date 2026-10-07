import { TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { ChecklistItem, EventItem, Task, TaskItem } from '../../../shared/api-types';
import { today } from '../../../shared/dates';
import { taskSchema } from '../../../shared/schemas';
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from '../../../shared/labels';
import { useCreateTask, useDeleteTask, useEvents, useUpdateTask, useUser, type TaskInput } from '../../lib/queries';
import { formatTaskTime, spentOf } from '../../lib/task-format';
import { SubjectSelect } from '../subjects';
import { ChecklistEditor } from '../tasks/ChecklistEditor';
import { Dialog, Field, Input, Select, Textarea, useConfirm } from '../ui';
import { DialogFooter, FormError } from './shared';

const blankToNull = (v: string) => (v.trim() === '' ? null : v);

/**
 * 任務連結的考試要另外列出的選項文字：連結的考試不在「今天以後」的清單裡，就是已經結束；
 * 清單還沒載入時先標「載入中」，不要誤標成已結束。在清單裡（或沒有連結）時不用另外列。
 */
function linkedEventLabel(eventId: string | null | undefined, upcoming: readonly EventItem[] | undefined): string | null {
	if (!eventId) return null;
	if (!upcoming) return '載入中…';
	return upcoming.some((e) => e.id === eventId) ? null : '（已結束的考試）';
}

export type TaskDefaults = Partial<Pick<TaskInput, 'dueDate' | 'eventId' | 'subjectId'>>;

type Confirm = ReturnType<typeof useConfirm>[0];

/** 預估時間欄位下方的提示：已投入多少；超過預估時加上警示圖示與文字（TSK-4） */
function SpentHint({ spent, estimate }: { spent: number; estimate: number | null }) {
	const time = formatTaskTime(spent, estimate);
	if (!time.spentText) return null;
	if (!time.over) return <>{time.spentText}</>;
	return (
		<span className="inline-flex items-start gap-1 font-semibold text-warning">
			<TriangleAlert className="mt-[3px] size-3.5 shrink-0" aria-hidden />
			{time.spentText}，超過預估 {time.overText}
		</span>
	);
}

function TaskForm({
	task,
	defaults,
	onSave,
	confirm,
}: {
	task?: Task | TaskItem;
	defaults?: TaskDefaults;
	onSave: (input: TaskInput) => Promise<void>;
	confirm: Confirm;
}) {
	const user = useUser();
	const { data: loadedEvents } = useEvents({ from: today(user.timezone) });
	const events = loadedEvents ?? [];
	const [error, setError] = useState<string>();
	const [form, setForm] = useState({
		title: task?.title ?? '',
		description: task?.description ?? '',
		dueDate: task?.dueDate ?? defaults?.dueDate ?? '',
		priority: task?.priority ?? ('medium' as NonNullable<TaskInput['priority']>),
		status: task?.status ?? ('todo' as NonNullable<TaskInput['status']>),
		estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : '',
		subjectId: task?.subjectId ?? defaults?.subjectId ?? null,
		eventId: task?.eventId ?? defaults?.eventId ?? null,
		checklist: task?.checklist ?? ([] as ChecklistItem[]),
	});
	const spent = task ? spentOf(task) : 0;

	// 選了考試就自動帶入該考試的科目
	const pickEvent = (eventId: string | null) => {
		const ev = events.find((x) => x.id === eventId);
		setForm((f) => ({ ...f, eventId, subjectId: f.subjectId ?? ev?.subjectId ?? null }));
	};

	const submit = (values: typeof form) => {
		const input: TaskInput = {
			...values,
			description: blankToNull(values.description),
			dueDate: blankToNull(values.dueDate),
			estimatedMinutes: values.estimatedMinutes ? Number(values.estimatedMinutes) : null,
		};
		const parsed = taskSchema.safeParse(input);
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		setError(undefined);
		onSave(input);
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		submit(form);
	};

	// 子項目全部勾完：詢問要不要一併完成任務（不會自動完成）；確定後改成已完成並儲存
	const onAllDone = async (checklist: ChecklistItem[]) => {
		if (form.status === 'done') return;
		const ok = await confirm({
			title: '要一併完成任務嗎？',
			message: '子項目都勾完了。選「完成任務」會把狀態改成已完成，並儲存這個任務。',
			confirmText: '完成任務',
			tone: 'primary',
		});
		if (!ok) return;
		const next = { ...form, checklist, status: 'done' as const };
		setForm(next);
		submit(next);
	};

	// 編輯舊任務時，連結的考試可能已經結束（不在「即將到來」清單中）
	const linkedLabel = linkedEventLabel(task?.eventId, loadedEvents);

	return (
		<form id="task-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4" noValidate>
			<Field label="任務名稱" className="col-span-2">
				{(id) => (
					<Input
						id={id}
						value={form.title}
						onChange={(e) => setForm({ ...form, title: e.target.value })}
						placeholder="例如：複習第 3 章、寫完 HW2"
						maxLength={200}
						autoFocus
					/>
				)}
			</Field>
			<Field label="科目">
				{(id) => <SubjectSelect id={id} value={form.subjectId} onChange={(subjectId) => setForm({ ...form, subjectId })} />}
			</Field>
			<Field label="期限（選填）">
				{(id) => <Input id={id} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />}
			</Field>
			<Field label="優先度">
				{(id) => (
					<Select id={id} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}>
						{(['high', 'medium', 'low'] as const).map((p) => (
							<option key={p} value={p}>
								{TASK_PRIORITY_LABEL[p]}
							</option>
						))}
					</Select>
				)}
			</Field>
			<Field label="狀態">
				{(id) => (
					<Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}>
						{(['todo', 'doing', 'done'] as const).map((s) => (
							<option key={s} value={s}>
								{TASK_STATUS_LABEL[s]}
							</option>
						))}
					</Select>
				)}
			</Field>
			<Field
				label="預估時間（分鐘）"
				hint={spent > 0 ? <SpentHint spent={spent} estimate={Number(form.estimatedMinutes) || null} /> : undefined}
			>
				{(id) => (
					<Input
						id={id}
						type="number"
						inputMode="numeric"
						min={1}
						max={1440}
						value={form.estimatedMinutes}
						onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
						placeholder="例如：60"
					/>
				)}
			</Field>
			<Field label="為了哪場考試／截止日">
				{(id) => (
					<Select id={id} value={form.eventId ?? ''} onChange={(e) => pickEvent(e.target.value || null)}>
						<option value="">不連結</option>
						{linkedLabel && <option value={task?.eventId ?? ''}>{linkedLabel}</option>}
						{events.map((ev) => (
							<option key={ev.id} value={ev.id}>
								{ev.date.slice(5).replace('-', '/')} {ev.title}
							</option>
						))}
					</Select>
				)}
			</Field>
			<ChecklistEditor items={form.checklist} onChange={(checklist) => setForm((f) => ({ ...f, checklist }))} onAllDone={onAllDone} />
			<Field label="說明（選填）" className="col-span-2">
				{(id) => (
					<Textarea id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={5000} />
				)}
			</Field>
			<FormError error={error} />
		</form>
	);
}

export function TaskDialog({
	open,
	onClose,
	task,
	defaults,
}: {
	open: boolean;
	onClose: () => void;
	/** 傳入 TaskItem（帶 spentMinutes）時，預估時間下方會顯示已投入的時間 */
	task?: Task;
	defaults?: TaskDefaults;
}) {
	const create = useCreateTask();
	const update = useUpdateTask();
	const remove = useDeleteTask();
	const [confirm, confirmDialog] = useConfirm();

	const onSave = async (input: TaskInput) => {
		try {
			if (task) await update.mutateAsync({ id: task.id, ...input });
			else await create.mutateAsync(input);
			onClose();
		} catch {
			// 錯誤訊息已由 toast 顯示
		}
	};

	const onDelete = async () => {
		if (!task) return;
		if (!(await confirm({ title: `刪除「${task.title}」？` }))) return;
		try {
			await remove.mutateAsync(task.id);
			onClose();
		} catch {
			// toast 已顯示錯誤；對話框留著，可以再試一次
		}
	};

	return (
		<>
			<Dialog
				open={open}
				onClose={onClose}
				title={task ? '編輯任務' : '新增學習任務'}
				footer={
					<DialogFooter formId="task-form" onClose={onClose} onDelete={task && onDelete} saving={create.isPending || update.isPending} />
				}
			>
				<TaskForm key={task?.id ?? 'new'} task={task} defaults={defaults} onSave={onSave} confirm={confirm} />
			</Dialog>
			{confirmDialog}
		</>
	);
}
