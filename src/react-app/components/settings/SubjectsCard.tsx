import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Subject } from '../../../shared/api-types';
import { useCreateSubject, useDeleteSubject, useSubjects, useUpdateSubject } from '../../lib/queries';
import { nextSubjectColor } from '../../lib/subject-color';
import { ColorPicker } from '../ColorPicker';
import { SubjectDot } from '../subjects';
import { Button, Card, CardHeader, cn, Input, useConfirm } from '../ui';

function SubjectRow({ subject, subjects }: { subject: Subject; subjects: readonly Subject[] }) {
	const update = useUpdateSubject();
	const remove = useDeleteSubject();
	const [confirm, confirmDialog] = useConfirm();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(subject.name);
	const [color, setColor] = useState(subject.color);

	// 每次開始編輯都從目前儲存的值開始，取消過的修改不會留下來
	const startEditing = () => {
		setName(subject.name);
		setColor(subject.color);
		setEditing(true);
	};

	const save = async () => {
		await update.mutateAsync({ id: subject.id, name: name.trim(), color }).catch(() => {});
		setEditing(false);
	};

	if (editing)
		return (
			<li className="space-y-3 px-4 py-3 sm:px-5">
				<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="科目名稱" autoFocus />
				<ColorPicker value={color} onChange={setColor} subjects={subjects} selfId={subject.id} name={name} />
				<div className="flex justify-end gap-2">
					<Button onClick={() => setEditing(false)}>取消</Button>
					<Button variant="primary" onClick={save} loading={update.isPending} disabled={!name.trim()}>
						儲存
					</Button>
				</div>
			</li>
		);

	return (
		<li className={cn('flex items-center gap-3 px-4 py-2.5 sm:px-5', subject.archived && 'opacity-60')}>
			<SubjectDot color={subject.color} className="size-3" />
			<span className="min-w-0 flex-1 truncate">
				{subject.name}
				{subject.archived && <span className="ml-2 text-xs text-ink-3">已封存</span>}
			</span>
			<Button size="icon" variant="ghost" onClick={startEditing} aria-label={`編輯 ${subject.name}`}>
				<Pencil className="size-4" />
			</Button>
			<Button
				size="icon"
				variant="ghost"
				onClick={() => update.mutate({ id: subject.id, archived: !subject.archived })}
				aria-label={subject.archived ? `取消封存 ${subject.name}` : `封存 ${subject.name}`}
				title={subject.archived ? '取消封存' : '封存（上完的課程，不再出現在選單中）'}
			>
				{subject.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
			</Button>
			<Button
				size="icon"
				variant="ghost"
				aria-label={`刪除 ${subject.name}`}
				onClick={async () => {
					if (
						await confirm({
							title: `刪除科目「${subject.name}」？`,
							message: '相關的考試、任務、筆記與學習紀錄都會保留，只是不再屬於任何科目。若只是課程結束，建議改用封存。',
						})
					)
						remove.mutate(subject.id);
				}}
			>
				<Trash2 className="size-4" />
			</Button>
			{confirmDialog}
		</li>
	);
}

export function SubjectsCard() {
	const { data: subjects = [] } = useSubjects();
	const create = useCreateSubject();
	const [name, setName] = useState('');
	// 使用者沒選顏色時，自動用下一個還沒用過的推薦色
	const [picked, setPicked] = useState<string | null>(null);
	const color = picked ?? nextSubjectColor(subjects.map((s) => s.color));

	const add = async (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		await create
			.mutateAsync({ name: name.trim(), color })
			.then(() => {
				setName('');
				setPicked(null);
			})
			.catch(() => {});
	};

	return (
		<Card>
			<CardHeader title="科目" />
			<p className="px-4 pb-3 text-sm text-ink-2 sm:px-5">科目用來分類考試、任務、筆記，也是學習統計的依據。</p>
			{subjects.length > 0 && (
				<ul className="divide-y divide-line border-y border-line">
					{subjects.map((s) => (
						<SubjectRow key={s.id} subject={s} subjects={subjects} />
					))}
				</ul>
			)}
			<form onSubmit={add} className="space-y-3 p-4 sm:px-5">
				<div className="flex gap-2">
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="新增科目，例如：計算機網路"
						maxLength={30}
						aria-label="新科目名稱"
					/>
					<Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim()}>
						<Plus className="size-4" aria-hidden />
						新增
					</Button>
				</div>
				<ColorPicker value={color} onChange={setPicked} subjects={subjects} name={name} label="新科目的顏色" />
			</form>
		</Card>
	);
}
