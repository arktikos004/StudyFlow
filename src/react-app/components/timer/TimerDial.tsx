import { Coffee, Pause, Timer as TimerIcon, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { HOUR_MS } from '../../../shared/time';
import { formatDuration } from '../../lib/format';
import { timerReading, type TimerState } from '../../lib/timer';
import { dialCaption, phaseLabel, progressText, statusText, timerStage, type TimerStage } from '../../lib/timer-display';
import { cn, ProgressRing } from '../ui';

/** 階段名稱前的圖示與顏色：休息用 success */
const PHASE_LOOK: Record<TimerStage, { Icon: LucideIcon; className: string }> = {
	idle: { Icon: TimerIcon, className: 'text-ink-2' },
	running: { Icon: TimerIcon, className: 'text-ink-2' },
	paused: { Icon: Pause, className: 'text-ink-2' },
	'break-ready': { Icon: Coffee, className: 'text-success' },
	break: { Icon: Coffee, className: 'text-success' },
};

/** 計時環的顏色：休息用 success、暫停用 ink-3；其他時候用科目色（疊在 tint 軌道上），沒有科目用 accent */
function ringColor(stage: TimerStage, subjectColor: string | undefined): { tone: 'success' | 'accent' } | { color: string } {
	if (stage === 'break' || stage === 'break-ready') return { tone: 'success' };
	if (stage === 'paused') return { color: 'var(--ink-3)' };
	return subjectColor ? { color: subjectColor } : { tone: 'accent' };
}

/** 專注完成的那一刻（唯一刻意設計的動畫）：完成數改變時加一，用來重播一次動畫 */
function useCompletionCount(s: TimerState): number {
	const completionKey = `${s.cyclesDate}|${s.cycles}`;
	const [seenCompletion, setSeenCompletion] = useState(completionKey);
	const [celebrations, setCelebrations] = useState(0);
	if (completionKey !== seenCompletion) {
		setSeenCompletion(completionKey);
		if (s.cycles > 0) setCelebrations((n) => n + 1);
	}
	return celebrations;
}

/**
 * 計時環：中間是階段、倒數（番茄鐘）或正數（碼錶）的時間與這一輪的長度，外圈是這一輪的進度。
 * subjectColor 是目前科目的 subjectTone(...).mark。
 */
export function TimerDial({ s, now, today, subjectColor }: { s: TimerState; now: number; today: string; subjectColor?: string }) {
	const digitsLabel = useId();
	const celebrations = useCompletionCount(s);
	const stage = timerStage(s);
	const reading = timerReading(s, now);
	const { Icon, className: phaseClassName } = PHASE_LOOK[stage];

	return (
		<>
			<div key={celebrations} className={cn('relative aspect-square w-[min(78vw,20rem)]', celebrations > 0 && 'animate-complete')}>
				<ProgressRing
					value={reading.progress * 100}
					label="本輪進度"
					valueText={progressText(s, reading)}
					size={320}
					stroke={12}
					className="size-full!"
					{...ringColor(stage, subjectColor)}
				/>
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
					<span id={digitsLabel} className={cn('flex items-center gap-1.5 text-sm font-semibold', phaseClassName)}>
						<Icon className="size-4" aria-hidden />
						{phaseLabel(s)}
					</span>
					<span
						role="timer"
						aria-labelledby={digitsLabel}
						className={cn(
							'font-num leading-none font-semibold tracking-[-0.02em] tabular-nums lining-nums [font-stretch:semi-condensed]',
							// 一小時以上多了「時」那一段（h:mm:ss），字級縮小才放得進環裡
							reading.shown >= HOUR_MS ? 'text-[clamp(2.5rem,11vw,4rem)]' : 'text-num-xl',
						)}
					>
						{formatDuration(reading.shown / 1000)}
					</span>
					<span className="text-meta text-ink-3">{dialCaption(s)}</span>
				</div>
			</div>
			<p role="status" className="sr-only">
				{statusText(s, today)}
			</p>
		</>
	);
}
