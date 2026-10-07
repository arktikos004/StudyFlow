import { Coffee, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import { timer, type TimerState } from '../../lib/timer';
import { breakName, timerStage } from '../../lib/timer-display';
import { Button } from '../ui';

/**
 * 計時的操作：準備時「開始」；專注或計時中「暫停／繼續、結束並儲存、放棄」；休息時「開始休息、跳過休息」與一句提醒。
 * 結束與放棄要跳訊息或確認，由頁面處理（onFinish、onDiscard）。
 */
export function TimerControls({ s, onFinish, onDiscard }: { s: TimerState; onFinish: () => void; onDiscard: () => void }) {
	const stage = timerStage(s);
	const isBreak = s.phase === 'break';
	return (
		<>
			<div className="flex flex-wrap justify-center gap-3">
				{stage === 'idle' && (
					<Button variant="primary" size="lg" className="min-w-44" onClick={timer.start}>
						<Play className="size-5" aria-hidden />
						開始{s.mode === 'pomodoro' ? '專注' : '計時'}
					</Button>
				)}
				{s.phase === 'focus' && (
					<>
						{/* 暫停與繼續放在同一個位置：切換時沿用同一個按鈕，鍵盤焦點不會掉 */}
						{s.running ? (
							<Button size="lg" className="min-w-28" onClick={timer.pause}>
								<Pause className="size-5" aria-hidden />
								暫停
							</Button>
						) : (
							<Button variant="primary" size="lg" className="min-w-28" onClick={timer.resume}>
								<Play className="size-5" aria-hidden />
								繼續
							</Button>
						)}
						<Button size="lg" onClick={onFinish}>
							<Square className="size-4" aria-hidden />
							結束並儲存
						</Button>
						<Button variant="ghost" size="lg" onClick={onDiscard}>
							<RotateCcw className="size-4" aria-hidden />
							放棄
						</Button>
					</>
				)}
				{stage === 'break-ready' && (
					<Button variant="primary" size="lg" className="min-w-44" onClick={timer.resume}>
						<Play className="size-5" aria-hidden />
						開始{breakName(s)}
					</Button>
				)}
				{isBreak && (
					<Button size="lg" onClick={timer.skipBreak}>
						<SkipForward className="size-5" aria-hidden />
						跳過休息
					</Button>
				)}
			</div>
			{isBreak && (
				<p className="flex items-center gap-2 text-sm text-ink-2">
					<Coffee className="size-4" aria-hidden />
					站起來走走、喝杯水，讓眼睛休息一下
				</p>
			)}
		</>
	);
}
