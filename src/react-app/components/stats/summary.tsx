import { Clock, Flame, Target, TrendingUp } from 'lucide-react';
import type { StatsResponse } from '../../../shared/api-types';
import { formatMinutes } from '../../lib/format';
import { StatStrip, type StatItem } from '../charts';
import { Duration, MoreLink, Unit } from '../ui';

/** 每日目標那一格：有設定時是達成的天數，沒有設定時引導去設定 */
function goalItem({ dailyGoalMinutes: goal, totals, range }: StatsResponse): StatItem {
	if (!goal)
		return {
			key: 'goal',
			label: '每日目標',
			icon: <Target aria-hidden />,
			value: (
				<MoreLink to="/settings#goals" className="font-sans text-dense">
					設定每日目標
				</MoreLink>
			),
			sub: '設定後會統計達成的天數',
		};
	return {
		key: 'goal',
		label: '達成每日目標',
		icon: <Target aria-hidden />,
		value: (
			<>
				{totals.goalMetDays}
				<Unit>／{range.days} 天</Unit>
			</>
		),
		sub: `目標每天 ${formatMinutes(goal)}`,
	};
}

/** 統計頁最上面的四格：總學習時間、平均每天、連續學習、每日目標 */
export function StatsSummary({ data }: { data: StatsResponse }) {
	const { totals, range } = data;
	const items: StatItem[] = [
		{
			key: 'total',
			label: '總學習時間',
			icon: <Clock aria-hidden />,
			value: <Duration minutes={totals.minutes} />,
			sub: `${totals.sessions} 段學習`,
		},
		{
			key: 'avg',
			label: '平均每天',
			icon: <TrendingUp aria-hidden />,
			value: <Duration minutes={totals.avgMinutesPerDay} />,
			sub: `${range.days} 天中有 ${totals.activeDays} 天有讀書`,
		},
		{
			key: 'streak',
			label: '連續學習',
			icon: <Flame aria-hidden />,
			value: (
				<>
					{totals.currentStreak}
					<Unit>天</Unit>
				</>
			),
			sub: `最長紀錄 ${totals.longestStreak} 天`,
		},
		goalItem(data),
	];
	return <StatStrip items={items} />;
}
