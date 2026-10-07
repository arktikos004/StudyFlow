import { ChevronRight, Clock } from 'lucide-react';
import { formatMinutes, splitMinutes } from '../../lib/format';
import { Card, CardHeader, Figure, GoalProgress, NumDisplay } from '../ui';

/** 分鐘數：數字用數字字型、單位用文字字型（2 小時 30 分） */
function MinutesFigure({ minutes }: { minutes: number }) {
	const { hours, minutes: rest } = splitMinutes(minutes);
	if (!hours) return <NumDisplay unit="分鐘">{rest}</NumDisplay>;
	return (
		<span className="inline-flex flex-wrap items-baseline gap-x-1.5">
			<NumDisplay unit="小時">{hours}</NumDisplay>
			{rest > 0 && <NumDisplay unit="分">{rest}</NumDisplay>}
		</span>
	);
}

/** 單科總覽的讀書時間：本週、近 30 天，以及每週目標的進度（還沒設定時提供「設定目標」） */
export function StudyTimeCard({
	week,
	last30,
	goal,
	color,
	onSetGoal,
}: {
	week: number;
	last30: number;
	goal: number | null;
	color: string;
	onSetGoal: () => void;
}) {
	return (
		<Card>
			<CardHeader title="讀書時間" icon={Clock} />
			<dl className="grid grid-cols-2">
				<Figure label="本週" sub="週一起算">
					<MinutesFigure minutes={week} />
				</Figure>
				<Figure label="近 30 天" sub="含今天" className="border-l border-line">
					<MinutesFigure minutes={last30} />
				</Figure>
			</dl>
			<div className="border-t border-line px-4 py-4 sm:px-5">
				{goal ? (
					<GoalProgress label="每週目標" value={week} goal={goal} unit="" format={formatMinutes} color={color} />
				) : (
					<div className="flex flex-wrap items-center justify-between gap-x-3">
						<p className="text-sm text-ink-2">還沒有設定這一科的每週目標</p>
						<button
							type="button"
							onClick={onSetGoal}
							className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-accent-ink hover:underline"
						>
							設定目標
							<ChevronRight className="size-4" aria-hidden />
						</button>
					</div>
				)}
			</div>
		</Card>
	);
}
