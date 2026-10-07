import { Clock } from 'lucide-react';
import type { StatsResponse } from '../../../shared/api-types';
import { percent } from '../../lib/format';
import { Card, CardHeader, EmptyState, MoreLink, NumDisplay, ProgressBar } from '../ui';

/** 錯題掌握度：已掌握的比例，今天有到期的題目時提供「開始複習」 */
export function MistakeMasteryCard({ mistakes }: { mistakes: StatsResponse['mistakes'] }) {
	const { total, mastered, due } = mistakes;
	const rate = percent(mastered, total);
	return (
		<Card className="min-w-0">
			<CardHeader title="錯題掌握度" />
			<div className="px-4 pb-5 sm:px-5">
				{total ? (
					<>
						<NumDisplay size="lg">{rate}%</NumDisplay>
						<p className="mt-1 text-sm text-ink-2">
							{total} 題中已掌握 {mastered} 題
						</p>
						<ProgressBar
							className="mt-4"
							value={mastered}
							max={total}
							label="錯題掌握度"
							valueText={`已掌握 ${mastered}／${total} 題，${rate}%`}
						/>
						{due > 0 && (
							<div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
								<span className="inline-flex items-center gap-1.5 text-warning">
									<Clock className="size-4 shrink-0" aria-hidden />
									今天有 {due} 題待複習
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
	);
}
