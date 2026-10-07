import { CalendarCheck, CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StatsResponse } from '../../../shared/api-types';
import { formatDate, percent } from '../../lib/format';
import { Legend, WeeklyTaskBars } from '../charts';
import { Badge, Card, CardHeader, cn, EmptyState, MoreLink, TableToggle } from '../ui';
import { cellClass, headerCellClass } from './table';

function WeeklyTable({ weekly }: { weekly: StatsResponse['weekly'] }) {
	return (
		<table className="w-full text-sm">
			<caption className="sr-only">每週到期與完成的任務數</caption>
			<thead className="bg-subtle">
				<tr>
					<th scope="col" className={headerCellClass}>
						週
					</th>
					<th scope="col" className={headerCellClass}>
						到期
					</th>
					<th scope="col" className={headerCellClass}>
						完成
					</th>
					<th scope="col" className={headerCellClass}>
						完成率
					</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-line">
				{weekly.map((w) => (
					<tr key={w.weekStart}>
						<th scope="row" className={cn(cellClass, 'text-left font-normal text-ink-2')}>
							{formatDate(w.weekStart)} 起
						</th>
						<td className={cellClass}>{w.due}</td>
						<td className={cellClass}>{w.done}</td>
						<td className={cellClass}>{w.due ? `${percent(w.done, w.due)}%` : '—'}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

/**
 * 每週任務完成情況：期限落在各週的任務完成了幾項（圖表或表格），以及逾期的任務數。
 * table 由頁面保存，換統計區間時維持同一種檢視。
 */
export function WeeklyTasksCard({
	weekly,
	overdue,
	table,
	onToggleTable,
}: {
	weekly: StatsResponse['weekly'];
	overdue: number;
	table: boolean;
	onToggleTable: () => void;
}) {
	const due = weekly.reduce((n, w) => n + w.due, 0);
	const done = weekly.reduce((n, w) => n + w.done, 0);
	let body: ReactNode;
	if (due === 0)
		body = <EmptyState icon={<CalendarCheck />} title="這段期間沒有設定期限的任務" description="替任務設定期限，就能追蹤每週的完成率。" />;
	else if (table) body = <WeeklyTable weekly={weekly} />;
	else
		body = (
			<>
				<WeeklyTaskBars data={weekly} />
				<div className="mt-3 px-2">
					<Legend
						items={[
							{ label: '已完成', color: 'var(--accent)' },
							{ label: '未完成', color: 'var(--chart-rest)' },
						]}
					/>
				</div>
			</>
		);

	return (
		<Card>
			<CardHeader
				title="每週任務完成情況"
				meta={due > 0 ? `完成 ${done}／${due} 項（${percent(done, due)}%）` : undefined}
				action={due > 0 && <TableToggle on={table} onToggle={onToggleTable} />}
			/>
			<div className="px-3 pb-4 sm:px-5">
				{overdue > 0 && (
					<div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
						<Badge tone="danger" icon={<CircleAlert aria-hidden />}>
							{overdue} 項逾期
						</Badge>
						<MoreLink to="/tasks">處理逾期任務</MoreLink>
					</div>
				)}
				{body}
			</div>
		</Card>
	);
}
