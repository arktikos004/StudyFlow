import { CircleCheck } from 'lucide-react';
import type { StatsResponse } from '../../../shared/api-types';
import { formatDate, formatMinutes } from '../../lib/format';
import type { FoldedSeries, StackSeries } from '../../lib/stats-series';
import { DailyStackedBars, Legend } from '../charts';
import { Card, CardHeader, cn, TableToggle } from '../ui';
import { cellClass, headerCellClass } from './table';

/** 表格檢視維持完整：每一科（含併入「其他」的科目與未分類）各一欄，最新的日期在最上面 */
function DailyTable({ daily, series, goal }: { daily: StatsResponse['daily']; series: StackSeries[]; goal: number | null }) {
	return (
		<div className="max-h-96 overflow-auto rounded-lg border border-line">
			<table className="w-full text-sm">
				<caption className="caption-bottom px-3 py-2 text-left text-meta text-ink-3">單位：分鐘（— 表示沒有紀錄）</caption>
				<thead className="sticky top-0 bg-subtle">
					<tr>
						<th scope="col" className={headerCellClass}>
							日期
						</th>
						{series.map((s) => (
							<th key={s.key} scope="col" className={headerCellClass}>
								{s.label}
							</th>
						))}
						<th scope="col" className={headerCellClass}>
							合計
						</th>
						{goal ? (
							<th scope="col" className={headerCellClass}>
								每日目標
							</th>
						) : null}
					</tr>
				</thead>
				<tbody className="divide-y divide-line">
					{[...daily].reverse().map((d) => (
						<tr key={d.date}>
							<th scope="row" className={cn(cellClass, 'text-left font-normal text-ink-2')}>
								{formatDate(d.date)}
							</th>
							{series.map((s) => (
								<td key={s.key} className={cellClass}>
									{d.bySubject[s.key] ? Math.round(d.bySubject[s.key]) : '—'}
								</td>
							))}
							<td className={cn(cellClass, 'font-semibold')}>{d.minutes ? Math.round(d.minutes) : '—'}</td>
							{goal ? (
								<td className={cn(cellClass, 'font-sans')}>
									{d.minutes >= goal ? (
										<span className="inline-flex items-center gap-1 text-success">
											<CircleCheck className="size-3.5" aria-hidden />
											達成
										</span>
									) : (
										<span className="text-ink-3">—</span>
									)}
								</td>
							) : null}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** 堆疊長條圖、圖例與每日目標線的說明；科目超過 8 個時說明「其他」包含哪些 */
function DailyChart({ chart, goal, today }: { chart: FoldedSeries; goal: number | null; today: string }) {
	return (
		<>
			<DailyStackedBars data={chart.daily} series={chart.series} today={today} goal={goal} />
			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2">
				{/* 2 個以上的系列一定有圖例；單一系列由標題說明 */}
				{chart.series.length > 1 && <Legend items={chart.series} />}
				{goal ? (
					<span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
						<span className="w-4 border-t-[1.5px] border-dashed border-ink-3" aria-hidden />
						每日目標 {formatMinutes(goal)}
					</span>
				) : null}
			</div>
			{chart.others.length > 0 && (
				<p className="mt-2 px-2 text-meta text-ink-3">「其他」包含：{chart.others.map((s) => s.label).join('、')}，各科數字請看表格。</p>
			)}
		</>
	);
}

/** 每日學習時間：圖表（最多 8 個系列）或表格（每一科各一欄）。table 由頁面保存，換統計區間時維持同一種檢視 */
export function DailyStudyCard({
	daily,
	series,
	chart,
	goal,
	today,
	table,
	onToggleTable,
}: {
	daily: StatsResponse['daily'];
	series: StackSeries[];
	chart: FoldedSeries;
	goal: number | null;
	today: string;
	table: boolean;
	onToggleTable: () => void;
}) {
	return (
		<Card>
			<CardHeader
				title="每日學習時間"
				meta={chart.others.length > 0 ? `前 ${chart.series.length - 1} 科與其他` : undefined}
				action={<TableToggle on={table} onToggle={onToggleTable} />}
			/>
			<div className="px-3 pb-4 sm:px-5">
				{table ? <DailyTable daily={daily} series={series} goal={goal} /> : <DailyChart chart={chart} goal={goal} today={today} />}
			</div>
		</Card>
	);
}
