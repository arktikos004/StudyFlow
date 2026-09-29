import { ArrowRight, ListChecks, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Task } from '../../shared/api-types';
import { addDays, today as todayOf } from '../../shared/dates';
import { TaskDialog } from '../components/forms';
import { SubjectSelect } from '../components/subjects';
import { TaskRow } from '../components/TaskItem';
import { Button, Card, EmptyState, ErrorNote, PageHeader, PageLoader, Segmented } from '../components/ui';
import { STATUS_LABEL } from '../lib/format';
import { useEvents, useTasks, useUpdateTask, useUser } from '../lib/queries';

type View = 'list' | 'board';
type StatusFilter = 'open' | 'done' | 'all';

function groupByDue(tasks: Task[], today: string) {
	const weekEnd = addDays(today, 7);
	const groups: { key: string; title: string; items: Task[] }[] = [
		{ key: 'overdue', title: '已逾期', items: [] },
		{ key: 'today', title: '今天', items: [] },
		{ key: 'week', title: '未來 7 天', items: [] },
		{ key: 'later', title: '之後', items: [] },
		{ key: 'none', title: '沒有期限', items: [] },
	];
	for (const t of tasks) {
		const g = !t.dueDate ? 4 : t.dueDate < today ? 0 : t.dueDate === today ? 1 : t.dueDate <= weekEnd ? 2 : 3;
		groups[g].items.push(t);
	}
	return groups.filter((g) => g.items.length);
}

export function TasksPage() {
	const user = useUser();
	const today = todayOf(user.timezone);
	const [view, setView] = useState<View>('list');
	const [status, setStatus] = useState<StatusFilter>('open');
	const [subjectId, setSubjectId] = useState<string | null>(null);
	const [dialog, setDialog] = useState<{ task?: Task } | null>(null);
	const { data: tasks, isPending, error } = useTasks(subjectId ? { subjectId } : {});
	const { data: events = [] } = useEvents();
	const update = useUpdateTask();
	const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

	const filtered = (tasks ?? []).filter(
		(t) => view === 'board' || status === 'all' || (status === 'done' ? t.status === 'done' : t.status !== 'done'),
	);
	const openCount = (tasks ?? []).filter((t) => t.status !== 'done').length;

	return (
		<div>
			<PageHeader
				title="學習任務"
				description={tasks ? `${openCount} 項未完成` : undefined}
				actions={
					<Button variant="primary" onClick={() => setDialog({})}>
						<Plus className="size-4" aria-hidden />
						新增任務
					</Button>
				}
			/>

			<div className="mb-4 flex flex-wrap items-center gap-2">
				<Segmented
					label="檢視方式"
					value={view}
					onChange={setView}
					options={[
						{ value: 'list', label: '清單' },
						{ value: 'board', label: '看板' },
					]}
				/>
				{view === 'list' && (
					<Segmented
						label="狀態"
						value={status}
						onChange={setStatus}
						options={[
							{ value: 'open', label: '未完成' },
							{ value: 'done', label: '已完成' },
							{ value: 'all', label: '全部' },
						]}
					/>
				)}
				<div className="w-40">
					<SubjectSelect value={subjectId} onChange={setSubjectId} emptyLabel="所有科目" />
				</div>
			</div>

			{isPending ? (
				<PageLoader />
			) : error ? (
				<ErrorNote error={error} />
			) : view === 'list' ? (
				filtered.length === 0 ? (
					<Card>
						<EmptyState
							icon={<ListChecks />}
							title={status === 'done' ? '還沒有完成的任務' : '沒有待辦任務'}
							description="把大目標拆成可以在一次讀書時間內完成的小任務，會更容易開始。"
							action={
								<Button size="sm" onClick={() => setDialog({})}>
									<Plus className="size-4" aria-hidden />
									新增任務
								</Button>
							}
						/>
					</Card>
				) : (
					<div className="space-y-4">
						{(status === 'done' ? [{ key: 'done', title: '已完成', items: filtered }] : groupByDue(filtered, today)).map((g) => (
							<section key={g.key}>
								<h2 className={`mb-2 px-1 text-sm font-semibold ${g.key === 'overdue' ? 'text-danger' : 'text-ink-2'}`}>
									{g.title}
									<span className="ml-1.5 font-normal text-ink-3">{g.items.length}</span>
								</h2>
								<Card as="div" className="divide-y divide-line">
									{g.items.map((t) => (
										<TaskRow
											key={t.id}
											task={t}
											today={today}
											event={t.eventId ? eventMap.get(t.eventId) : undefined}
											onOpen={() => setDialog({ task: t })}
										/>
									))}
								</Card>
							</section>
						))}
					</div>
				)
			) : (
				<div className="grid gap-4 md:grid-cols-3">
					{(['todo', 'doing', 'done'] as const).map((s) => {
						const items = filtered.filter((t) => t.status === s);
						return (
							<section key={s} className="rounded-xl bg-subtle/60 p-2">
								<h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold text-ink-2">
									{STATUS_LABEL[s]}
									<span className="font-normal text-ink-3">{items.length}</span>
								</h2>
								<div className="space-y-2">
									{items.map((t) => (
										<Card as="div" key={t.id}>
											<TaskRow
												task={t}
												today={today}
												event={t.eventId ? eventMap.get(t.eventId) : undefined}
												onOpen={() => setDialog({ task: t })}
											/>
											{s !== 'done' && (
												<div className="flex justify-end border-t border-line px-2 py-1.5">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => update.mutate({ id: t.id, status: s === 'todo' ? 'doing' : 'done' })}
													>
														{s === 'todo' ? '開始進行' : '標為完成'}
														<ArrowRight className="size-3.5" aria-hidden />
													</Button>
												</div>
											)}
										</Card>
									))}
									{items.length === 0 && <p className="px-2 py-6 text-center text-sm text-ink-3">沒有任務</p>}
								</div>
							</section>
						);
					})}
				</div>
			)}

			<TaskDialog open={!!dialog} task={dialog?.task} defaults={{ subjectId }} onClose={() => setDialog(null)} />
		</div>
	);
}
