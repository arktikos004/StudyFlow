import { useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowDown, ArrowUp, BookOpen, Pencil, Plus } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Subject } from '../../../shared/api-types';
import { useDeepLink } from '../../lib/deep-link';
import { formatMinutes } from '../../lib/format';
import { useReorderSubjects, useSubjects } from '../../lib/queries';
import { SubjectTag } from '../subjects';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, Spinner } from '../ui';
import { SubjectDialog } from './SubjectDialog';

type Direction = 'up' | 'down';

const NO_SUBJECTS: Subject[] = [];

function SubjectRow({
	subject,
	first,
	last,
	goalColumn,
	onMove,
	onEdit,
	setButton,
}: {
	subject: Subject;
	first: boolean;
	last: boolean;
	/** 有任何科目設了每週目標：保留右側的目標欄，各列的目標靠右對齊 */
	goalColumn: boolean;
	onMove: (dir: Direction) => void;
	onEdit: () => void;
	setButton: (key: string, el: HTMLButtonElement | null) => void;
}) {
	const name = subject.name;
	return (
		<li className="flex items-center gap-1 py-1 pr-3 pl-4 sm:pr-4 sm:pl-5">
			{/* 名稱本身就是連到單科總覽（SUB-3）的連結，hover 時名稱加底線；名稱太長時截斷（手機不會把整頁撐寬） */}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<Link to={`/subjects/${subject.id}`} className="group/subject-link inline-flex min-h-11 max-w-full min-w-0 items-center rounded-sm">
					<SubjectTag subjectId={subject.id} className="max-w-full" />
					<span className="sr-only">，查看科目總覽</span>
				</Link>
				{subject.archived && <Badge icon={<Archive aria-hidden />}>已封存</Badge>}
			</div>
			{goalColumn && (
				<span className="flex w-[5.5rem] shrink-0 flex-col items-end text-right text-meta leading-tight text-ink-3">
					{subject.weeklyGoalMinutes != null && (
						<>
							<span className="text-caption">每週目標</span>
							<span className="font-num text-ink-2 tabular-nums">{formatMinutes(subject.weeklyGoalMinutes)}</span>
						</>
					)}
				</span>
			)}
			<Button
				ref={(el) => setButton(`${subject.id}:up`, el)}
				size="icon"
				variant="ghost"
				disabled={first}
				onClick={() => onMove('up')}
				aria-label={`上移「${name}」`}
			>
				<ArrowUp className="size-4" aria-hidden />
			</Button>
			<Button
				ref={(el) => setButton(`${subject.id}:down`, el)}
				size="icon"
				variant="ghost"
				disabled={last}
				onClick={() => onMove('down')}
				aria-label={`下移「${name}」`}
			>
				<ArrowDown className="size-4" aria-hidden />
			</Button>
			<Button size="icon" variant="ghost" onClick={onEdit} aria-label={`編輯「${name}」`}>
				<Pencil className="size-4" aria-hidden />
			</Button>
		</li>
	);
}

/**
 * 科目（SUB-2）：列表依 API 回傳的順序（= 使用者自訂的順序），上移／下移按鈕調整順序（樂觀更新，失敗時還原）。
 * 新增與編輯用 SubjectDialog。深連結：?new=1 開新增、?open=<科目 id> 開編輯，處理後用 replace 清掉參數。
 */
export function SubjectsCard() {
	const qc = useQueryClient();
	const { data, isPending, error, refetch, isRefetching } = useSubjects();
	const subjects = data ?? NO_SUBJECTS;
	const reorder = useReorderSubjects();
	// id 為 null 代表新增；編輯時存 id，科目列表載入後才打開
	const [dialog, setDialog] = useState<{ id: string | null } | null>(null);
	const [announcement, setAnnouncement] = useState('');
	const buttons = useRef(new Map<string, HTMLButtonElement>());
	const pendingFocus = useRef<{ id: string; dir: Direction } | null>(null);

	// 深連結：?new=1 新增科目、?open=<id> 編輯該科目（科目列表載入後才打開）
	useDeepLink(['new', 'open'], ({ new: isNew, open }) => {
		if (isNew === '1') setDialog({ id: null });
		else if (open) setDialog({ id: open });
	});

	const editing = dialog?.id ? subjects.find((s) => s.id === dialog.id) : undefined;
	const dialogOpen = !!dialog && (dialog.id === null || !!editing);

	// 調整順序後，焦點留在同一個科目的同一個按鈕上（移到頂端或底端、按鈕停用時改到另一個方向）
	useLayoutEffect(() => {
		const target = pendingFocus.current;
		if (!target) return;
		const i = subjects.findIndex((s) => s.id === target.id);
		if (i < 0) return;
		pendingFocus.current = null;
		const atEdge = target.dir === 'up' ? i === 0 : i === subjects.length - 1;
		const dir: Direction = atEdge ? (target.dir === 'up' ? 'down' : 'up') : target.dir;
		buttons.current.get(`${target.id}:${dir}`)?.focus();
	}, [subjects]);

	const setButton = (key: string, el: HTMLButtonElement | null) => {
		if (el) buttons.current.set(key, el);
		else buttons.current.delete(key);
	};

	const move = (id: string, dir: Direction) => {
		// 讀快取裡最新的順序：連按時，上一次的樂觀更新已經套用
		const list = qc.getQueryData<Subject[]>(['subjects']) ?? subjects;
		const from = list.findIndex((s) => s.id === id);
		const to = from + (dir === 'up' ? -1 : 1);
		if (from < 0 || to < 0 || to >= list.length) return;
		const ids = list.map((s) => s.id);
		[ids[from], ids[to]] = [ids[to], ids[from]];
		pendingFocus.current = { id, dir };
		reorder.mutate(ids);
		setAnnouncement(`已將「${list[from].name}」移到第 ${to + 1} 個，共 ${list.length} 個`);
	};

	const openNew = () => setDialog({ id: null });

	return (
		<Card>
			<CardHeader
				title="科目"
				meta={subjects.length ? `${subjects.length} 個` : undefined}
				action={
					subjects.length > 0 && (
						<Button size="sm" onClick={openNew}>
							<Plus className="size-4" aria-hidden />
							新增科目
						</Button>
					)
				}
			/>
			{isPending ? (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			) : error ? (
				<div className="px-4 pb-5 sm:px-5">
					<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />
				</div>
			) : subjects.length === 0 ? (
				<EmptyState
					icon={<BookOpen />}
					title="新增第一個科目"
					description="用科目分類考試、任務與筆記，學習統計也會依科目整理。"
					action={
						<Button variant="primary" onClick={openNew}>
							<Plus className="size-4" aria-hidden />
							新增科目
						</Button>
					}
				/>
			) : (
				<>
					<p className="px-4 pb-3 text-sm text-ink-2 sm:px-5">用科目分類考試、任務與筆記；這裡的順序會套用到所有選單、圖表與圖例。</p>
					<ul className="divide-y divide-line border-t border-line">
						{subjects.map((s, i) => (
							<SubjectRow
								key={s.id}
								subject={s}
								first={i === 0}
								last={i === subjects.length - 1}
								goalColumn={subjects.some((x) => x.weeklyGoalMinutes != null)}
								onMove={(dir) => move(s.id, dir)}
								onEdit={() => setDialog({ id: s.id })}
								setButton={setButton}
							/>
						))}
					</ul>
				</>
			)}
			<p role="status" className="sr-only">
				{announcement}
			</p>
			<SubjectDialog open={dialogOpen} onClose={() => setDialog(null)} subject={editing} subjects={subjects} />
		</Card>
	);
}
