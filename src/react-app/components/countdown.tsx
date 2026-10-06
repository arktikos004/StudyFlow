import { AlarmClock, CalendarClock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { addDays } from '../../shared/dates';
import { countdown, type CountdownKind, type CountdownTone } from '../lib/countdown';
import { eventStartMs } from '../lib/dashboard-format';
import { cn, Countdown, NumDisplay } from './ui';

// 倒數磚（DESIGN.md §7「跨頁慣例」）：考試頁、總覽、單科頁共用，規則與文案在 lib/countdown.ts。

const TONE: Record<CountdownTone, string> = {
	urgent: 'bg-danger-soft text-danger',
	soon: 'bg-warning-soft text-warning',
	normal: 'bg-subtle text-ink',
	past: 'bg-subtle text-ink-3',
};

/**
 * 現在時間，每 250ms 更新一次，直到 deadline 為止：跨過 deadline 的那一次更新之後就停（顯示換成「已開始」後不再重新渲染）。
 * deadline 為 null 時不更新。已經過了的 deadline 只會在掛載後更新一次。
 */
function useNowUntil(deadline: number | null): number {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (deadline === null) return;
		const tick = () => {
			const t = Date.now();
			setNow(t);
			if (t >= deadline) {
				clearTimeout(first);
				clearInterval(id);
			}
		};
		const first = setTimeout(tick, 0);
		const id = setInterval(tick, 250);
		return () => {
			clearTimeout(first);
			clearInterval(id);
		};
	}, [deadline]);
	return now;
}

/** 狀態一定是圖示加文字：3 天內的考試是鬧鐘，截止日與任務期限是 CalendarClock */
function ToneIcon({ tone, className }: { tone: CountdownTone; className?: string }) {
	if (tone === 'urgent') return <AlarmClock className={cn('shrink-0', className)} aria-hidden />;
	if (tone === 'soon') return <CalendarClock className={cn('shrink-0', className)} aria-hidden />;
	return null;
}

/**
 * 倒數磚。
 * - size="lg"（預設）：大數字＋下方說明（考試頁的卡片、總覽的下一場考試、單科頁的下一場）。
 *   今天或明天、有時間的項目在 24 小時內改成即時倒數（h:mm:ss），開始後顯示「已開始」。
 * - size="sm"：單行（清單裡）：「今天」「明天」「3 天後」「已結束」，不做即時倒數。
 * 寬度由 className 決定（例如考試頁固定 `w-[5.25rem]`，卡片之間對齊）。
 */
export function CountdownTile({
	kind,
	date,
	time = null,
	today,
	timeZone,
	size = 'lg',
	className,
}: {
	kind: CountdownKind;
	date: string;
	time?: string | null;
	today: string;
	timeZone: string;
	size?: 'lg' | 'sm';
	className?: string;
}) {
	// 只有今天或明天、有時間的項目需要每 250ms 更新（即時倒數），而且只到開始的那一刻為止（review A1）；
	// 其他時候 now 只用在不會變的判斷上
	const start = size === 'lg' ? eventStartMs(date, time, timeZone) : null;
	const ticking = start !== null && date >= today && date <= addDays(today, 1);
	const now = useNowUntil(ticking ? start : null);
	const s = countdown({ kind, date, time }, today, now, timeZone);

	if (size === 'sm')
		return (
			<span
				className={cn(
					'inline-flex h-9 min-w-14 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold whitespace-nowrap',
					TONE[s.tone],
					s.tone === 'normal' && 'text-ink-2',
					className,
				)}
			>
				<ToneIcon tone={s.tone} className="size-3.5" />
				{typeof s.value === 'number' ? (
					<span>
						<span className="font-num tabular-nums">{s.days}</span> 天後
					</span>
				) : (
					s.text
				)}
			</span>
		);

	return (
		<div className={cn('flex min-w-20 shrink-0 flex-col items-center justify-center rounded-lg px-3 py-2.5 text-center', TONE[s.tone], className)}>
			{s.secondsLeft !== null ? (
				<Countdown seconds={s.secondsLeft} size="md" />
			) : typeof s.value === 'number' ? (
				<NumDisplay size="lg">{s.value}</NumDisplay>
			) : (
				<span className="text-h2 font-bold">{s.value}</span>
			)}
			{s.label && (
				<span className={cn('mt-1 inline-flex items-center gap-1 text-meta', s.tone === 'normal' && 'text-ink-2')}>
					<ToneIcon tone={s.tone} className="size-3.5" />
					<span className={cn(/^\d/.test(s.label) && 'font-num tabular-nums')}>{s.label}</span>
				</span>
			)}
		</div>
	);
}
