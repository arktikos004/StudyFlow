import { Eye, Pencil } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import type { NoteItem } from '../../../shared/api-types';
import { NOTE_TAGS_MAX, NOTE_TITLE_MAX, noteSchema, noteUpdateSchema, REVIEW_INTERVALS } from '../../../shared/schemas';
import { useUser } from '../../lib/account-queries';
import { compressImage } from '../../lib/attachment-image';
import { fromIntervalChoice, masteredReviewLabel, toIntervalChoice } from '../../lib/mastered-review';
import { defaultScheduleReview, emptyNoteForm, formToNoteInput, noteEditorTitle, noteToForm, type NoteForm } from '../../lib/notes-form';
import { usePendingPhotos } from '../../lib/pending-photos';
import { useCreateNote, useDeleteAttachment, useNote, useUpdateNote, useUploadAttachment } from '../../lib/queries';
import { DialogFooter } from '../forms/shared';
import { MasteredReviewField } from '../MasteredReviewField';
import { SubjectSelect } from '../subjects';
import { Button, Checkbox, cn, Dialog, Field, InlineError, Input, Segmented, Textarea, useConfirm, type ConfirmOptions } from '../ui';
import { MarkdownView, PhotoGrid } from './content';
import { PendingPhotoGrid, PhotoPicker } from './photos';

type NoteKind = NoteItem['kind'];

/** 單則筆記的「已掌握後的複習」：跟隨設定（null）、不提醒（0），或每 N 天 */
const MASTERED_SPECIAL = { follow: null, none: 0 };
const masteredDaysSchema = noteUpdateSchema.pick({ masteredReviewDays: true });

/** 錯題的題目、答案與原因：標籤加多行文字框 */
function TextareaField({
	label,
	value,
	onChange,
	placeholder,
	className,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}) {
	return (
		<Field label={label}>
			{(id, aria) => (
				<Textarea
					id={id}
					{...aria}
					className={className}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
				/>
			)}
		</Field>
	);
}

const sectionLabel = 'text-sm font-semibold text-ink-2';

// 對話框內容只在打開時掛載：每次打開都是全新的表單狀態
function NoteEditorForm({
	formId,
	note,
	defaultKind,
	defaultSubjectId,
	onDone,
	setSaving,
	confirm,
}: {
	formId: string;
	note?: NoteItem;
	defaultKind: NoteKind;
	defaultSubjectId: string | null;
	onDone: () => void;
	setSaving: (v: boolean) => void;
	/** 刪除已上傳的照片前確認（對話框由 NoteEditor 渲染在編輯視窗外層） */
	confirm: (opts: ConfirmOptions) => Promise<boolean>;
}) {
	const create = useCreateNote();
	const update = useUpdateNote();
	const upload = useUploadAttachment();
	const removeAttachment = useDeleteAttachment();
	// 新增後如果照片上傳失敗，再按一次儲存要更新同一則，不能再新增一則
	const [savedId, setSavedId] = useState(note?.id);
	// 用最新資料顯示已上傳的照片（編輯中刪除照片會立即反映）
	const { data: fresh } = useNote(savedId);
	const [form, setForm] = useState<NoteForm>(() => (note ? noteToForm(note) : emptyNoteForm(defaultKind, defaultSubjectId)));
	const photos = usePendingPhotos();
	const [preview, setPreview] = useState(false);
	const [error, setError] = useState<string>();
	const user = useUser();
	const [masteredReview, setMasteredReview] = useState(() => toIntervalChoice(note?.masteredReviewDays ?? null, MASTERED_SPECIAL));
	const [masteredReviewError, setMasteredReviewError] = useState<string>();
	const scheduleHint = useId();
	const contentLabel = useId();

	const set = <K extends keyof NoteForm>(k: K, v: NoteForm[K]) => setForm((f) => ({ ...f, [k]: v }));
	const existing = fresh?.attachments ?? note?.attachments ?? [];

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(undefined);
		const input = formToNoteInput(form);
		const parsed = noteSchema.safeParse(input);
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		// 已掌握的題目：一併送出「已掌握後的複習」（後端只在值變了時重新排程）
		let masteredExtra = {};
		if (note?.mastered) {
			const days = masteredDaysSchema.safeParse({ masteredReviewDays: fromIntervalChoice(masteredReview, MASTERED_SPECIAL) });
			if (!days.success) return setMasteredReviewError(days.error.issues[0].message);
			masteredExtra = { masteredReviewDays: days.data.masteredReviewDays };
		}

		setSaving(true);
		try {
			let id = savedId;
			if (id) await update.mutateAsync({ id, ...input, ...masteredExtra });
			else {
				id = (await create.mutateAsync(input)).note.id;
				setSavedId(id);
			}
			for (const photo of photos.pending) {
				const blob = await compressImage(photo.file);
				await upload.mutateAsync({ noteId: id, file: blob });
				photos.remove(photo);
			}
			onDone();
		} catch (err) {
			setError(err instanceof Error ? `儲存沒有完成：${err.message}` : '儲存沒有完成，請再按一次「儲存」');
		} finally {
			setSaving(false);
		}
	};

	const isMistake = form.kind === 'mistake';

	return (
		<form id={formId} onSubmit={onSubmit} className="space-y-4" noValidate>
			{/* 新增後（例如照片上傳失敗再按儲存）會改走更新，更新不能改類型：已經存過就不能再切換 */}
			{!note && !savedId && (
				<Segmented
					label="類型"
					value={form.kind}
					onChange={(kind) => setForm((f) => ({ ...f, kind, scheduleReview: defaultScheduleReview(kind) }))}
					options={[
						{ value: 'mistake', label: '錯題' },
						{ value: 'note', label: '筆記' },
					]}
				/>
			)}
			<div className="grid gap-4 sm:grid-cols-2">
				<Field label="標題" className="sm:col-span-2">
					{(id, aria) => (
						<Input
							id={id}
							{...aria}
							value={form.title}
							onChange={(e) => set('title', e.target.value)}
							placeholder={isMistake ? '例如：期中考第 5 題 遞迴式求解' : '例如：第 3 章 排程演算法重點'}
							maxLength={NOTE_TITLE_MAX}
							autoFocus
						/>
					)}
				</Field>
				<Field label="科目">
					{(id, aria) => <SubjectSelect id={id} {...aria} value={form.subjectId} onChange={(v) => set('subjectId', v)} />}
				</Field>
				<Field label="標籤" hint={`用逗號或空白分隔，最多 ${NOTE_TAGS_MAX} 個`}>
					{(id, aria) => (
						<Input id={id} {...aria} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="例如：遞迴, 期中考" />
					)}
				</Field>
			</div>

			{isMistake && (
				<>
					<TextareaField
						label="題目"
						value={form.question}
						onChange={(v) => set('question', v)}
						placeholder="把題目抄下來，或直接拍照上傳"
					/>
					<div className="grid gap-4 sm:grid-cols-2">
						<TextareaField label="我的錯誤答案" className="min-h-20" value={form.wrongAnswer} onChange={(v) => set('wrongAnswer', v)} />
						<TextareaField label="正確答案" className="min-h-20" value={form.correctAnswer} onChange={(v) => set('correctAnswer', v)} />
					</div>
					<TextareaField
						label="錯誤原因"
						className="min-h-20"
						value={form.reason}
						onChange={(v) => set('reason', v)}
						placeholder="觀念不清？粗心？計算錯誤？寫下來下次才不會再錯"
					/>
				</>
			)}

			<div>
				<div className="mb-1.5 flex items-center justify-between gap-2">
					<span className={sectionLabel} id={contentLabel}>
						{isMistake ? '補充筆記（選填，支援 Markdown）' : '內容（支援 Markdown）'}
					</span>
					<Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
						{preview ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
						{preview ? '回到編輯' : '預覽'}
					</Button>
				</div>
				{preview ? (
					<div className="min-h-32 rounded-lg border border-line p-3">
						{form.content ? <MarkdownView>{form.content}</MarkdownView> : <p className="text-sm text-ink-3">還沒有內容</p>}
					</div>
				) : (
					<Textarea
						aria-labelledby={contentLabel}
						className={cn('font-mono text-sm', isMistake ? 'min-h-24' : 'min-h-56')}
						value={form.content}
						onChange={(e) => set('content', e.target.value)}
						placeholder={'# 標題\n- 重點一\n- 重點二\n\n**粗體**、`程式碼`'}
					/>
				)}
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<span className={sectionLabel}>照片</span>
					<PhotoPicker count={existing.length + photos.pending.length} onPick={photos.add} />
				</div>
				<PhotoGrid
					attachments={existing}
					onDelete={async (a) => {
						// 已上傳的照片一刪就真的刪掉，和下面「儲存後上傳」的暫存照片不同，按「取消」關閉編輯視窗也不會回來
						const ok = await confirm({
							title: `刪除第 ${existing.indexOf(a) + 1} 張照片？`,
							message: '照片會馬上刪除、無法復原，就算之後不儲存這次的修改也一樣。',
							confirmText: '刪除照片',
						});
						if (ok) removeAttachment.mutate(a.id);
					}}
				/>
				<PendingPhotoGrid photos={photos.pending} onRemove={photos.remove} />
			</div>

			{note?.mastered ? (
				// 已掌握的題目不看「加入複習排程」，改成選要不要定期複習、幾天一次
				<MasteredReviewField
					label="已掌握後的複習"
					hint="想要久久再複習一次就選天數；跟隨設定時用設定頁「錯題複習」的預設。"
					specialOptions={[
						{ key: 'follow', label: `跟隨設定（${masteredReviewLabel(user.masteredReviewDays)}）` },
						{ key: 'none', label: '不提醒' },
					]}
					value={masteredReview}
					onChange={(next) => {
						setMasteredReview(next);
						setMasteredReviewError(undefined);
					}}
					error={masteredReviewError}
				/>
			) : (
				<div>
					<Checkbox
						checked={form.scheduleReview}
						onChange={(v) => set('scheduleReview', v)}
						label="加入複習排程"
						aria-describedby={scheduleHint}
					/>
					<p id={scheduleHint} className="-mt-1 pl-[1.875rem] text-meta text-ink-3">
						第 {REVIEW_INTERVALS.join('、')} 天提醒你複習，全部記住就算掌握
					</p>
				</div>
			)}

			{error && <InlineError size="md">{error}</InlineError>}
		</form>
	);
}

export function NoteEditor({
	open,
	onClose,
	note,
	defaultKind = 'mistake',
	defaultSubjectId = null,
}: {
	open: boolean;
	onClose: () => void;
	note?: NoteItem;
	defaultKind?: NoteKind;
	/** 新增時預先選好的科目（例如目前篩選的科目） */
	defaultSubjectId?: string | null;
}) {
	const [saving, setSaving] = useState(false);
	const [confirm, confirmDialog] = useConfirm();
	const formId = useId();
	return (
		<>
			<Dialog
				open={open}
				onClose={onClose}
				wide
				title={noteEditorTitle(note)}
				footer={<DialogFooter formId={formId} saving={saving} onClose={onClose} />}
			>
				<NoteEditorForm
					key={note?.id ?? defaultKind}
					formId={formId}
					note={note}
					defaultKind={defaultKind}
					defaultSubjectId={defaultSubjectId}
					onDone={onClose}
					setSaving={setSaving}
					confirm={confirm}
				/>
			</Dialog>
			{confirmDialog}
		</>
	);
}
