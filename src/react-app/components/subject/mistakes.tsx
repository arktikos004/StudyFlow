import { Brain, CircleCheck, Clock } from 'lucide-react';
import { useId } from 'react';
import type { SubjectOverview } from '../../../shared/api-types';
import { ButtonLink, Card, CardHeader, EmptyState, Figure, NumDisplay, ProgressBar, TextLink } from '../ui';

/** 錯題卡底部的一句狀態：今天有幾題到期；沒有到期時，全部掌握了就說一聲 */
function MistakesStatus({ due, mastered, total }: SubjectOverview['mistakes']) {
	if (due > 0)
		return (
			<span className="inline-flex items-center gap-1 text-meta font-semibold text-warning">
				<Clock className="size-3.5 shrink-0" aria-hidden />
				今天有 {due} 題待複習
			</span>
		);
	if (mastered === total)
		return (
			<span className="inline-flex items-center gap-1 text-meta font-semibold text-success">
				<CircleCheck className="size-3.5 shrink-0" aria-hidden />
				全部都掌握了
			</span>
		);
	return <span className="text-meta text-ink-3">今天沒有到期的錯題</span>;
}

/** 單科總覽的錯題：總數、已掌握、待複習，掌握程度，以及到考前衝刺複習這一科 */
export function MistakesCard({ mistakes, subjectId, color }: { mistakes: SubjectOverview['mistakes']; subjectId: string; color: string }) {
	const labelId = useId();
	const { total, mastered, due } = mistakes;
	const pct = total ? Math.round((mastered / total) * 100) : 0;
	return (
		<Card>
			<CardHeader title="錯題" icon={Brain} />
			{total === 0 ? (
				<EmptyState
					variant="inline"
					className="pb-4"
					title="還沒有這一科的錯題"
					description="寫錯的題目記下來，考前可以集中複習"
					action={<TextLink to={`/notes?new=mistake&subject=${subjectId}`}>新增錯題</TextLink>}
				/>
			) : (
				<>
					<dl className="grid grid-cols-3">
						<Figure label="總數">
							<NumDisplay unit="題">{total}</NumDisplay>
						</Figure>
						<Figure label="已掌握" className="border-l border-line">
							<NumDisplay unit="題">{mastered}</NumDisplay>
						</Figure>
						<Figure label="待複習" className="border-l border-line">
							<NumDisplay unit="題">{due}</NumDisplay>
						</Figure>
					</dl>
					<div className="space-y-4 border-t border-line px-4 py-4 sm:px-5">
						<div className="space-y-1.5">
							<div className="flex items-baseline justify-between gap-3 text-meta">
								<span id={labelId} className="text-ink-2">
									掌握程度
								</span>
								<span className="font-num text-ink-2 tabular-nums">{pct}%</span>
							</div>
							<ProgressBar
								value={mastered}
								max={total}
								labelledBy={labelId}
								valueText={`已掌握 ${mastered}／${total} 題，${pct}%`}
								color={color}
								size="sm"
							/>
						</div>
						<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
							<MistakesStatus {...mistakes} />
							<ButtonLink to={`/notes?view=review&mode=cram&subject=${subjectId}`}>
								<Brain className="size-4" aria-hidden />
								複習這科
							</ButtonLink>
						</div>
					</div>
				</>
			)}
		</Card>
	);
}
