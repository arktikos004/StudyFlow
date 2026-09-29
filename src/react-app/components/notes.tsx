import { Brain, Camera, CheckCircle2, Eye, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { NoteItem, PublicAttachment } from '../../shared/api-types';
import { ATTACHMENT_MAX_PER_NOTE, noteSchema } from '../../shared/schemas';
import { attachmentUrl } from '../lib/api';
import { formatDate } from '../lib/format';
import { compressImage } from '../lib/image';
import {
	useCreateNote,
	useDeleteAttachment,
	useDeleteNote,
	useNote,
	useUpdateNote,
	useUploadAttachment,
	type NoteInput,
} from '../lib/queries';
import { SubjectSelect, SubjectTag } from './subjects';
import { Badge, Button, cn, Dialog, Field, Input, Segmented, Textarea, useConfirm } from './ui';

export function MarkdownView({ children }: { children: string }) {
	// react-markdown 預設不渲染原始 HTML，可避免 XSS
	return (
		<div className="prose-note text-[15px]">
			<Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
		</div>
	);
}

// ---- 照片 ----

function Lightbox({ attachment, onClose }: { attachment: PublicAttachment | null; onClose: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		if (attachment && !ref.current?.open) ref.current?.showModal();
		if (!attachment && ref.current?.open) ref.current.close();
	}, [attachment]);
	return (
		<dialog
			ref={ref}
			onClose={onClose}
			onClick={onClose}
			className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/85"
			aria-label="檢視照片"
		>
			{attachment && (
				<div className="relative">
					<img src={attachmentUrl(attachment.id)} alt="" className="max-h-[92dvh] max-w-[96vw] rounded-lg object-contain" />
					<button className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-black/60 text-white" aria-label="關閉">
						<X className="size-5" />
					</button>
				</div>
			)}
		</dialog>
	);
}

export function PhotoGrid({ attachments, onDelete }: { attachments: PublicAttachment[]; onDelete?: (a: PublicAttachment) => void }) {
	const [viewing, setViewing] = useState<PublicAttachment | null>(null);
	if (!attachments.length) return null;
	return (
		<>
			<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
				{attachments.map((a) => (
					<div key={a.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-subtle">
						<button className="size-full" onClick={() => setViewing(a)} aria-label="放大檢視照片">
							<img src={attachmentUrl(a.id)} alt="" loading="lazy" className="size-full object-cover" />
						</button>
						{onDelete && (
							<button
								onClick={() => onDelete(a)}
								className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
								aria-label="刪除照片"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
				))}
			</div>
			<Lightbox attachment={viewing} onClose={() => setViewing(null)} />
		</>
	);
}

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
				<span className="text-ink-3">
					{count}/{ATTACHMENT_MAX_PER_NOTE}
				</span>
			</Button>
		</>
	);
}

// ---- 新增 / 編輯 ----

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

const emptyForm = (kind: 'note' | 'mistake'): NoteForm => ({
	kind,
	title: '',
	subjectId: null,
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

// 對話框內容只在打開時掛載：每次打開都是全新的表單狀態
function NoteEditorForm({
	note,
	defaultKind,
	onDone,
	setSaving,
}: {
	note?: NoteItem;
	defaultKind: 'note' | 'mistake';
	onDone: () => void;
	setSaving: (v: boolean) => void;
}) {
	const create = useCreateNote();
	const update = useUpdateNote();
	const upload = useUploadAttachment();
	const removeAttachment = useDeleteAttachment();
	// 用最新資料顯示已上傳的照片（編輯中刪除照片會立即反映）
	const { data: fresh } = useNote(note?.id);
	const [form, setForm] = useState<NoteForm>(() => (note ? fromNote(note) : emptyForm(defaultKind)));
	const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
	const [preview, setPreview] = useState(false);
	const [error, setError] = useState<string>();

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
			const saved = note ? (await update.mutateAsync({ id: note.id, ...input })).note : (await create.mutateAsync(input)).note;
			for (const p of pending) {
				const blob = await compressImage(p.file);
				await upload.mutateAsync({ noteId: saved.id, file: blob });
			}
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : '儲存失敗');
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
					{(id) => (
						<Input
							id={id}
							value={form.title}
							onChange={(e) => set('title', e.target.value)}
							placeholder={isMistake ? '例如：期中考第 5 題 遞迴式求解' : '例如：第 3 章 排程演算法重點'}
							maxLength={200}
							autoFocus
						/>
					)}
				</Field>
				<Field label="科目">{(id) => <SubjectSelect id={id} value={form.subjectId} onChange={(v) => set('subjectId', v)} />}</Field>
				<Field label="標籤（以逗號分隔）">
					{(id) => <Input id={id} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="例如：遞迴, 期中考" />}
				</Field>
			</div>

			{isMistake && (
				<>
					<Field label="題目">
						{(id) => (
							<Textarea
								id={id}
								value={form.question}
								onChange={(e) => set('question', e.target.value)}
								placeholder="把題目抄下來，或直接拍照上傳"
							/>
						)}
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="我的錯誤答案">
							{(id) => (
								<Textarea id={id} className="min-h-20" value={form.wrongAnswer} onChange={(e) => set('wrongAnswer', e.target.value)} />
							)}
						</Field>
						<Field label="正確答案">
							{(id) => (
								<Textarea id={id} className="min-h-20" value={form.correctAnswer} onChange={(e) => set('correctAnswer', e.target.value)} />
							)}
						</Field>
					</div>
					<Field label="錯誤原因">
						{(id) => (
							<Textarea
								id={id}
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
				<div className="mb-1.5 flex items-center justify-between">
					<span className="text-sm font-medium text-ink-2">{isMistake ? '補充筆記（選填，支援 Markdown）' : '內容（支援 Markdown）'}</span>
					<button type="button" className="inline-flex items-center gap-1 text-sm text-accent-ink" onClick={() => setPreview((p) => !p)}>
						{preview ? <Pencil className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
						{preview ? '編輯' : '預覽'}
					</button>
				</div>
				{preview ? (
					<div className="min-h-32 rounded-lg border border-line p-3">
						{form.content ? <MarkdownView>{form.content}</MarkdownView> : <p className="text-sm text-ink-3">（沒有內容）</p>}
					</div>
				) : (
					<Textarea
						aria-label="內容"
						className={cn('font-mono text-sm', isMistake ? 'min-h-24' : 'min-h-56')}
						value={form.content}
						onChange={(e) => set('content', e.target.value)}
						placeholder={'# 標題\n- 重點一\n- 重點二\n\n**粗體**、`程式碼`'}
					/>
				)}
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-ink-2">照片</span>
					<PhotoPicker
						count={existing.length + pending.length}
						onPick={(files) => setPending((p) => [...p, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))])}
					/>
				</div>
				<PhotoGrid attachments={existing} onDelete={(a) => removeAttachment.mutate(a.id)} />
				{pending.length > 0 && (
					<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
						{pending.map((p, i) => (
							<div key={p.url} className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-accent">
								<img src={p.url} alt="" className="size-full object-cover" />
								<span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px] text-white">儲存後上傳</span>
								<button
									type="button"
									onClick={() => {
										URL.revokeObjectURL(p.url);
										setPending((list) => list.filter((_, j) => j !== i));
									}}
									className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
									aria-label="移除"
								>
									<X className="size-4" />
								</button>
							</div>
						))}
					</div>
				)}
			</div>

			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					className="size-4 accent-[var(--accent)]"
					checked={form.scheduleReview}
					onChange={(e) => set('scheduleReview', e.target.checked)}
				/>
				加入複習排程（間隔 1、3、7、14、30 天提醒複習）
			</label>

			{error && (
				<p className="text-sm text-danger" role="alert">
					{error}
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
}: {
	open: boolean;
	onClose: () => void;
	note?: NoteItem;
	defaultKind?: 'note' | 'mistake';
}) {
	const [saving, setSaving] = useState(false);
	return (
		<Dialog
			open={open}
			onClose={onClose}
			wide
			title={note ? '編輯' : '新增錯題／筆記'}
			footer={
				<>
					<Button onClick={onClose}>取消</Button>
					<Button variant="primary" type="submit" form="note-form" loading={saving}>
						儲存
					</Button>
				</>
			}
		>
			<NoteEditorForm key={note?.id ?? defaultKind} note={note} defaultKind={defaultKind} onDone={onClose} setSaving={setSaving} />
		</Dialog>
	);
}

// ---- 詳細內容 ----

export function MistakeBody({ note, revealAnswer = true }: { note: NoteItem; revealAnswer?: boolean }) {
	const block = (label: string, text: string | null, tone?: 'danger' | 'success') =>
		text && (
			<div>
				<div
					className={cn(
						'mb-1 text-xs font-semibold',
						tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-ink-3',
					)}
				>
					{label}
				</div>
				<p className="text-[15px] leading-relaxed whitespace-pre-wrap">{text}</p>
			</div>
		);
	return (
		<div className="space-y-4">
			{block('題目', note.question)}
			<PhotoGrid attachments={note.attachments} />
			{revealAnswer && (
				<>
					{block('我的錯誤答案', note.wrongAnswer, 'danger')}
					{block('正確答案', note.correctAnswer, 'success')}
					{block('錯誤原因', note.reason)}
					{note.content && (
						<div>
							<div className="mb-1 text-xs font-semibold text-ink-3">補充筆記</div>
							<MarkdownView>{note.content}</MarkdownView>
						</div>
					)}
				</>
			)}
		</div>
	);
}

export function NoteDetail({
	note,
	onClose,
	onEdit,
	today,
}: {
	note: NoteItem | null;
	onClose: () => void;
	onEdit: (n: NoteItem) => void;
	today: string;
}) {
	const update = useUpdateNote();
	const remove = useDeleteNote();
	const [confirm, confirmDialog] = useConfirm();

	return (
		<>
			<Dialog
				open={!!note}
				onClose={onClose}
				wide
				title={note?.kind === 'mistake' ? '錯題' : '筆記'}
				footer={
					note && (
						<>
							<Button
								variant="ghost"
								className="mr-auto text-danger hover:text-danger"
								onClick={async () => {
									if (await confirm({ title: `刪除「${note.title}」？`, message: '照片也會一併刪除，無法復原。' })) {
										await remove.mutateAsync(note.id).catch(() => {});
										onClose();
									}
								}}
							>
								<Trash2 className="size-4" aria-hidden />
								刪除
							</Button>
							<Button
								onClick={() => update.mutate({ id: note.id, mastered: !note.mastered })}
								loading={update.isPending}
								className="hidden sm:inline-flex"
							>
								{note.mastered ? <RotateCcw className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
								{note.mastered ? '重新複習' : '已掌握'}
							</Button>
							<Button variant="primary" onClick={() => onEdit(note)}>
								<Pencil className="size-4" aria-hidden />
								編輯
							</Button>
						</>
					)
				}
			>
				{note && (
					<article>
						<div className="mb-2 flex flex-wrap items-center gap-2">
							<SubjectTag subjectId={note.subjectId} />
							{note.mastered && <Badge tone="success">已掌握</Badge>}
							{!note.mastered && note.nextReviewDate && (
								<Badge tone={note.nextReviewDate <= today ? 'warning' : 'neutral'}>
									<Brain className="size-3" aria-hidden />
									{note.nextReviewDate <= today ? '今天要複習' : `${formatDate(note.nextReviewDate)} 複習`}
								</Badge>
							)}
							{note.tags.map((t) => (
								<Badge key={t}>#{t}</Badge>
							))}
						</div>
						<h3 className="mb-4 text-xl font-semibold break-words">{note.title}</h3>
						{note.kind === 'mistake' ? (
							<MistakeBody note={note} />
						) : (
							<div className="space-y-4">
								{note.content ? <MarkdownView>{note.content}</MarkdownView> : <p className="text-sm text-ink-3">（沒有內容）</p>}
								<PhotoGrid attachments={note.attachments} />
							</div>
						)}
						<Button
							size="sm"
							className="mt-6 sm:hidden"
							onClick={() => update.mutate({ id: note.id, mastered: !note.mastered })}
							loading={update.isPending}
						>
							{note.mastered ? '重新複習' : '標為已掌握'}
						</Button>
					</article>
				)}
			</Dialog>
			{confirmDialog}
		</>
	);
}
