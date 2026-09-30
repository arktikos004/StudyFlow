import { Brain, CalendarCheck, CircleAlert, CircleCheck, Clock, Flame, Play, RotateCw, Target, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
	DailyStackedBars,
	Heatmap,
	Legend,
	StatStrip,
	SubjectBars,
	TableToggle,
	useSubjectColor,
	WeeklyTaskBars,
	type StatItem,
} from '../components/charts';
import { Duration, MoreLink, Unit } from '../components/dashboard/parts';
import { buildSeries, foldSeries } from '../components/dashboard/series';
import { Badge, Button, Card, CardHeader, cn, EmptyState, ErrorNote, NumDisplay, PageHeader, PageLoader, ProgressBar, Segmented } from '../components/ui';
import { formatDate, formatMinutes } from '../lib/format';
import { useStats, useSubjects } from '../lib/queries';

type Range = '7' | '30' | '90';

const th = 'px-3 py-2 text-left font-semibold whitespace-nowrap text-ink-2';
const td = 'px-3 py-1.5 font-num whitespace-nowrap tabular-nums';

export function StatsPage() {
	const navigate = useNavigate();
	const [range, setRange] = useState<Range>('30');
	const { data, isPending, error, isPlaceholderData, refetch, isRefetching } = useStats(Number(range) as 7 | 30 | 90);
	// 等科目資料也到齊再畫，否則科目名稱會暫時顯示成「已刪除的科目」
	const { data: subjects = [], isPending: subjectsPending } = useSubjects();
	const colorOf = useSubjectColor();
	const [dailyTable, setDailyTable] = useState(false);
	const [weeklyTable, setWeeklyTable] = useState(false);

	if (isPending || subjectsPending) return <PageLoader />;
	if (error)
		return (
			<div className="space-y-3">
				<ErrorNote error={error} />
				<Button onClick={() => refetch()} loading={isRefetching}>
					<RotateCw className="size-4" aria-hidden />
					重新載入
				</Button>
			</div>
		);

	// 系列依科目順序排列，顏色跟著科目走，不因篩選或排名改變；表格檢視用完整的系列
	const totals = new Map(data.bySubject.map((b) => [b.subjectId ?? 'none', b.minutes]));
	const series = buildSeries(totals.keys(), subjects, colorOf);
	// 圖表最多 8 個系列：科目超過 8 個時，取前 7 個，其餘併入「其他」（中性色）
	const chart = foldSeries(series, totals, data.daily, 'var(--chart-rest)');
	const seriesMap = new Map(series.map((s) => [s.key, s]));
	const subjectItems = data.bySubject.map((b) => {
		const s = seriesMap.get(b.subjectId ?? 'none')!;
		return { key: s.key, label: s.label, color: s.color, minutes: b.minutes };
	});

	const goal = data.dailyGoalMinutes;
	const weeklyDue = data.weekly.reduce((n, w) => n + w.due, 0);
	const weeklyDone = data.weekly.reduce((n, w) => n + w.done, 0);
	const masteryRate = data.mistakes.total ? Math.round((data.mistakes.mastered / data.mistakes.total) * 100) : 0;
	const hasStudy = data.totals.minutes > 0;

	const stats: StatItem[] = [
		{
			key: 'total',
			label: '總學習時間',
			icon: <Clock aria-hidden />,
			value: <Duration minutes={data.totals.minutes} />,
			sub: `${data.totals.sessions} 段學習`,
		},
		{
			key: 'avg',
			label: '平均每天',
			icon: <TrendingUp aria-hidden />,
			value: <Duration minutes={data.totals.avgMinutesPerDay} />,
			sub: `${data.range.days} 天中有 ${data.totals.activeDays} 天有讀書`,
		},
		{
			key: 'streak',
			label: '連續學習',
			icon: <Flame aria-hidden />,
			value: (
				<>
					{data.totals.currentStreak}
					<Unit>天</Unit>
				</>
			),
			sub: `最長紀錄 ${data.totals.longestStreak} 天`,
		},
		goal
			? {
					key: 'goal',
					label: '達成每日目標',
					icon: <Target aria-hidden />,
					value: (
						<>
							{data.totals.goalMetDays}
							<Unit>／{data.range.days} 天</Unit>
						</>
					),
					sub: `目標每天 ${formatMinutes(goal)}`,
				}
			: {
					key: 'goal',
					label: '每日目標',
					icon: <Target aria-hidden />,
					value: (
						<MoreLink to="/settings" className="font-sans text-dense">
							設定每日目標
						</MoreLink>
					),
					sub: '設定後會統計達成的天數',
				},
	];

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

			<div className={cn('space-y-6 transition-opacity duration-120', isPlaceholderData && 'opacity-60')}>
				<StatStrip items={stats} />

				<Card>
					<CardHeader
						title="每日學習時間"
						meta={chart.others.length > 0 ? `前 ${chart.series.length - 1} 科與其他` : undefined}
						action={hasStudy && <TableToggle on={dailyTable} onToggle={() => setDailyTable((v) => !v)} />}
					/>
					<div className="px-3 pb-4 sm:px-5">
						{!hasStudy ? (
							<EmptyState
								icon={<Clock />}
								title="這段期間還沒有學習紀錄"
								description="用學習計時或手動補登後，就會出現在這裡。"
								action={
									<Button size="sm" onClick={() => navigate('/timer')}>
										<Play className="size-4" aria-hidden />
										開始專注
									</Button>
								}
							/>
						) : dailyTable ? (
							// 表格檢視維持完整：每一科（含併入「其他」的科目與未分類）各一欄
							<div className="max-h-96 overflow-auto rounded-lg border border-line">
								<table className="w-full text-sm">
									<caption className="caption-bottom px-3 py-2 text-left text-meta text-ink-3">單位：分鐘（— 表示沒有紀錄）</caption>
									<thead className="sticky top-0 bg-subtle">
										<tr>
											<th scope="col" className={th}>
												日期
											</th>
											{series.map((s) => (
												<th key={s.key} scope="col" className={th}>
													{s.label}
												</th>
											))}
											<th scope="col" className={th}>
												合計
											</th>
											{goal ? (
												<th scope="col" className={th}>
													每日目標
												</th>
											) : null}
										</tr>
									</thead>
									<tbody className="divide-y divide-line">
										{[...data.daily].reverse().map((d) => (
											<tr key={d.date}>
												<th scope="row" className={cn(td, 'text-left font-normal text-ink-2')}>
													{formatDate(d.date)}
												</th>
												{series.map((s) => (
													<td key={s.key} className={td}>
														{d.bySubject[s.key] ? Math.round(d.bySubject[s.key]) : '—'}
													</td>
												))}
												<td className={cn(td, 'font-semibold')}>{d.minutes ? Math.round(d.minutes) : '—'}</td>
												{goal ? (
													<td className={cn(td, 'font-sans')}>
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
						) : (
							<>
								<DailyStackedBars data={chart.daily} series={chart.series} today={data.range.to} goal={goal} />
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
						)}
					</div>
				</Card>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader title="各科目學習時間" />
						<div className="px-4 pb-5 sm:px-5">
							{subjectItems.length ? (
								<SubjectBars items={subjectItems} />
							) : (
								<EmptyState variant="inline" className="px-0 sm:px-0" title="這段期間還沒有各科的學習時間" />
							)}
						</div>
					</Card>

					<Card>
						<CardHeader
							title="每週任務完成情況"
							meta={weeklyDue > 0 ? `完成 ${weeklyDone}／${weeklyDue} 項（${Math.round((weeklyDone / weeklyDue) * 100)}%）` : undefined}
							action={weeklyDue > 0 && <TableToggle on={weeklyTable} onToggle={() => setWeeklyTable((v) => !v)} />}
						/>
						<div className="px-3 pb-4 sm:px-5">
							{data.tasks.overdue > 0 && (
								<div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
									<Badge tone="danger" icon={<CircleAlert aria-hidden />}>
										{data.tasks.overdue} 項逾期
									</Badge>
									<MoreLink to="/tasks">處理逾期任務</MoreLink>
								</div>
							)}
							{weeklyDue === 0 ? (
								<EmptyState
									icon={<CalendarCheck />}
									title="這段期間沒有設定期限的任務"
									description="替任務設定期限，就能追蹤每週的完成率。"
								/>
							) : weeklyTable ? (
								<table className="w-full text-sm">
									<caption className="sr-only">每週到期與完成的任務數</caption>
									<thead className="bg-subtle">
										<tr>
											<th scope="col" className={th}>
												週
											</th>
											<th scope="col" className={th}>
												到期
											</th>
											<th scope="col" className={th}>
												完成
											</th>
											<th scope="col" className={th}>
												完成率
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-line">
										{data.weekly.map((w) => (
											<tr key={w.weekStart}>
												<th scope="row" className={cn(td, 'text-left font-normal text-ink-2')}>
													{formatDate(w.weekStart)} 起
												</th>
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

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					<Card className="min-w-0 lg:col-span-2">
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
									<NumDisplay size="lg">{masteryRate}%</NumDisplay>
									<p className="mt-1 text-sm text-ink-2">
										{data.mistakes.total} 題中已掌握 {data.mistakes.mastered} 題
									</p>
									<ProgressBar
										className="mt-4"
										value={data.mistakes.mastered}
										max={data.mistakes.total}
										label="錯題掌握度"
										valueText={`已掌握 ${data.mistakes.mastered}／${data.mistakes.total} 題，${masteryRate}%`}
									/>
									{data.mistakes.due > 0 && (
										<div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
											<span className="inline-flex items-center gap-1.5 text-warning">
												<Clock className="size-4 shrink-0" aria-hidden />
												今天有 {data.mistakes.due} 題待複習
											</span>
											<MoreLink to="/notes?view=review">開始複習</MoreLink>
										</div>
									)}
								</>
							) : (
								<EmptyState
									variant="inline"
									className="px-0 sm:px-0"
									title="還沒有錯題紀錄"
									action={<MoreLink to="/notes?new=mistake">新增第一題錯題</MoreLink>}
								/>
							)}
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
