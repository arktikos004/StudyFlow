import { useState, type FormEvent } from 'react';
import type { StudySession } from '../../shared/api-types';
import { zonedTime } from '../../shared/dates';
import { formatDate, formatMinutes, MODE_LABEL } from '../lib/format';
import { useCreateSession, useDeleteSession, useTasks, useUpdateSession, useUser } from '../lib/queries';
import { FUTURE_TOLERANCE_MS } from '../lib/timer-core';
import { deviceTimeZone, formatClockRange, relativeDateLabel, zonedParts } from '../lib/timer-format';
import { DialogFooter } from './forms';
import { SubjectSelect } from './subjects';
import { Dialog, Field, Input, Select, useConfirm } from './ui';

// 編輯學習紀錄與手動補登共用（TMR-2）。日期與時間一律依 user.timezone 顯示與換算，不用裝置時區。

const FORM_ID = 'session-form';
/** 和後端規則一致：單次學習不可超過 24 小時 */
const MAX_MINUTES = 24 * 60;

type FormState = { date: string; start: string; minutes: string; subjectId: string | null; taskId: string; note: string };
type FieldErrors = Partial<Record<'date' | 'start' | 'minutes', string>>;
type Times = { startedAt: number; endedAt: number; durationSec: number };
type Values = { times: Times | null; subjectId: string | null; taskId: string | null; note: string | null };

function initialForm(timeZone: string, session?: StudySession, defaultDate?: string, defaultStart?: string): FormState {
	const blank = { subjectId: null, taskId: '', note: '' };
	if (session) {
		const { date, time } = zonedParts(session.startedAt, timeZone);
		return {
			date,
			start: time,
			minutes: String(Math.max(1, Math.round(session.durationSec / 60))),
			subjectId: session.subjectId,
			taskId: session.taskId ?? '',
			note: session.note ?? '',
		};
	}
	// 補登：預設一小時前開始（取整到 5 分鐘）、讀 60 分鐘；指定了其他日期時從 09:00 開始
	const hourAgo = zonedParts(Math.floor((Date.now() - 3_600_000) / 300_000) * 300_000, timeZone);
	if (defaultDate && defaultDate !== hourAgo.date && !defaultStart) return { date: defaultDate, start: '09:00', minutes: '60', ...blank };
	return { date: defaultDate ?? hourAgo.date, start: defaultStart ?? hourAgo.time, minutes: '60', ...blank };
}

/** 結束時間：和開始同一天只顯示時間，跨到隔天時加上「隔天」 */
function endLabel(endedAt: number, startDate: string, timeZone: string) {
	const end = zonedParts(endedAt, timeZone);
	return end.date === startDate ? end.time : `隔天 ${end.time}`;
}

/** 表單換算成起訖時間；欄位不完整時回傳 errors */
function toTimes(form: FormState, timeZone: string): { errors: FieldErrors; times?: Times } {
	const errors: FieldErrors = {};
	if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = '請選擇日期';
	if (!/^\d{2}:\d{2}$/.test(form.start)) errors.start = '請輸入開始時間';
	const text = form.minutes.trim();
	const minutes = Number(text);
	if (text === '') errors.minutes = `請輸入讀了幾分鐘（1–${MAX_MINUTES} 分鐘）`;
	else if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES)
		errors.minutes = `時長要介於 1–${MAX_MINUTES} 分鐘（最多 24 小時），請輸入整數`;
	if (errors.date || errors.start || errors.minutes) return { errors };
	const startedAt = zonedTime(form.date, form.start, timeZone);
	return { errors, times: { startedAt, endedAt: startedAt + minutes * 60_000, durationSec: minutes * 60 } };
}

function SessionForm({
	session,
	defaultDate,
	defaultStart,
	onSubmit,
}: {
	session?: StudySession;
	defaultDate?: string;
	defaultStart?: string;
	onSubmit: (values: Values) => void;
}) {
	const user = useUser();
	const tz = user.timezone;
	const { data: tasks = [] } = useTasks();
	const [init] = useState(() => initialForm(tz, session, defaultDate, defaultStart));
	const [form, setForm] = useState(init);
	/** 第一次送出的時間：之後邊改邊檢查（「晚於現在」以送出時為準） */
	const [checkedAt, setCheckedAt] = useState<number | null>(null);

	const timeChanged = !session || form.date !== init.date || form.start !== init.start || form.minutes !== init.minutes;
	const { errors: fieldErrors, times } = toTimes(form, tz);
	const futureError = (at: number | null) => {
		if (!times || at === null || times.endedAt <= at + FUTURE_TOLERANCE_MS) return undefined;
		const end = zonedParts(times.endedAt, tz);
		return `結束時間（${relativeDateLabel(end.date, zonedParts(at, tz).date)} ${end.time}）晚於現在，請提早開始時間或縮短時長`;
	};
	const errors: FieldErrors =
		checkedAt !== null && timeChanged ? { ...fieldErrors, minutes: fieldErrors.minutes ?? futureError(checkedAt) } : {};

	// 結束時間提示：沒改時間時顯示原本的（可能中間暫停過）
	let endHint: string | undefined;
	if (session && !timeChanged) {
		const paused = session.endedAt - session.startedAt > session.durationSec * 1000 + 60_000;
		endHint = `結束於 ${endLabel(session.endedAt, init.date, tz)}${paused ? `，中間暫停過，實際專注 ${formatMinutes(session.durationSec / 60)}` : ''}`;
	} else if (times) {
		endHint = `結束於 ${endLabel(times.endedAt, form.date, tz)}`;
	}

	const taskOptions = tasks.filter(
		(t) => t.id === form.taskId || (t.status !== 'done' && (!form.subjectId || t.subjectId === form.subjectId)),
	);
	const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

	const submit = (e: FormEvent) => {
		e.preventDefault();
		const at = Date.now();
		setCheckedAt(at);
		if (timeChanged && (!times || times.endedAt > at + FUTURE_TOLERANCE_MS)) return;
		onSubmit({
			times: timeChanged ? times! : null,
			subjectId: form.subjectId,
			taskId: form.taskId || null,
			note: form.note.trim() || null,
		});
	};

	return (
		<form id={FORM_ID} onSubmit={submit} className="grid grid-cols-2 gap-4" noValidate>
			{session && (
				<p className="col-span-2 text-meta text-ink-3">
					{MODE_LABEL[session.mode]}的紀錄，原本是 {formatDate(init.date)} {formatClockRange(session.startedAt, session.endedAt, tz)}
				</p>
			)}
			<Field label="日期" error={errors.date}>
				{(id, aria) => <Input id={id} {...aria} type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} autoFocus />}
			</Field>
			<Field label="開始時間" error={errors.start} hint={deviceTimeZone() !== tz ? `依設定的時區（${tz}）` : undefined}>
				{(id, aria) => <Input id={id} {...aria} type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} />}
			</Field>
			<Field label="讀了幾分鐘" error={errors.minutes} hint={endHint} className="col-span-2 sm:col-span-1">
				{(id, aria) => (
					<Input
						id={id}
						{...aria}
						type="number"
						inputMode="numeric"
						min={1}
						max={MAX_MINUTES}
						step={1}
						value={form.minutes}
						onChange={(e) => set({ minutes: e.target.value })}
					/>
				)}
			</Field>
			<Field label="科目" className="col-span-2 sm:col-span-1">
				{(id) => (
					<SubjectSelect
						id={id}
						value={form.subjectId}
						onChange={(subjectId) => {
							// 換科目時，原本的任務屬於別科就一起清掉
							const task = tasks.find((t) => t.id === form.taskId);
							set({ subjectId, taskId: task && subjectId && task.subjectId !== subjectId ? '' : form.taskId });
						}}
					/>
				)}
			</Field>
			<Field label="相關任務（選填）" className="col-span-2">
				{(id, aria) => (
					<Select id={id} {...aria} value={form.taskId} onChange={(e) => set({ taskId: e.target.value })}>
						<option value="">不指定</option>
						{taskOptions.map((t) => (
							<option key={t.id} value={t.id}>
								{t.title}
								{t.status === 'done' ? '（已完成）' : ''}
							</option>
						))}
					</Select>
				)}
			</Field>
			<Field label="備註（選填）" className="col-span-2">
				{(id, aria) => (
					<Input
						id={id}
						{...aria}
						value={form.note}
						onChange={(e) => set({ note: e.target.value })}
						maxLength={500}
						placeholder="例如：在圖書館讀第 5 章"
					/>
				)}
			</Field>
		</form>
	);
}

/**
 * 學習紀錄對話框。
 * - 有 session：編輯（useUpdateSession）；沒改時間時只送科目、任務、備註，原本的起訖與秒數不變。
 * - 沒有 session：手動補登（useCreateSession，mode 'manual'）；defaultDate／defaultStart 是預設的日期與開始時間。
 */
export function SessionDialog({
	open,
	onClose,
	session,
	defaultDate,
	defaultStart,
}: {
	open: boolean;
	onClose: () => void;
	session?: StudySession;
	defaultDate?: string;
	defaultStart?: string;
}) {
	const create = useCreateSession();
	const update = useUpdateSession();
	const remove = useDeleteSession();
	const [confirm, confirmDialog] = useConfirm();

	const save = async ({ times, ...rest }: Values) => {
		try {
			if (session) await update.mutateAsync({ id: session.id, ...rest, ...(times ?? {}) });
			else if (times) await create.mutateAsync({ mode: 'manual', ...times, ...rest });
			onClose();
		} catch {
			// 錯誤訊息已由 toast 顯示，保留表單讓使用者修改
		}
	};

	const onDelete = async () => {
		if (!session) return;
		if (!(await confirm({ title: '刪除這筆學習紀錄？', message: '刪除後無法復原，任務投入時間與統計會一起更新。' }))) return;
		try {
			await remove.mutateAsync(session.id);
			onClose();
		} catch {
			// toast 已顯示錯誤
		}
	};

	return (
		<>
			<Dialog
				open={open}
				onClose={onClose}
				title={session ? '編輯學習紀錄' : '補登學習時間'}
				footer={
					<DialogFooter
						formId={FORM_ID}
						onClose={onClose}
						onDelete={session ? onDelete : undefined}
						saving={create.isPending || update.isPending}
					/>
				}
			>
				<SessionForm
					key={session?.id ?? `${defaultDate ?? ''}|${defaultStart ?? ''}`}
					session={session}
					defaultDate={defaultDate}
					defaultStart={defaultStart}
					onSubmit={save}
				/>
			</Dialog>
			{confirmDialog}
		</>
	);
}
