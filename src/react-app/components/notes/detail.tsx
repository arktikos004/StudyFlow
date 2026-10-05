import { CircleCheck, Hash, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { NoteItem } from '../../../shared/api-types';
import { dayLabel } from '../../lib/notes-format';
import { usePinNote } from '../../lib/notes-queries';
import { useDeleteNote, useUpdateNote } from '../../lib/queries';
import { SubjectTag } from '../subjects';
import { Badge, Button, Dialog, useConfirm } from '../ui';
import { KindBadge, MistakeAnswer, MistakeQuestion, NoteBody, ReviewBadge } from './content';
import { PinToggle } from './pin';

/** 筆記或錯題的詳細內容（對話框）：標題、狀態、內容；釘選、標為已掌握、編輯、刪除 */
export function NoteDetail({
	note,
	onClose,
	onEdit,
	today,
	timeZone,
}: {
	note: NoteItem | null;
	onClose: () => void;
	onEdit: (n: NoteItem) => void;
	today: string;
	timeZone: string;
}) {
	const update = useUpdateNote();
	const remove = useDeleteNote();
	const pin = usePinNote();
	const [confirm, confirmDialog] = useConfirm();

	return (
		<>
			<Dialog
				open={!!note}
				onClose={onClose}
				wide
				title={note?.title ?? ''}
				footer={
					note && (
						<>
							<Button
								variant="ghost"
								className="mr-auto text-danger hover:text-danger"
								onClick={async () => {
									if (await confirm({ title: `刪除「${note.title}」？`, message: '照片也會一起刪除，刪除後無法復原。' })) {
										await remove.mutateAsync(note.id).catch(() => {});
										onClose();
									}
								}}
							>
								<Trash2 className="size-4" aria-hidden />
								刪除
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
					<article className="space-y-5">
						<div className="space-y-3">
							<div className="flex flex-wrap items-center gap-1.5">
								<KindBadge kind={note.kind} />
								<ReviewBadge note={note} today={today} detailed />
								<SubjectTag subjectId={note.subjectId} />
							</div>
							<div className="flex flex-wrap gap-2">
								<PinToggle
									variant="text"
									pinned={note.pinned}
									title={note.title}
									busy={pin.isPending}
									onToggle={() => pin.mutate({ id: note.id, pinned: !note.pinned })}
								/>
								<Button size="sm" onClick={() => update.mutate({ id: note.id, mastered: !note.mastered })} loading={update.isPending}>
									{note.mastered ? <RotateCcw className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
									{note.mastered ? '重新開始複習' : '標為已掌握'}
								</Button>
							</div>
						</div>

						{note.kind === 'mistake' ? (
							<>
								<MistakeQuestion note={note} />
								<MistakeAnswer note={note} />
							</>
						) : (
							<NoteBody note={note} />
						)}

						{note.tags.length > 0 && (
							<ul className="flex flex-wrap gap-1.5" aria-label="標籤">
								{note.tags.map((t) => (
									<li key={t}>
										<Badge tone="outline" icon={<Hash aria-hidden />}>
											{t}
										</Badge>
									</li>
								))}
							</ul>
						)}

						<p className="border-t border-line pt-3 text-meta text-ink-3">
							新增於 {dayLabel(note.createdAt, timeZone, today)}，最後更新 {dayLabel(note.updatedAt, timeZone, today)}
						</p>
					</article>
				)}
			</Dialog>
			{confirmDialog}
		</>
	);
}
