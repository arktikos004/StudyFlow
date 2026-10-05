import { List, Search, SquareKanban, X } from 'lucide-react';
import { useRef } from 'react';
import type { TaskView } from '../../lib/task-queries';
import { SORT_LABEL, TASK_SORTS, type TaskSort } from '../../lib/task-sort';
import { SubjectSelect } from '../subjects';
import { Input, Segmented, Select } from '../ui';

export type StatusFilter = 'open' | 'done' | 'all';

/**
 * 任務頁的工具列：搜尋（標題與說明）、檢視方式、狀態（清單才有）、科目、排序。
 * 搜尋框有自己的清除按鈕；Esc 也會清除。
 */
export function TaskToolbar({
	query,
	onQueryChange,
	view,
	onViewChange,
	status,
	onStatusChange,
	subjectId,
	onSubjectChange,
	sort,
	onSortChange,
}: {
	query: string;
	onQueryChange: (q: string) => void;
	view: TaskView;
	onViewChange: (v: TaskView) => void;
	status: StatusFilter;
	onStatusChange: (s: StatusFilter) => void;
	subjectId: string | null;
	onSubjectChange: (id: string | null) => void;
	sort: TaskSort;
	onSortChange: (s: TaskSort) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	return (
		<div className="mb-5 flex flex-wrap items-center gap-2">
			<div role="search" className="relative min-w-0 grow basis-full sm:basis-64">
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
				<Input
					ref={inputRef}
					type="search"
					value={query}
					onChange={(e) => onQueryChange(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Escape' && query) {
							e.preventDefault();
							onQueryChange('');
						}
					}}
					placeholder="搜尋任務標題或說明"
					aria-label="搜尋任務"
					maxLength={100}
					enterKeyHint="search"
					className="pr-11 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
				/>
				{query && (
					<button
						type="button"
						aria-label="清除搜尋"
						onClick={() => {
							onQueryChange('');
							inputRef.current?.focus();
						}}
						className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-3 transition-colors duration-120 ease-out hover:text-ink"
					>
						<X className="size-4" aria-hidden />
					</button>
				)}
			</div>
			<Segmented
				label="檢視方式"
				value={view}
				onChange={onViewChange}
				options={[
					{
						value: 'list',
						label: (
							<span className="inline-flex items-center gap-1.5">
								<List className="size-4" aria-hidden />
								清單
							</span>
						),
					},
					{
						value: 'board',
						label: (
							<span className="inline-flex items-center gap-1.5">
								<SquareKanban className="size-4" aria-hidden />
								看板
							</span>
						),
					},
				]}
			/>
			{view === 'list' && (
				<Segmented
					label="狀態"
					value={status}
					onChange={onStatusChange}
					options={[
						{ value: 'open', label: '未完成' },
						{ value: 'done', label: '已完成' },
						{ value: 'all', label: '全部' },
					]}
				/>
			)}
			<div className="flex w-full gap-2 sm:w-auto">
				<div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
					<SubjectSelect value={subjectId} onChange={onSubjectChange} emptyLabel="所有科目" aria-label="科目" />
				</div>
				<Select
					aria-label="排序"
					value={sort}
					onChange={(e) => onSortChange(e.target.value as TaskSort)}
					className="min-w-0 flex-1 sm:w-40 sm:flex-none"
				>
					{TASK_SORTS.map((s) => (
						<option key={s} value={s}>
							{SORT_LABEL[s]}
						</option>
					))}
				</Select>
			</div>
		</div>
	);
}
