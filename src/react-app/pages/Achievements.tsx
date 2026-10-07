import { CircleCheck, Trophy } from 'lucide-react';
import { useId } from 'react';
import type { Achievement } from '../../shared/api-types';
import {
	ButtonLink,
	Badge,
	Card,
	CardHeader,
	cn,
	EmptyState,
	ErrorNote,
	PageHeader,
	PageLoader,
	PageStack,
	ProgressBar,
	TextLink,
} from '../components/ui';
import { useAchievements } from '../lib/queries';
import { useUser } from '../lib/account-queries';
import { achievementUnit, formatProgress, groupAchievements, nextMilestone, splitColumns, unlockedDate } from '../lib/achievement-display';
import { AchievementIcon } from '../lib/achievement-icons';

/**
 * 徽章：已解鎖的用藍筆塗滿（accent 底、on-accent 圖示，外圈一圈 accent-soft 像蓋章）；
 * 還沒解鎖的是虛線框、ink-3 圖示，像還沒描上墨的鉛筆稿。狀態另外有文字（「已解鎖」或進度），不只靠顏色。
 */
function Medal({ achievement, size = 'md' }: { achievement: Pick<Achievement, 'icon' | 'unlocked'>; size?: 'md' | 'lg' }) {
	return (
		<span
			aria-hidden
			className={cn(
				'grid shrink-0 place-items-center rounded-full',
				size === 'lg' ? 'size-14 [&_svg]:size-6' : 'size-10 [&_svg]:size-5',
				achievement.unlocked
					? 'bg-accent text-on-accent ring-4 ring-accent-soft'
					: 'border-[1.5px] border-dashed border-line-field bg-card text-ink-3',
			)}
		>
			<AchievementIcon name={achievement.icon} strokeWidth={achievement.unlocked ? 2 : 1.75} />
		</span>
	);
}

/** 進度文字：3.2／10 小時 */
function progressText(a: Achievement) {
	const unit = achievementUnit(a.id);
	return `${formatProgress(a.progress)}／${formatProgress(a.target)}${unit ? ` ${unit}` : ''}`;
}

/** 下一步可以做什麼：依成就種類給一個前往的地方 */
function nextAction(a: Achievement, hasDailyGoal: boolean): { to: string; label: string } {
	if (a.id.startsWith('goal-streak-'))
		return hasDailyGoal ? { to: '/timer', label: '開始專注' } : { to: '/settings', label: '設定每日目標' };
	if (a.id.startsWith('mastered-')) return { to: '/notes?view=review', label: '複習錯題' };
	if (a.id.startsWith('tasks-')) return { to: '/tasks', label: '查看任務' };
	return { to: '/timer', label: '開始專注' };
}

/** 這頁唯一的焦點：最接近解鎖的成就，加上還差多少與一個前往的動作 */
function NextUp({ achievement: a, hasDailyGoal }: { achievement: Achievement; hasDailyGoal: boolean }) {
	const titleId = useId();
	const unit = achievementUnit(a.id);
	const left = Math.max(0, a.target - a.progress);
	const action = nextAction(a, hasDailyGoal);
	const needsGoal = a.id.startsWith('goal-streak-') && !hasDailyGoal;
	return (
		<Card>
			<CardHeader title="下一個目標" />
			<div className="flex flex-col gap-4 px-4 pt-2 pb-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:pb-5">
				<div className="flex min-w-0 flex-1 items-center gap-4">
					<Medal achievement={a} size="lg" />
					<div className="min-w-0 flex-1">
						<h3 id={titleId} className="text-h3 font-semibold text-balance">
							{a.title}
						</h3>
						<p className="text-sm text-ink-2">{a.description}</p>
						<div className="mt-2.5 flex flex-col gap-1.5">
							<ProgressBar value={a.progress} max={a.target} labelledBy={titleId} valueText={progressText(a)} />
							<div className="flex items-baseline justify-between gap-3 text-meta">
								<span className="text-ink-2">
									{needsGoal ? (
										'先設定每日讀書目標才會開始累積'
									) : (
										<>
											還差{' '}
											<span className="font-num font-semibold text-ink tabular-nums">{formatProgress(Math.round(left * 10) / 10)}</span>
											{unit && ` ${unit}`}
										</>
									)}
								</span>
								<span className="shrink-0 font-num text-ink-3 tabular-nums">{progressText(a)}</span>
							</div>
						</div>
					</div>
				</div>
				<ButtonLink to={action.to} variant="primary" className="self-start sm:self-center">
					{action.label}
				</ButtonLink>
			</div>
		</Card>
	);
}

/**
 * 一列成就。已解鎖：「已解鎖」badge，下面是解鎖日期（依使用者時區；開始記錄解鎖時間之前就解鎖的沒有日期）；
 * 還沒解鎖：進度條與「3／25 個」。
 */
function AchievementRow({ achievement: a, hasDailyGoal, timeZone }: { achievement: Achievement; hasDailyGoal: boolean; timeZone: string }) {
	const titleId = useId();
	const needsGoal = a.id.startsWith('goal-streak-') && !hasDailyGoal && !a.unlocked;
	const unlockedOn = a.unlockedAt === null ? null : unlockedDate(a.unlockedAt, timeZone);
	return (
		<li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_11rem] sm:px-5">
			<Medal achievement={a} />
			<div className="min-w-0">
				<h3 id={titleId} className={cn('text-dense font-semibold', a.unlocked ? 'text-ink' : 'text-ink-2')}>
					{a.title}
				</h3>
				<p className="text-meta text-ink-3">{a.description}</p>
				{needsGoal && <TextLink to="/settings">先設定每日目標</TextLink>}
			</div>
			<div className="col-start-2 sm:col-start-3">
				{a.unlocked ? (
					// 手機：日期接在 badge 右邊（不多佔一行）；sm 以上在右欄，badge 下面靠右
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-col sm:items-end">
						<Badge tone="success" icon={<CircleCheck />}>
							已解鎖
						</Badge>
						{unlockedOn && (
							<time dateTime={unlockedOn.dateTime} className="font-num text-meta text-ink-3 tabular-nums">
								{unlockedOn.text}
							</time>
						)}
					</div>
				) : (
					<div className="flex flex-col gap-1">
						<ProgressBar value={a.progress} max={a.target} size="sm" labelledBy={titleId} valueText={progressText(a)} />
						<span className="font-num text-meta text-ink-3 tabular-nums sm:text-right">{progressText(a)}</span>
					</div>
				)}
			</div>
		</li>
	);
}

/** 成就與里程碑（APP-2）：由現有資料即時計算，只有本人看得到，沒有排行榜 */
export function AchievementsPage() {
	const user = useUser();
	const { data, isPending, error, refetch, isRefetching } = useAchievements();
	const hasDailyGoal = user.dailyGoalMinutes != null;

	if (isPending) return <PageLoader />;
	if (error || !data) return <ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
	if (data.length === 0)
		return (
			<div>
				<PageHeader title="成就" />
				<Card>
					<EmptyState
						icon={<Trophy />}
						title="還沒有可以解鎖的成就"
						description="開始記錄讀書時間、完成任務或複習錯題，達到里程碑就會解鎖徽章。"
						action={
							<ButtonLink to="/timer" variant="primary">
								開始專注
							</ButtonLink>
						}
					/>
				</Card>
			</div>
		);

	const unlocked = data.filter((a) => a.unlocked).length;
	const next = nextMilestone(data);
	// 兩欄各自往下堆疊（卡片不必等高）；估計高度＝列數＋標題約 1.5 列
	const columns = splitColumns(groupAchievements(data), (g) => g.items.length + 1.5).filter((c) => c.length > 0);

	return (
		<div>
			<PageHeader
				title="成就"
				description={
					<>
						已解鎖 <span className="font-num font-semibold text-ink tabular-nums">{unlocked}</span>／{data.length} 個
						{data.length > 0 && unlocked === data.length && '，全部達成'}
					</>
				}
			/>

			<PageStack>
				{next && <NextUp achievement={next} hasDailyGoal={hasDailyGoal} />}

				<div className="grid items-start gap-section lg:grid-cols-2">
					{columns.map((column) => (
						<PageStack key={column[0].key} className="min-w-0">
							{column.map((g) => (
								<Card key={g.key}>
									<CardHeader title={g.label} meta={`${g.items.filter((a) => a.unlocked).length}／${g.items.length} 已解鎖`} />
									<ul className="divide-y divide-line">
										{g.items.map((a) => (
											<AchievementRow key={a.id} achievement={a} hasDailyGoal={hasDailyGoal} timeZone={user.timezone} />
										))}
									</ul>
								</Card>
							))}
						</PageStack>
					))}
				</div>

				<p className="text-meta text-ink-3">成就依你目前的紀錄即時計算，只有你看得到；刪除學習紀錄、任務或錯題後，徽章可能會收回。</p>
			</PageStack>
		</div>
	);
}
