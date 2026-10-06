import { List, SquareKanban } from 'lucide-react';
import type { TaskView } from '../../lib/task-queries';
import { SORT_LABEL, TASK_SORTS, type TaskSort } from '../../lib/task-sort';
import { SubjectSelect } from '../subjects';
import { SearchInput, Segmented, Select } from '../ui';

export type StatusFilter = 'open' | 'done' | 'all';

/**
 * 任務頁的工具列：搜尋（標題與說明）、檢視方式、狀態（清單才有）、科目、排序。
 * 搜尋框是共用的 SearchInput（清除鈕、Esc 清空）。
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
	// 篩選列順序（跨頁慣例）：搜尋 → 檢視方式 → 狀態 → 科目 → 排序。
	// 手機：搜尋和檢視方式（只剩圖示）同一列、狀態和科目同一列（太窄時科目換行，選單文字不會被切掉）、排序一列。
	return (
		<div className="mb-5 flex flex-wrap items-center gap-2">
			<SearchInput
				value={query}
				onValueChange={onQueryChange}
				label="搜尋任務"
				placeholder="搜尋任務標題或說明"
				maxLength={100}
				className="min-w-0 flex-1 basis-40 sm:basis-64"
			/>
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
								<span className="sr-only sm:not-sr-only">清單</span>
							</span>
						),
					},
					{
						value: 'board',
						label: (
							<span className="inline-flex items-center gap-1.5">
								<SquareKanban className="size-4" aria-hidden />
								<span className="sr-only sm:not-sr-only">看板</span>
							</span>
						),
					},
				]}
			/>
			<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
				<div className="min-w-28 flex-1 sm:w-36 sm:flex-none">
					<SubjectSelect value={subjectId} onChange={onSubjectChange} emptyLabel="所有科目" aria-label="科目" />
				</div>
			</div>
			<Select aria-label="排序" value={sort} onChange={(e) => onSortChange(e.target.value as TaskSort)} className="w-full sm:w-40">
				{TASK_SORTS.map((s) => (
					<option key={s} value={s}>
						{SORT_LABEL[s]}
					</option>
				))}
			</Select>
		</div>
	);
}
