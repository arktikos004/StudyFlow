import { useState, type FormEvent } from 'react';
import type { EventItem } from '../../../shared/api-types';
import { today } from '../../../shared/dates';
import { eventSchema } from '../../../shared/schemas';
import { EVENT_KIND_LABEL } from '../../../shared/labels';
import { useCreateEvent, useDeleteEvent, useUpdateEvent, useUser, type EventInput } from '../../lib/queries';
import { SubjectSelect } from '../subjects';
import { Dialog, Field, Input, Select, Textarea, useConfirm } from '../ui';
import { DialogFooter, FormError } from './shared';

const blankToNull = (v: string) => (v.trim() === '' ? null : v);

/** 新增時的預設值（編輯既有考試時不使用）；例如單科頁、考試頁篩選某一科時預先選好科目 */
export type EventDefaults = { subjectId?: string | null };

function EventForm({
	event,
	defaultDate,
	defaults,
	onSave,
}: {
	event?: EventItem;
	defaultDate?: string;
	defaults?: EventDefaults;
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
		subjectId: event ? event.subjectId : (defaults?.subjectId ?? null),
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
	defaults,
}: {
	open: boolean;
	onClose: () => void;
	event?: EventItem;
	defaultDate?: string;
	/** 選填，只影響新增：例如 { subjectId } 預先選好科目 */
	defaults?: EventDefaults;
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
				title={event ? '編輯考試或截止日' : '新增考試或截止日'}
				footer={
					<DialogFooter formId="event-form" onClose={onClose} onDelete={event && onDelete} saving={create.isPending || update.isPending} />
				}
			>
				<EventForm
					key={`${event?.id ?? defaultDate ?? 'new'}|${defaults?.subjectId ?? ''}`}
					event={event}
					defaultDate={defaultDate}
					defaults={defaults}
					onSave={onSave}
				/>
			</Dialog>
			{confirmDialog}
		</>
	);
}
