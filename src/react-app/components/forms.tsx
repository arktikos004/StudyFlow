import { useState, type FormEvent } from 'react';
import type { EventItem, Task } from '../../shared/api-types';
import { today } from '../../shared/dates';
import { eventSchema, taskSchema } from '../../shared/schemas';
import { EVENT_KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import {
	useCreateEvent,
	useCreateTask,
	useDeleteEvent,
	useDeleteTask,
	useEvents,
	useUpdateEvent,
	useUpdateTask,
	useUser,
	type EventInput,
	type TaskInput,
} from '../lib/queries';
import { SubjectSelect } from './subjects';
import { Button, Dialog, Field, Input, Select, Textarea, useConfirm } from './ui';

// 對話框的內容只在打開時才掛載，所以表單狀態每次打開都會用最新的初始值建立，不需要另外重設。

const blankToNull = (v: string) => (v.trim() === '' ? null : v);

function FormError({ error }: { error?: string }) {
	return error ? (
		<p className="col-span-2 text-sm text-danger" role="alert">
			{error}
		</p>
	) : null;
}

export function DialogFooter({
	formId,
	onClose,
	onDelete,
	saving,
}: {
	formId: string;
	onClose: () => void;
	onDelete?: () => void;
	saving: boolean;
}) {
	return (
		<>
			{onDelete && (
				<Button variant="ghost" className="mr-auto text-danger hover:text-danger" onClick={onDelete}>
					刪除
				</Button>
			)}
			<Button onClick={onClose}>取消</Button>
			<Button variant="primary" type="submit" form={formId} loading={saving}>
				儲存
			</Button>
		</>
	);
}

// ---- 考試 / 截止日 ----

function EventForm({
	event,
	defaultDate,
	onSave,
}: {
	event?: EventItem;
	defaultDate?: string;
	onSave: (input: EventInput) => Promise<void>;
}) {
	const user = useUser();
	const [error, setError] = useState<string>();
	const [form, setForm] = useState({
		kind: event?.kind ?? ('exam' as EventInput['kind']),
		title: event?.title ?? '',
		date: event?.date ?? defaultDate ?? today(user.timezone),
		time: event?.time ?? '',
		location: event?.location ?? '',
		notes: event?.notes ?? '',
		subjectId: event?.subjectId ?? null,
	});

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const input = { ...form, time: blankToNull(form.time), location: blankToNull(form.location), notes: blankToNull(form.notes) };
		const parsed = eventSchema.safeParse(input);
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		onSave(input);
	};

	return (
		<form id="event-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4" noValidate>
			<Field label="類型" className="col-span-2 sm:col-span-1">
				{(id) => (
					<Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventInput['kind'] })}>
						{Object.entries(EVENT_KIND_LABEL).map(([v, l]) => (
							<option key={v} value={v}>
								{l}
							</option>
						))}
					</Select>
				)}
			</Field>
			<Field label="科目" className="col-span-2 sm:col-span-1">
				{(id) => <SubjectSelect id={id} value={form.subjectId} onChange={(subjectId) => setForm({ ...form, subjectId })} />}
			</Field>
			<Field label="標題" className="col-span-2">
				{(id) => (
					<Input
						id={id}
						value={form.title}
						onChange={(e) => setForm({ ...form, title: e.target.value })}
						placeholder={form.kind === 'exam' ? '例如：資料結構期中考' : '例如：作業系統 HW3 繳交'}
						maxLength={100}
						autoFocus
					/>
				)}
			</Field>
			<Field label="日期">
				{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
			</Field>
			<Field label="時間（選填）">
				{(id) => <Input id={id} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />}
			</Field>
			<Field label="地點（選填）" className="col-span-2">
				{(id) => (
					<Input
						id={id}
						value={form.location}
						onChange={(e) => setForm({ ...form, location: e.target.value })}
						placeholder="例如：工學院 E101"
						maxLength={100}
					/>
				)}
			</Field>
			<Field label="備註（選填）" className="col-span-2">
				{(id) => (
					<Textarea
						id={id}
						value={form.notes}
						onChange={(e) => setForm({ ...form, notes: e.target.value })}
						placeholder="考試範圍、注意事項…"
						maxLength={2000}
					/>
				)}
			</Field>
			<FormError error={error} />
		</form>
	);
}

export function EventDialog({
	open,
	onClose,
	event,
	defaultDate,
}: {
	open: boolean;
	onClose: () => void;
	event?: EventItem;
	defaultDate?: string;
}) {
	const create = useCreateEvent();
	const update = useUpdateEvent();
	const remove = useDeleteEvent();
	const [confirm, confirmDialog] = useConfirm();

	const onSave = async (input: EventInput) => {
		try {
			if (event) await update.mutateAsync({ id: event.id, ...input });
			else await create.mutateAsync(input);
			onClose();
		} catch {
			// 錯誤訊息已由 toast 顯示，保留表單讓使用者修改
		}
	};

	const onDelete = async () => {
		if (!event) return;
		const ok = await confirm({ title: `刪除「${event.title}」？`, message: '相關任務會保留，只是不再連結到這場考試。' });
		if (!ok) return;
		await remove.mutateAsync(event.id).catch(() => {});
		onClose();
	};

	return (
		<>
			<Dialog
				open={open}
				onClose={onClose}
				title={event ? '編輯考試／截止日' : '新增考試／截止日'}
				footer={
					<DialogFooter formId="event-form" onClose={onClose} onDelete={event && onDelete} saving={create.isPending || update.isPending} />
				}
			>
				<EventForm key={event?.id ?? defaultDate ?? 'new'} event={event} defaultDate={defaultDate} onSave={onSave} />
			</Dialog>
			{confirmDialog}
		</>
	);
}

// ---- 學習任務 ----

type TaskDefaults = Partial<Pick<TaskInput, 'dueDate' | 'eventId' | 'subjectId'>>;

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
