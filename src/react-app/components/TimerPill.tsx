import { Timer as TimerIcon, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTimerTitle } from '../lib/document-title';
import { formatDuration } from '../lib/format';
import { timerReading, useNow, useTimerState } from '../lib/timer';
import { cn, ProgressRing } from './ui';

/** 計時中時在頁首顯示剩餘時間，點一下回到計時頁 */
export function TimerPill() {
	const s = useTimerState();
	const now = useNow(s.running);
	const navigate = useNavigate();
	const active = s.phase !== 'idle';

	const { shown } = timerReading(s, now);
	const isBreak = s.phase === 'break';
	const label = isBreak ? (s.breakKind === 'long' ? '長休息' : '休息') : '專注';
	// 休息不能暫停；沒在跑的休息是「自動開始休息」關閉時，等使用者按開始
	const status = s.running ? `${label}中` : isBreak ? `準備${label}` : `${label}暫停`;

	useTimerTitle(active ? `${formatDuration(shown / 1000)} ${status}` : null);

	if (!active) return null;
	return (
		<button
			type="button"
			onClick={() => navigate('/timer')}
			className={cn(
				'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold pointer-coarse:h-11',
				isBreak ? 'bg-success-soft text-success' : 'bg-accent-soft text-accent-ink',
			)}
		>
			<TimerIcon className="size-4" aria-hidden />
			{label} <span className="font-num tabular-nums">{formatDuration(shown / 1000)}</span>
			{!s.running && <span className="text-xs font-normal">（{isBreak ? '待開始' : '暫停'}）</span>}
		</button>
	);
}

/** 手機底部導覽「計時」那格的圖示：計時中顯示即時進度環（裝飾用，時間由頁首的 TimerPill 報讀） */
export function TimerNavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
	const s = useTimerState();
	const now = useNow(s.running);
	const stroke = active ? 2.25 : 1.75;
	if (s.phase === 'idle') return <Icon className="size-[22px]" strokeWidth={stroke} aria-hidden />;
	const { progress } = timerReading(s, now);
	return (
		<span aria-hidden>
			<ProgressRing
				value={progress * 100}
				tone={s.phase === 'break' ? 'success' : 'accent'}
				// 目前頁面的膠囊底就是 accent-soft，軌道改用 card 才看得出來
				trackColor={active ? 'var(--card)' : undefined}
				size={26}
				stroke={2.5}
			>
				<Icon className="size-3.5" strokeWidth={2.25} />
			</ProgressRing>
		</span>
	);
}
