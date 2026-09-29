import { useState, type FormEvent } from 'react';
import type { Task } from '../../../shared/api-types';
import { today } from '../../../shared/dates';
import { taskSchema } from '../../../shared/schemas';
import { PRIORITY_LABEL, STATUS_LABEL } from '../../lib/format';
import { useCreateTask, useDeleteTask, useEvents, useUpdateTask, useUser, type TaskInput } from '../../lib/queries';
import { SubjectSelect } from '../subjects';
import { Dialog, Field, Input, Select, Textarea, useConfirm } from '../ui';
import { DialogFooter, FormError } from './shared';

const blankToNull = (v: string) => (v.trim() === '' ? null : v);

export type TaskDefaults = Partial<Pick<TaskInput, 'dueDate' | 'eventId' | 'subjectId'>>;

function TaskForm({ task, defaults, onSave }: { task?: Task; defaults?: TaskDefaults; onSave: (input: TaskInput) => Promise<void> }) {
	const user = useUser();
	const { data: events = [] } = useEvents({ from: today(user.timezone) });
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
	});

	// 選了考試就自動帶入該考試的科目
	const pickEvent = (eventId: string | null) => {
		const ev = events.find((x) => x.id === eventId);
		setForm((f) => ({ ...f, eventId, subjectId: f.subjectId ?? ev?.subjectId ?? null }));
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const input: TaskInput = {
			...form,
			description: blankToNull(form.description),
			dueDate: blankToNull(form.dueDate),
			estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
		};
		const parsed = taskSchema.safeParse(input);
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		onSave(input);
	};

	// 編輯舊任務時，連結的考試可能已經結束（不在「即將到來」清單中）
	const pastEventId = task?.eventId && !events.some((e) => e.id === task.eventId) ? task.eventId : null;

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
								{PRIORITY_LABEL[p]}
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
								{STATUS_LABEL[s]}
							</option>
						))}
					</Select>
				)}
			</Field>
			<Field label="預估時間（分鐘）">
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
						{pastEventId && <option value={pastEventId}>（已結束的考試）</option>}
						{events.map((ev) => (
							<option key={ev.id} value={ev.id}>
								{ev.date.slice(5).replace('-', '/')} {ev.title}
							</option>
						))}
					</Select>
				)}
			</Field>
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
		await remove.mutateAsync(task.id).catch(() => {});
		onClose();
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
				<TaskForm key={task?.id ?? 'new'} task={task} defaults={defaults} onSave={onSave} />
			</Dialog>
			{confirmDialog}
		</>
	);
}
