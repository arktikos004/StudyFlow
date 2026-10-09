import { Brain, CircleCheck, CircleX, FileQuestionMark, Lightbulb, NotebookText, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { NoteItem, PublicAttachment } from '../../../shared/api-types';
import { attachmentUrl } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Badge, MiniIconButton, SectionLabel, type IconProp } from '../ui';

// 筆記與錯題的內容區塊：Markdown、照片、錯題的題目與答案、類型與複習狀態的 badge。

export function MarkdownView({ children }: { children: string }) {
	// react-markdown 預設不渲染原始 HTML，可避免 XSS
	return (
		<div className="prose-note text-dense">
			<Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
		</div>
	);
}

// ---- 類型與狀態 ----

/** 錯題／筆記：中性色加圖示（DESIGN.md：紅色不用來標記內容類型） */
export function KindBadge({ kind }: { kind: NoteItem['kind'] }) {
	return kind === 'mistake' ? (
		<Badge icon={<FileQuestionMark aria-hidden />}>錯題</Badge>
	) : (
		<Badge icon={<NotebookText aria-hidden />}>筆記</Badge>
	);
}

/**
 * 複習狀態：已掌握（success）、今天以前到期（warning「待複習」）；
 * detailed 時另外顯示之後的複習日（neutral）。圖示加文字，不只靠顏色。
 */
export function ReviewBadge({ note, today, detailed = false }: { note: NoteItem; today: string; detailed?: boolean }) {
	// 到期就是待複習：包括選擇定期複習、到期的已掌握題目
	if (note.nextReviewDate && note.nextReviewDate <= today)
		return (
			<Badge tone="warning" icon={<Brain aria-hidden />}>
				待複習
			</Badge>
		);
	if (note.mastered) {
		const next = detailed && note.nextReviewDate ? `・${formatDate(note.nextReviewDate)} 複習` : '';
		return (
			<Badge tone="success" icon={<CircleCheck aria-hidden />}>
				已掌握{next}
			</Badge>
		);
	}
	if (!note.nextReviewDate || !detailed) return null;
	return <Badge icon={<Brain aria-hidden />}>{formatDate(note.nextReviewDate)} 複習</Badge>;
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
			className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-scrim"
			aria-label="檢視照片"
		>
			{attachment && (
				<div className="relative">
					<img src={attachmentUrl(attachment.id)} alt="" className="max-h-[92dvh] max-w-[96vw] rounded-lg object-contain" />
					<button
						type="button"
						className="absolute top-2 right-2 grid size-11 place-items-center rounded-full border border-line bg-card text-ink shadow-md"
						aria-label="關閉照片"
					>
						<X className="size-5" aria-hidden />
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
			<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
				{attachments.map((a, i) => (
					<li key={a.id} className="relative aspect-square">
						<button
							type="button"
							className="block size-full overflow-hidden rounded-lg border border-line bg-subtle"
							onClick={() => setViewing(a)}
							aria-label={`放大第 ${i + 1} 張照片`}
						>
							<img src={attachmentUrl(a.id)} alt="" loading="lazy" className="size-full object-cover" />
						</button>
						{onDelete && <MiniIconButton label={`刪除第 ${i + 1} 張照片`} onClick={() => onDelete(a)} className="absolute top-1 right-1" />}
					</li>
				))}
			</ul>
			<Lightbox attachment={viewing} onClose={() => setViewing(null)} />
		</>
	);
}

// ---- 錯題的題目與答案 ----

/** 欄位小標（SectionLabel，h3）＋內容 */
function Block({ icon, label, children }: { icon: IconProp; label: string; children: ReactNode }) {
	return (
		<section>
			<SectionLabel as="h3" icon={icon} className="mb-1">
				{label}
			</SectionLabel>
			{children}
		</section>
	);
}

const text = (t: string) => <p className="leading-relaxed wrap-anywhere whitespace-pre-wrap">{t}</p>;

/** 錯題的題目（文字與照片）；沒有題目文字時只顯示照片 */
export function MistakeQuestion({ note }: { note: NoteItem }) {
	if (!note.question && !note.attachments.length) return null;
	return (
		<div className="space-y-3">
			{note.question && (
				<Block icon={FileQuestionMark} label="題目">
					{text(note.question)}
				</Block>
			)}
			<PhotoGrid attachments={note.attachments} />
		</div>
	);
}

/** 錯題的答案：我的錯誤答案、正確答案、錯誤原因、補充筆記。標籤用中性色加圖示，不用紅色標記內容類型。 */
export function MistakeAnswer({ note }: { note: NoteItem }) {
	const empty = !note.wrongAnswer && !note.correctAnswer && !note.reason && !note.content;
	if (empty) return <p className="text-sm text-ink-3">還沒有填寫答案。按「編輯」可以補上正確答案與錯誤原因。</p>;
	return (
		<div className="space-y-4">
			{note.wrongAnswer && (
				<Block icon={CircleX} label="我的錯誤答案">
					{text(note.wrongAnswer)}
				</Block>
			)}
			{note.correctAnswer && (
				<Block icon={<CircleCheck className="text-success" aria-hidden />} label="正確答案">
					{text(note.correctAnswer)}
				</Block>
			)}
			{note.reason && (
				<Block icon={Lightbulb} label="錯誤原因">
					{text(note.reason)}
				</Block>
			)}
			{note.content && (
				<Block icon={NotebookText} label="補充筆記">
					<MarkdownView>{note.content}</MarkdownView>
				</Block>
			)}
		</div>
	);
}

/** 一般筆記的內容（Markdown 與照片） */
export function NoteBody({ note }: { note: NoteItem }) {
	return (
		<div className="space-y-4">
			{note.content ? <MarkdownView>{note.content}</MarkdownView> : <p className="text-sm text-ink-3">這則筆記還沒有內容。</p>}
			<PhotoGrid attachments={note.attachments} />
		</div>
	);
}
