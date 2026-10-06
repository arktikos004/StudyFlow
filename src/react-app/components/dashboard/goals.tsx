import { CircleCheck, Target } from 'lucide-react';
import { useId } from 'react';
import type { DashboardResponse } from '../../../shared/api-types';
import { sortByLag } from '../../lib/dashboard-format';
import { formatMinutes } from '../../lib/format';
import { SubjectTag } from '../subjects';
import { Card, CardHeader, EmptyState, GoalProgress, MoreLink, ProgressBar } from '../ui';
import { useSubjectMark } from './hooks';

type Goals = DashboardResponse['goals'];
type SubjectGoal = Goals['subjects'][number];

/** 今天或本週：有目標時用 GoalProgress，沒有時顯示「設定目標」 */
function Goal({ label, value, goal, missing }: { label: string; value: number; goal: number | null; missing: string }) {
	if (goal && goal > 0) return <GoalProgress label={label} value={value} goal={goal} unit="" format={formatMinutes} />;
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-sm text-ink-2">{label}</span>
			<p className="text-meta text-ink-3">{missing}</p>
			<MoreLink to="/settings#goals" className="self-start">
				設定目標
			</MoreLink>
		</div>
	);
}

/** 一科的每週進度：科目 chip、已讀／目標、科目色的進度條；達成時圖示加「已達成」 */
function SubjectGoalRow({ goal, color }: { goal: SubjectGoal; color?: string }) {
	const labelId = useId();
	const done = goal.minutes >= goal.goalMinutes;
	const pct = Math.round((goal.minutes / goal.goalMinutes) * 100);
	const text = `${formatMinutes(goal.minutes)}／${formatMinutes(goal.goalMinutes)}`;
	return (
		<li>
			<div className="flex items-center justify-between gap-3">
				<span id={labelId} className="flex min-w-0">
					<SubjectTag subjectId={goal.subjectId} />
				</span>
				<span className="shrink-0 font-num text-sm tabular-nums">
					<span className="font-semibold text-ink">{formatMinutes(goal.minutes)}</span>
					<span className="text-ink-3">／{formatMinutes(goal.goalMinutes)}</span>
				</span>
			</div>
			<div className="mt-1.5 flex items-center gap-3">
				<ProgressBar
					className="flex-1"
					size="sm"
					value={goal.minutes}
					max={goal.goalMinutes}
					color={color}
					labelledBy={labelId}
					valueText={`${text}，${pct}%${done ? '，已達成' : ''}`}
				/>
				<span className="w-16 shrink-0 text-right text-meta">
					{done ? (
						<span className="inline-flex items-center gap-1 font-semibold text-success">
							<CircleCheck className="size-3.5 shrink-0" aria-hidden />
							已達成
						</span>
					) : (
						<span className="font-num text-ink-2 tabular-nums">{pct}%</span>
					)}
				</span>
			</div>
		</li>
	);
}

/** 總覽的「讀書目標」：今天與本週的進度（GOAL-1），以及本週各科進度（GOAL-2） */
export function GoalsCard({ goals, todayMinutes, weekMinutes }: { goals: Goals; todayMinutes: number; weekMinutes: number }) {
	const markOf = useSubjectMark();
	const hasAny = !!goals.dailyMinutes || !!goals.weeklyMinutes || goals.subjects.length > 0;
	// 封存的科目 API 已經排除；落後最多的排在最前面
	const subjects = sortByLag(goals.subjects);

	return (
		<Card>
			<CardHeader
				title="讀書目標"
				icon={Target}
				action={
					hasAny && (
						<MoreLink to="/settings#goals" aria-label="調整讀書目標">
							調整
						</MoreLink>
					)
				}
			/>
			{!hasAny ? (
				<EmptyState
					variant="inline"
					className="pb-4 sm:pb-5"
					title="還沒有設定讀書目標"
					description="設定後可以追蹤每天和每週的進度"
					action={<MoreLink to="/settings#goals">設定目標</MoreLink>}
				/>
			) : (
				<div className="px-4 pb-4 sm:px-5 sm:pb-5">
					<div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
						<Goal label="今天" value={todayMinutes} goal={goals.dailyMinutes} missing="還沒有設定每日目標" />
						<Goal label="本週" value={weekMinutes} goal={goals.weeklyMinutes} missing="還沒有設定每週目標" />
					</div>
					{subjects.length > 0 && (
						<section className="mt-5 border-t border-line pt-4">
							<h3 className="text-h3 font-semibold">本週各科進度</h3>
							<p className="text-meta text-ink-3">落後最多的排在最前面</p>
							<ul className="mt-3 space-y-3.5">
								{subjects.map((g) => (
									<SubjectGoalRow key={g.subjectId} goal={g} color={markOf(g.subjectId)} />
								))}
							</ul>
						</section>
					)}
				</div>
			)}
		</Card>
	);
}
