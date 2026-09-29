import { Brain, CalendarCheck, Clock, Flame, ListChecks, Table2, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
	DailyStackedBars,
	Heatmap,
	Legend,
	StatTile,
	SubjectBars,
	useSubjectColor,
	WeeklyTaskBars,
	type SeriesDef,
} from '../components/charts';
import { Button, Card, CardHeader, cn, EmptyState, ErrorNote, PageHeader, PageLoader, Segmented } from '../components/ui';
import { formatDate, formatMinutes } from '../lib/format';
import { useStats, useSubjects } from '../lib/queries';

type Range = '7' | '30' | '90';

function TableToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
	return (
		<Button size="sm" variant="ghost" onClick={onToggle} aria-pressed={on}>
			<Table2 className="size-4" aria-hidden />
			{on ? '圖表' : '表格'}
		</Button>
	);
}

const th = 'px-3 py-2 text-left font-medium text-ink-2';
const td = 'px-3 py-1.5 tabular-nums';

export function StatsPage() {
	const [range, setRange] = useState<Range>('30');
	const { data, isPending, error, isPlaceholderData } = useStats(Number(range) as 7 | 30 | 90);
	// 等科目資料也到齊再畫，否則科目名稱會暫時顯示成「已刪除的科目」
	const { data: subjects = [], isPending: subjectsPending } = useSubjects();
	const colorOf = useSubjectColor();
	const [dailyTable, setDailyTable] = useState(false);
	const [weeklyTable, setWeeklyTable] = useState(false);

	if (isPending || subjectsPending) return <PageLoader />;
	if (error) return <ErrorNote error={error} />;

	// 系列依科目建立順序排列，顏色跟著科目走，不因篩選或排名改變
	const used = new Set(data.bySubject.map((b) => b.subjectId ?? 'none'));
	const series: SeriesDef[] = [
		...subjects.filter((s) => used.has(s.id)).map((s) => ({ key: s.id, label: s.name, color: colorOf(s.color) })),
		...(used.has('none') ? [{ key: 'none', label: '未分類', color: colorOf(null) }] : []),
	];
	const seriesMap = new Map(series.map((s) => [s.key, s]));
	const subjectItems = data.bySubject.map((b) => {
		const s = seriesMap.get(b.subjectId ?? 'none');
		return { key: b.subjectId ?? 'none', label: s?.label ?? '已刪除的科目', color: s?.color ?? colorOf(null), minutes: b.minutes };
	});

	const taskRate = data.tasks.total ? Math.round((data.tasks.done / data.tasks.total) * 100) : null;
	const masteryRate = data.mistakes.total ? Math.round((data.mistakes.mastered / data.mistakes.total) * 100) : null;
	const hasStudy = data.totals.minutes > 0;

	return (
		<div>
			<PageHeader title="學習統計" description={`${formatDate(data.range.from, true)} – ${formatDate(data.range.to)}`} />

			{/* 篩選器放在所有圖表上方，一次套用到全部 */}
			<div className="mb-4">
				<Segmented
					label="統計區間"
					value={range}
					onChange={setRange}
					options={[
						{ value: '7', label: '近 7 天' },
						{ value: '30', label: '近 30 天' },
						{ value: '90', label: '近 90 天' },
					]}
				/>
			</div>

			<div className={cn('space-y-5 transition-opacity', isPlaceholderData && 'opacity-60')}>
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<StatTile
						label="總學習時間"
						icon={<Clock className="size-4" aria-hidden />}
						value={formatMinutes(data.totals.minutes)}
						sub={`${data.totals.sessions} 段學習`}
					/>
					<StatTile
						label="平均每天"
						icon={<TrendingUp className="size-4" aria-hidden />}
						value={formatMinutes(data.totals.avgMinutesPerDay)}
						sub={`${data.range.days} 天中有 ${data.totals.activeDays} 天有讀書`}
					/>
					<StatTile
						label="連續學習"
						icon={<Flame className="size-4" aria-hidden />}
						value={`${data.totals.currentStreak} 天`}
						sub={`最長紀錄 ${data.totals.longestStreak} 天`}
					/>
					<StatTile
						label="任務完成率"
						icon={<ListChecks className="size-4" aria-hidden />}
						value={taskRate === null ? '—' : `${taskRate}%`}
						sub={
							data.tasks.overdue
								? `${data.tasks.done}/${data.tasks.total} 項・${data.tasks.overdue} 項逾期`
								: `${data.tasks.done}/${data.tasks.total} 項`
						}
					/>
				</div>

				<Card>
					<CardHeader title="每日學習時間" action={hasStudy && <TableToggle on={dailyTable} onToggle={() => setDailyTable((v) => !v)} />} />
					<div className="px-3 pb-4 sm:px-5">
						{!hasStudy ? (
							<EmptyState icon={<Clock />} title="這段期間還沒有學習紀錄" description="使用學習計時或手動補登後，就會出現在這裡。" />
						) : dailyTable ? (
							<div className="max-h-80 overflow-auto rounded-lg border border-line">
								<table className="w-full text-sm">
									<thead className="sticky top-0 bg-subtle">
										<tr>
											<th className={th}>日期</th>
											{series.map((s) => (
												<th key={s.key} className={th}>
													{s.label}
												</th>
											))}
											<th className={th}>合計</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-line">
										{[...data.daily].reverse().map((d) => (
											<tr key={d.date}>
												<td className={td}>{formatDate(d.date)}</td>
												{series.map((s) => (
													<td key={s.key} className={td}>
														{d.bySubject[s.key] ? `${Math.round(d.bySubject[s.key])} 分` : '—'}
													</td>
												))}
												<td className={cn(td, 'font-medium')}>{d.minutes ? `${Math.round(d.minutes)} 分` : '—'}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<>
								<DailyStackedBars data={data.daily} series={series} today={data.range.to} />
								{series.length > 1 && (
									<div className="mt-3 px-2">
										<Legend items={series} />
									</div>
								)}
							</>
						)}
					</div>
				</Card>

				<div className="grid gap-5 lg:grid-cols-2">
					<Card>
						<CardHeader title="各科目學習時間" />
						<div className="px-4 pb-5 sm:px-5">
							{subjectItems.length ? <SubjectBars items={subjectItems} /> : <p className="py-6 text-center text-sm text-ink-3">沒有資料</p>}
						</div>
					</Card>

					<Card>
						<CardHeader
							title="每週任務完成情況"
							action={data.weekly.some((w) => w.due) && <TableToggle on={weeklyTable} onToggle={() => setWeeklyTable((v) => !v)} />}
						/>
						<div className="px-3 pb-4 sm:px-5">
							{!data.weekly.some((w) => w.due) ? (
								<EmptyState
									icon={<CalendarCheck />}
									title="這段期間沒有設定期限的任務"
									description="替任務設定期限，就能追蹤每週的完成率。"
								/>
							) : weeklyTable ? (
								<table className="w-full text-sm">
									<thead className="bg-subtle">
										<tr>
											<th className={th}>週</th>
											<th className={th}>到期</th>
											<th className={th}>完成</th>
											<th className={th}>完成率</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-line">
										{data.weekly.map((w) => (
											<tr key={w.weekStart}>
												<td className={td}>{formatDate(w.weekStart)} 起</td>
												<td className={td}>{w.due}</td>
												<td className={td}>{w.done}</td>
												<td className={td}>{w.due ? `${Math.round((w.done / w.due) * 100)}%` : '—'}</td>
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<>
									<WeeklyTaskBars data={data.weekly} />
									<div className="mt-3 px-2">
										<Legend
											items={[
												{ label: '已完成', color: 'var(--accent)' },
												{ label: '未完成', color: 'var(--chart-rest)' },
											]}
										/>
									</div>
								</>
							)}
						</div>
					</Card>
				</div>

				<div className="grid gap-5 lg:grid-cols-3">
					<Card className="lg:col-span-2">
						<CardHeader title="學習熱度（近 16 週）" />
						<div className="px-4 pb-4 sm:px-5">
							<Heatmap data={data.heatmap} today={data.range.to} />
						</div>
					</Card>
					<Card>
						<CardHeader title="錯題掌握度" icon={<Brain className="size-[18px] text-ink-3" aria-hidden />} />
						<div className="px-4 pb-5 sm:px-5">
							{data.mistakes.total ? (
								<>
									<p className="text-3xl font-semibold tracking-tight">{masteryRate}%</p>
									<p className="mt-0.5 text-sm text-ink-2">
										{data.mistakes.total} 題中已掌握 {data.mistakes.mastered} 題
									</p>
									<div
										className="mt-4 h-2.5 overflow-hidden rounded-full bg-accent-soft"
										role="progressbar"
										aria-valuenow={masteryRate ?? 0}
										aria-valuemin={0}
										aria-valuemax={100}
									>
										<div className="h-full rounded-full bg-accent" style={{ width: `${masteryRate}%` }} />
									</div>
									{data.mistakes.due > 0 && <p className="mt-3 text-sm text-warning">今天有 {data.mistakes.due} 題待複習</p>}
								</>
							) : (
								<p className="py-6 text-center text-sm text-ink-3">還沒有錯題紀錄</p>
							)}
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
