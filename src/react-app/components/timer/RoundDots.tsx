import { roundInfo, type TimerState } from '../../lib/timer';
import { cn } from '../ui';

/** 第 k／N 輪：這一組已完成的番茄是實心圓點，正在進行的那一輪是外框 */
export function RoundDots({ s, today }: { s: TimerState; today: string }) {
	const { done, round, of, filled } = roundInfo(s, today);
	return (
		<div className="flex flex-col items-center gap-2">
			<span className="flex items-center gap-2" aria-hidden>
				{Array.from({ length: of }, (_, i) => (
					<span
						key={i}
						className={cn(
							'size-3 rounded-full transition-colors duration-180 ease-out',
							i < filled
								? 'bg-accent'
								: i === round - 1 && s.phase !== 'break'
									? 'ring-2 ring-accent ring-inset'
									: 'ring-[1.5px] ring-line-strong ring-inset',
						)}
					/>
				))}
			</span>
			<p className="text-sm text-ink-2">
				第 <span className="font-num tabular-nums">{round}</span>／<span className="font-num tabular-nums">{of}</span> 輪，今天完成{' '}
				<span className="font-num tabular-nums">{done}</span> 個番茄
			</p>
		</div>
	);
}
