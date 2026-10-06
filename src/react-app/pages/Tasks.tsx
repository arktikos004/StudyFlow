import { ListChecks, Plus, SearchX } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Task, TaskItem } from '../../shared/api-types';
import { today as todayOf } from '../../shared/dates';
import { TaskDialog } from '../components/forms';
import { TaskBoard } from '../components/tasks/TaskBoard';
import { TaskList } from '../components/tasks/TaskList';
import { TaskToolbar, type StatusFilter } from '../components/tasks/TaskToolbar';
import { Button, Card, EmptyState, ErrorNote, PageHeader, PageLoader, useConfirm } from '../components/ui';
import { STATUS_LABEL } from '../lib/format';
import { useEvents, useSubjects, useTasks, useUser } from '../lib/queries';
import { justCompleted, toggleChecklistItem } from '../lib/task-checklist';
import { useTaskListParams, useTaskPatch, useTaskView } from '../lib/task-queries';
import { boardColumns, filterTasks, groupTasks, taskSummary, type TaskStatus } from '../lib/task-sort';
import { useDeepLink } from '../lib/timer-queries';

/** 頁首的即時摘要：未完成、已逾期、今天到期（數字用等寬數字） */
function Summary({ open, overdue, dueToday }: { open: number; overdue: number; dueToday: number }) {
	if (!open) return <>任務都完成了</>;
	const n = (v: number) => <span className="font-num tabular-nums">{v}</span>;
	return (
		<>
			{n(open)} 項未完成
			{overdue > 0 && <>，{n(overdue)} 項已逾期</>}
			{dueToday > 0 && <>，{n(dueToday)} 項今天到期</>}
		</>
	);
}

export function TasksPage() {
	const user = useUser();
	const today = todayOf(user.timezone);
	const [view, setView] = useTaskView();
	const [status, setStatus] = useState<StatusFilter>('open');
	const [subjectId, setSubjectId] = useState<string | null>(null);
	const { query, setQuery, sort, setSort } = useTaskListParams();
	const [dialog, setDialog] = useState<{ task?: TaskItem } | null>(null);
	const { data: tasks, isPending, isFetching, error, refetch, isRefetching } = useTasks(subjectId ? { subjectId } : {});
	// 等科目也到齊再畫，科目 chip 與顏色不會晚一步才出現
	const subjects = useSubjects();
	const { data: events = [] } = useEvents();
	const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
	const patch = useTaskPatch();
	const [confirm, confirmDialog] = useConfirm();

	// 深連結：?new=1 開啟新增、?open=<id> 開啟該任務的編輯對話框（處理後由 useDeepLink 用 replace 清掉參數）
	const link = useDeepLink(['new', 'open']);
	const [seenLink, setSeenLink] = useState(0);
	const [pendingOpen, setPendingOpen] = useState<string | null>(null);
	if (link.seq !== seenLink) {
		setSeenLink(link.seq);
		if (link.values.new === '1') setDialog({});
		if (link.values.open) {
			// 不限科目地找這個任務，找到後清單也看得到它
			setPendingOpen(link.values.open);
			setSubjectId(null);
		}
	}
	const [missingOpen, setMissingOpen] = useState(0);
	if (pendingOpen && !subjectId && tasks) {
		const found = tasks.find((t) => t.id === pendingOpen);
		if (found) {
			setPendingOpen(null);
			setDialog({ task: found });
		} else if (!isFetching) {
			// 快取裡的舊資料找不到時，等這次查詢回來再判斷；最後還是找不到才告知
			setPendingOpen(null);
			setMissingOpen((n) => n + 1);
		}
	}
	useEffect(() => {
		if (missingOpen) toast.error('找不到這個任務', { description: '可能已經刪除了，請從清單重新選擇' });
	}, [missingOpen]);

	const moveTask = (task: TaskItem, to: TaskStatus, onSettled?: (failed: boolean) => void) =>
		patch.mutate(
			{ id: task.id, status: to, errorTitle: `沒有移動成功，「${task.title}」已放回「${STATUS_LABEL[task.status]}」` },
			onSettled && { onSuccess: () => onSettled(false), onError: () => onSettled(true) },
		);

	// 在清單上直接勾子項目（樂觀更新）；全部勾完時詢問要不要一併完成任務，不會自動完成
	const toggleItem = async (task: Task | TaskItem, itemId: string) => {
		const next = toggleChecklistItem(task.checklist, itemId);
		const item = task.checklist.find((i) => i.id === itemId);
		patch.mutate({ id: task.id, checklist: next, errorTitle: `沒有儲存「${item?.title ?? '子項目'}」的勾選，已還原` });
		if (task.status === 'done' || !justCompleted(task.checklist, next)) return;
		const ok = await confirm({
			title: '要一併完成任務嗎？',
			message: `「${task.title}」的子項目都勾完了。選「完成任務」會把這個任務標為已完成。`,
			confirmText: '完成任務',
			tone: 'primary',
		});
		if (ok) patch.mutate({ id: task.id, status: 'done', errorTitle: `沒有完成「${task.title}」，請再試一次` });
	};

	// 搜尋、篩選、排序與分組只在相關的值改變時重算；輸入框用即時的 query，清單用延後的值，打字不會卡
	const q = useDeferredValue(query);
	const all = useMemo(() => tasks ?? [], [tasks]);
	const summary = useMemo(() => taskSummary(all, today), [all, today]);
	const searched = useMemo(() => filterTasks(all, q), [all, q]);
	const listed = useMemo(
		() => searched.filter((t) => status === 'all' || (status === 'done' ? t.status === 'done' : t.status !== 'done')),
		[searched, status],
	);
	const groups = useMemo(() => (view === 'list' ? groupTasks(listed, today, sort) : []), [view, listed, today, sort]);
	const columns = useMemo(() => (view === 'board' ? boardColumns(searched, sort) : null), [view, searched, sort]);
	const shown = view === 'board' ? searched : listed;
	const searching = q.trim().length > 0;
	const empty = !!tasks && all.length === 0;
	// 完全沒有任務（不是篩選科目後才沒有）：頁首不放主要動作、篩選列隱藏，由空狀態負責（跨頁慣例）
	const noData = empty && !subjectId;

	const addButton = (label = '新增任務', variant: 'primary' | 'secondary' = 'primary') => (
		<Button variant={variant} onClick={() => setDialog({})}>
			<Plus className="size-4" aria-hidden />
			{label}
		</Button>
	);

	let content: ReactNode;
	if (isPending || subjects.isPending) content = <PageLoader />;
	else if (error) content = <ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
	else if (noData)
		content = (
			<Card>
				<EmptyState
					icon={<ListChecks />}
					title="還沒有任務"
					description="把大目標拆成可以在一次讀書時間內完成的小任務，會更容易開始。"
					action={addButton('新增第一個任務')}
				/>
			</Card>
		);
	else if (empty)
		// 篩選科目後沒有任務：頁首的主要動作與篩選列照常顯示，這裡用 secondary
		content = (
			<Card>
				<EmptyState
					icon={<ListChecks />}
					title="這個科目還沒有任務"
					description="換個科目，或看看所有科目的任務。"
					action={<Button onClick={() => setSubjectId(null)}>顯示所有科目</Button>}
				/>
			</Card>
		);
	else if (searching && shown.length === 0)
		content = (
			<Card>
				{searched.length > 0 ? (
					// 符合的任務都被狀態篩選擋掉了：說明在哪裡，並提供切換
					<EmptyState
						icon={<SearchX />}
						title="找不到符合的任務"
						description={`目前只顯示${status === 'done' ? '已完成' : '未完成'}的任務；有 ${searched.length} 項符合「${q.trim()}」的任務${status === 'done' ? '還沒完成' : '已經完成'}。`}
						action={<Button onClick={() => setStatus('all')}>顯示全部狀態</Button>}
					/>
				) : (
					<EmptyState
						icon={<SearchX />}
						title="找不到符合的任務"
						description={`沒有任務的標題或說明包含「${q.trim()}」，換個關鍵字試試。`}
						action={<Button onClick={() => setQuery('')}>清除搜尋</Button>}
					/>
				)}
			</Card>
		);
	else if (columns)
		content = (
			<TaskBoard columns={columns} today={today} eventMap={eventMap} query={q} onOpen={(task) => setDialog({ task })} onMove={moveTask} />
		);
	else if (listed.length === 0)
		content = (
			<Card>
				{status === 'done' ? (
					<EmptyState icon={<ListChecks />} title="還沒有完成的任務" description="勾選完成的任務會出現在這裡。" />
				) : (
					<EmptyState
						icon={<ListChecks />}
						title="沒有待辦任務"
						description="目前的任務都完成了，可以排下一個任務。"
						action={addButton('新增任務', 'secondary')}
					/>
				)}
			</Card>
		);
	else
		content = (
			<TaskList
				groups={groups}
				today={today}
				eventMap={eventMap}
				query={q}
				onOpen={(task) => setDialog({ task })}
				onToggleItem={toggleItem}
			/>
		);

	return (
		<div>
			<PageHeader
				title="學習任務"
				description={noData ? undefined : tasks && !empty && <Summary {...summary} />}
				// 完全沒有任務時，新增按鈕在空狀態裡（每個畫面只有一個主要動作）
				actions={noData ? undefined : addButton()}
			/>

			{!noData && (
				<TaskToolbar
					query={query}
					onQueryChange={setQuery}
					view={view}
					onViewChange={setView}
					status={status}
					onStatusChange={setStatus}
					subjectId={subjectId}
					onSubjectChange={setSubjectId}
					sort={sort}
					onSortChange={setSort}
				/>
			)}

			{/* 搜尋結果的報讀：有結果時也顯示在畫面上；沒有結果時畫面上已經有空狀態，這裡只給螢幕報讀器 */}
			<p role="status" className={searching && shown.length > 0 ? 'mb-3 text-meta text-ink-2' : 'sr-only'}>
				{searching &&
					(shown.length > 0 ? (
						<>
							找到 <span className="font-num tabular-nums">{shown.length}</span> 項符合「{q.trim()}」的任務
						</>
					) : (
						'找不到符合的任務'
					))}
			</p>

			{content}

			<TaskDialog open={!!dialog} task={dialog?.task} defaults={{ subjectId }} onClose={() => setDialog(null)} />
			{confirmDialog}
		</div>
	);
}
