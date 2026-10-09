import { Clock, Play } from 'lucide-react';
import { useState } from 'react';
import { Heatmap, SubjectBars } from '../components/charts';
import { DailyStudyCard } from '../components/stats/daily';
import { MistakeMasteryCard } from '../components/stats/mistakes';
import { StatsSummary } from '../components/stats/summary';
import { WeeklyTasksCard } from '../components/stats/weekly';
import { ButtonLink, Card, CardHeader, cn, EmptyState, ErrorNote, PageHeader, PageLoader, PageStack, Segmented } from '../components/ui';
import { usePageTitle } from '../lib/document-title';
import { formatDate, formatRange } from '../lib/format';
import { useStats, useSubjects } from '../lib/queries';
import { statsSeries } from '../lib/stats-series';
import { useSubjectColor } from '../lib/subject-color';

/** 統計區間（天）：和 GET /api/stats?days= 接受的值相同 */
const RANGES = ['7', '30', '90'] as const;
type Range = (typeof RANGES)[number];

export function StatsPage() {
	usePageTitle('學習統計');
	const [range, setRange] = useState<Range>('30');
	const { data, isPending, error, isPlaceholderData, refetch, isRefetching } = useStats(Number(range) as 7 | 30 | 90);
	// 等科目資料也到齊再畫，否則科目名稱會暫時顯示成「已刪除的科目」
	const { data: subjects = [], isPending: subjectsPending } = useSubjects();
	const colorOf = useSubjectColor();
	// 圖表或表格檢視：放在頁面，換統計區間（卡片暫時消失再出現）時維持同一種檢視
	const [dailyTable, setDailyTable] = useState(false);
	const [weeklyTable, setWeeklyTable] = useState(false);

	if (isPending || subjectsPending) return <PageLoader />;
	if (error) return <ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />;

	// 系列依科目順序排列，顏色跟著科目走，不因篩選或排名改變；圖表最多 8 個系列，多的併入「其他」（中性色）
	const { series, chart, subjectBars } = statsSeries(data, subjects, colorOf, 'var(--chart-rest)');
	const hasStudy = data.totals.minutes > 0;
	const hasDueTasks = data.weekly.some((w) => w.due > 0);
	// 日期範圍跨年時兩邊都寫年份
	const crossYear = data.range.from.slice(0, 4) !== data.range.to.slice(0, 4);

	return (
		<div>
			<PageHeader
				title="學習統計"
				description={formatRange(formatDate(data.range.from, crossYear), formatDate(data.range.to, crossYear))}
			/>

			{/* 篩選器放在所有圖表上方，一次套用到全部；篩選列到內容一律 mb-5（跨頁慣例） */}
			<div className="mb-5">
				<Segmented
					label="統計區間"
					value={range}
					onChange={setRange}
					options={RANGES.map((days) => ({ value: days, label: `近 ${days} 天` }))}
				/>
			</div>

			<PageStack className={cn('transition-opacity duration-120', isPlaceholderData && 'opacity-60')}>
				<StatsSummary data={data} />

				{/* 這段期間沒有學習紀錄：每日、各科、熱度圖都是空的，只放一個空狀態（不重複三次） */}
				{!hasStudy && (
					<Card>
						<EmptyState
							icon={<Clock />}
							title="這段期間還沒有學習紀錄"
							description="用學習計時或手動補登後，每日與各科的學習時間、學習熱度就會出現在這裡。"
							action={
								<ButtonLink to="/timer" variant="primary">
									<Play className="size-4" aria-hidden />
									開始專注
								</ButtonLink>
							}
						/>
					</Card>
				)}

				{hasStudy && (
					<DailyStudyCard
						daily={data.daily}
						series={series}
						chart={chart}
						goal={data.dailyGoalMinutes}
						today={data.range.to}
						table={dailyTable}
						onToggleTable={() => setDailyTable((v) => !v)}
					/>
				)}

				{(hasStudy || hasDueTasks) && (
					<div className={cn('grid grid-cols-1 items-start gap-section', hasStudy && 'lg:grid-cols-2')}>
						{hasStudy && (
							<Card>
								<CardHeader title="各科目學習時間" />
								<div className="px-4 pb-5 sm:px-5">
									{subjectBars.length ? (
										<SubjectBars items={subjectBars} />
									) : (
										<EmptyState variant="inline" flush title="這段期間還沒有各科的學習時間" />
									)}
								</div>
							</Card>
						)}
						<WeeklyTasksCard
							weekly={data.weekly}
							overdue={data.tasks.overdue}
							table={weeklyTable}
							onToggleTable={() => setWeeklyTable((v) => !v)}
						/>
					</div>
				)}

				{(hasStudy || data.mistakes.total > 0) && (
					<div className={cn('grid grid-cols-1 items-start gap-section', hasStudy && 'lg:grid-cols-3')}>
						{hasStudy && (
							<Card className="min-w-0 lg:col-span-2">
								<CardHeader title="學習熱度" meta="近 16 週" />
								<div className="px-4 pb-4 sm:px-5">
									<Heatmap data={data.heatmap} today={data.range.to} />
								</div>
							</Card>
						)}
						<MistakeMasteryCard mistakes={data.mistakes} />
					</div>
				)}
			</PageStack>
		</div>
	);
}
