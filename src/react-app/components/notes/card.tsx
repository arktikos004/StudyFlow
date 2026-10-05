import { Hash, Image as ImageIcon } from 'lucide-react';
import type { NoteItem } from '../../../shared/api-types';
import { attachmentUrl } from '../../lib/api';
import { dayLabel, noteSnippet } from '../../lib/notes-format';
import { SubjectTag } from '../subjects';
import { Card, Highlight } from '../ui';
import { KindBadge, ReviewBadge } from './content';
import { PinToggle } from './pin';

/**
 * 筆記卡：整張可點（標題按鈕用 ::after 蓋滿卡片），釘選與標籤按鈕浮在上面。
 * - 搜尋中：標題與摘要用 <mark> 標出關鍵字；摘要會從含關鍵字的地方開始。
 * - 狀態一律圖示加文字（錯題／筆記、待複習、已掌握），科目只透過 SubjectTag 顯示。
 */
export function NoteCard({
	note,
	today,
	timeZone,
	query,
	pinBusy,
	onOpen,
	onPin,
	onTag,
}: {
	note: NoteItem;
	today: string;
	timeZone: string;
	/** 搜尋關鍵字（和後端一樣整串比對，不拆字） */
	query: string;
	pinBusy: boolean;
	onOpen: () => void;
	onPin: () => void;
	onTag: (tag: string) => void;
}) {
	const cover = note.attachments[0];
	const snippet = noteSnippet(note, query);
	const terms = query ? [query] : [];
	return (
		<Card as="article" interactive className="relative flex h-full flex-col overflow-hidden">
			{cover && (
				<div className="relative h-32 shrink-0 border-b border-line bg-subtle">
					<img src={attachmentUrl(cover.id)} alt="" loading="lazy" className="size-full object-cover" />
					{note.attachments.length > 1 && (
						<span className="absolute right-2 bottom-2 inline-flex h-5 items-center gap-1 rounded-sm bg-card/90 px-1.5 font-num text-caption text-ink-2 tabular-nums shadow-sm">
							<ImageIcon className="size-3" aria-hidden />
							{note.attachments.length}
							<span className="sr-only">張照片</span>
						</span>
					)}
				</div>
			)}
			<div className="flex flex-1 flex-col p-4">
				<div className="flex items-start gap-2">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-2 pointer-coarse:pt-3">
						<KindBadge kind={note.kind} />
						<ReviewBadge note={note} today={today} />
					</div>
					<PinToggle
						noteId={note.id}
						pinned={note.pinned}
						title={note.title}
						busy={pinBusy}
						onToggle={onPin}
						className="relative z-10 -mt-1 -mr-2"
					/>
				</div>
				<h3 className="mt-2 text-h3 font-semibold break-words text-ink">
					<button
						type="button"
						onClick={onOpen}
						className="block w-full text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
					>
						<span className="line-clamp-2">
							<Highlight text={note.title} query={terms} />
						</span>
					</button>
				</h3>
				{snippet && (
					<p className="mt-1 line-clamp-3 text-meta break-words text-ink-2">
						<Highlight text={snippet} query={terms} />
					</p>
				)}
				<div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-3">
					<SubjectTag subjectId={note.subjectId} />
					<span className="ml-auto text-meta text-ink-3">更新於 {dayLabel(note.updatedAt, timeZone, today)}</span>
				</div>
				{note.tags.length > 0 && (
					<ul className="relative z-10 mt-2.5 flex flex-wrap gap-1.5" aria-label="標籤">
						{note.tags.map((t) => (
							<li key={t}>
								<button
									type="button"
									onClick={() => onTag(t)}
									aria-label={`只看標籤「${t}」`}
									className="relative inline-flex h-6 items-center gap-0.5 rounded-sm px-1.5 text-xs text-ink-2 ring-1 ring-line-strong transition-colors duration-120 ease-out ring-inset after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] hover:bg-subtle hover:text-ink"
								>
									<Hash className="size-3 shrink-0" aria-hidden />
									<Highlight text={t} query={terms} />
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</Card>
	);
}
