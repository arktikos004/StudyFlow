import { Camera, CircleAlert, Eye, Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { NoteItem } from '../../../shared/api-types';
import { ATTACHMENT_MAX_PER_NOTE, REVIEW_INTERVALS, noteSchema } from '../../../shared/schemas';
import { compressImage } from '../../lib/image';
import { useCreateNote, useDeleteAttachment, useNote, useUpdateNote, useUploadAttachment, type NoteInput } from '../../lib/queries';
import { SubjectSelect } from '../subjects';
import { Button, Checkbox, cn, Dialog, Field, Input, Segmented, Textarea } from '../ui';
import { MarkdownView, PhotoGrid, ThumbAction } from './content';

/** 選照片：新筆記先暫存在本機，儲存筆記後再上傳 */
function PhotoPicker({ count, onPick, disabled }: { count: number; onPick: (files: File[]) => void; disabled?: boolean }) {
	const input = useRef<HTMLInputElement>(null);
	const remaining = ATTACHMENT_MAX_PER_NOTE - count;
	return (
		<>
			<input
				ref={input}
				type="file"
				accept="image/*"
				multiple
				hidden
				onChange={(e) => {
					onPick(Array.from(e.target.files ?? []).slice(0, remaining));
					e.target.value = '';
				}}
			/>
			<Button size="sm" onClick={() => input.current?.click()} disabled={disabled || remaining <= 0}>
				<Camera className="size-4" aria-hidden />
				加入照片
				<span className="font-num text-ink-3 tabular-nums">
					{count}/{ATTACHMENT_MAX_PER_NOTE}
				</span>
			</Button>
		</>
	);
}

type NoteForm = {
	kind: 'note' | 'mistake';
	title: string;
	subjectId: string | null;
	tags: string;
	content: string;
	question: string;
	wrongAnswer: string;
	correctAnswer: string;
	reason: string;
	scheduleReview: boolean;
};

const emptyForm = (kind: 'note' | 'mistake', subjectId: string | null): NoteForm => ({
	kind,
	title: '',
	subjectId,
	tags: '',
	content: '',
	question: '',
	wrongAnswer: '',
	correctAnswer: '',
	reason: '',
	scheduleReview: kind === 'mistake',
});

const orNull = (v: string) => (v.trim() ? v.trim() : null);

function fromNote(note: NoteItem): NoteForm {
	return {
		kind: note.kind,
		title: note.title,
		subjectId: note.subjectId,
		tags: note.tags.join(', '),
		content: note.content ?? '',
		question: note.question ?? '',
		wrongAnswer: note.wrongAnswer ?? '',
		correctAnswer: note.correctAnswer ?? '',
		reason: note.reason ?? '',
		scheduleReview: !!note.nextReviewDate,
	};
}

const sectionLabel = 'text-sm font-semibold text-ink-2';

// 對話框內容只在打開時掛載：每次打開都是全新的表單狀態
function NoteEditorForm({
	note,
	defaultKind,
	defaultSubjectId,
	onDone,
	setSaving,
}: {
	note?: NoteItem;
	defaultKind: 'note' | 'mistake';
	defaultSubjectId: string | null;
	onDone: () => void;
	setSaving: (v: boolean) => void;
}) {
	const create = useCreateNote();
	const update = useUpdateNote();
	const upload = useUploadAttachment();
	const removeAttachment = useDeleteAttachment();
	// 新增後如果照片上傳失敗，再按一次儲存要更新同一則，不能再新增一則
	const [savedId, setSavedId] = useState(note?.id);
	// 用最新資料顯示已上傳的照片（編輯中刪除照片會立即反映）
	const { data: fresh } = useNote(savedId);
	const [form, setForm] = useState<NoteForm>(() => (note ? fromNote(note) : emptyForm(defaultKind, defaultSubjectId)));
	const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
	const [preview, setPreview] = useState(false);
	const [error, setError] = useState<string>();
	const scheduleHint = useId();
	const contentLabel = useId();

	// 關閉時釋放照片預覽用的暫存網址
	const objectUrls = useRef<string[]>([]);
	useEffect(() => {
		const urls = objectUrls.current;
		return () => urls.forEach((u) => URL.revokeObjectURL(u));
	}, []);

	const set = <K extends keyof NoteForm>(k: K, v: NoteForm[K]) => setForm((f) => ({ ...f, [k]: v }));
	const existing = fresh?.attachments ?? note?.attachments ?? [];

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(undefined);
		const input: NoteInput = {
			kind: form.kind,
			title: form.title,
			subjectId: form.subjectId,
			tags: [
				...new Set(
					form.tags
						.split(/[,，、\s]+/)
						.map((t) => t.trim())
						.filter(Boolean),
				),
			],
			content: orNull(form.content),
			question: form.kind === 'mistake' ? orNull(form.question) : null,
			wrongAnswer: form.kind === 'mistake' ? orNull(form.wrongAnswer) : null,
			correctAnswer: form.kind === 'mistake' ? orNull(form.correctAnswer) : null,
			reason: form.kind === 'mistake' ? orNull(form.reason) : null,
			scheduleReview: form.scheduleReview,
		};
		const parsed = noteSchema.safeParse(input);
		if (!parsed.success) return setError(parsed.error.issues[0].message);

		setSaving(true);
		try {
			let id = savedId;
			if (id) await update.mutateAsync({ id, ...input });
			else {
				id = (await create.mutateAsync(input)).note.id;
				setSavedId(id);
			}
			for (const p of pending) {
				const blob = await compressImage(p.file);
				await upload.mutateAsync({ noteId: id, file: blob });
				URL.revokeObjectURL(p.url);
				setPending((list) => list.filter((x) => x !== p));
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
		<form id="note-form" onSubmit={onSubmit} className="space-y-4" noValidate>
			{!note && (
				<Segmented
					label="類型"
					value={form.kind}
					onChange={(kind) => setForm((f) => ({ ...f, kind, scheduleReview: kind === 'mistake' }))}
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
							maxLength={200}
							autoFocus
						/>
					)}
				</Field>
				<Field label="科目">{(id, aria) => <SubjectSelect id={id} {...aria} value={form.subjectId} onChange={(v) => set('subjectId', v)} />}</Field>
				<Field label="標籤" hint="用逗號或空白分隔，最多 10 個">
					{(id, aria) => <Input id={id} {...aria} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="例如：遞迴, 期中考" />}
				</Field>
			</div>

			{isMistake && (
				<>
					<Field label="題目">
						{(id, aria) => (
							<Textarea
								id={id}
								{...aria}
								value={form.question}
								onChange={(e) => set('question', e.target.value)}
								placeholder="把題目抄下來，或直接拍照上傳"
							/>
						)}
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="我的錯誤答案">
							{(id, aria) => (
								<Textarea id={id} {...aria} className="min-h-20" value={form.wrongAnswer} onChange={(e) => set('wrongAnswer', e.target.value)} />
							)}
						</Field>
						<Field label="正確答案">
							{(id, aria) => (
								<Textarea id={id} {...aria} className="min-h-20" value={form.correctAnswer} onChange={(e) => set('correctAnswer', e.target.value)} />
							)}
						</Field>
					</div>
					<Field label="錯誤原因">
						{(id, aria) => (
							<Textarea
								id={id}
								{...aria}
								className="min-h-20"
								value={form.reason}
								onChange={(e) => set('reason', e.target.value)}
								placeholder="觀念不清？粗心？計算錯誤？寫下來下次才不會再錯"
							/>
						)}
					</Field>
				</>
			)}

			<div>
				<div className="mb-1.5 flex items-center justify-between gap-2">
					<span className={sectionLabel} id={contentLabel}>
						{isMistake ? '補充筆記（選填，支援 Markdown）' : '內容（支援 Markdown）'}
					</span>
					<Button size="sm" variant="ghost" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
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
					<PhotoPicker
						count={existing.length + pending.length}
						onPick={(files) =>
							setPending((p) => [
								...p,
								...files.map((file) => {
									const url = URL.createObjectURL(file);
									objectUrls.current.push(url);
									return { file, url };
								}),
							])
						}
					/>
				</div>
				<PhotoGrid attachments={existing} onDelete={(a) => removeAttachment.mutate(a.id)} />
				{pending.length > 0 && (
					<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
						{pending.map((p, i) => (
							<li key={p.url} className="relative aspect-square">
								<div className="size-full overflow-hidden rounded-lg border border-dashed border-accent">
									<img src={p.url} alt="" className="size-full object-cover" />
								</div>
								<span className="absolute bottom-1 left-1 rounded-sm bg-card/90 px-1.5 text-caption text-ink-2">儲存後上傳</span>
								<ThumbAction
									label={`移除第 ${i + 1} 張待上傳的照片`}
									onClick={() => {
										URL.revokeObjectURL(p.url);
										setPending((list) => list.filter((x) => x !== p));
									}}
								/>
							</li>
						))}
					</ul>
				)}
			</div>

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

			{error && (
				<p className="flex items-start gap-1.5 text-sm text-danger" role="alert">
					<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
					<span>{error}</span>
				</p>
			)}
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
	defaultKind?: 'note' | 'mistake';
	/** 新增時預先選好的科目（例如目前篩選的科目） */
	defaultSubjectId?: string | null;
}) {
	const [saving, setSaving] = useState(false);
	// 新增時可以在表單裡切換錯題／筆記，所以標題不寫死類型
	const title = note ? (note.kind === 'mistake' ? '編輯錯題' : '編輯筆記') : '新增錯題或筆記';
	return (
		<Dialog
			open={open}
			onClose={onClose}
			wide
			title={title}
			footer={
				<>
					<Button onClick={onClose}>取消</Button>
					<Button variant="primary" type="submit" form="note-form" loading={saving}>
						儲存
					</Button>
				</>
			}
		>
			<NoteEditorForm
				key={note?.id ?? defaultKind}
				note={note}
				defaultKind={defaultKind}
				defaultSubjectId={defaultSubjectId}
				onDone={onClose}
				setSaving={setSaving}
			/>
		</Dialog>
	);
}
