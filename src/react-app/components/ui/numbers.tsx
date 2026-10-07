import { Fragment, type ReactNode } from 'react';
import { formatDuration } from '../../lib/format';
import { cn } from './cn';

// 數字：數字用數字字型、單位用文字字型

const NUM_SIZE = {
	xl: 'text-num-xl font-semibold tracking-[-0.02em] [font-stretch:semi-condensed]',
	lg: 'text-num-lg font-semibold',
	md: 'text-h2 font-semibold',
	sm: 'text-dense font-semibold',
} as const;

export type NumSize = keyof typeof NUM_SIZE;

/** 數字（Archivo、等寬數字）。xl：計時 clamp(3.5rem,15vw,5.5rem)；lg：統計、倒數 28px。unit 用文字字型、較小。 */
export function NumDisplay({
	children,
	unit,
	size = 'lg',
	className,
}: {
	children: ReactNode;
	unit?: ReactNode;
	size?: NumSize;
	className?: string;
}) {
	return (
		<span className={cn('inline-flex items-baseline gap-1 font-num tabular-nums lining-nums', className)}>
			<span className={NUM_SIZE[size]}>{children}</span>
			{unit && <span className="font-sans text-sm font-normal text-ink-2">{unit}</span>}
		</span>
	);
}

/** 倒數／計時的時間（mm:ss 或 h:mm:ss），role="timer"、數字字型、半窄字寬 */
export function Countdown({ seconds, size = 'xl', className }: { seconds: number; size?: NumSize; className?: string }) {
	return (
		<span role="timer" className={cn('font-num tabular-nums lining-nums [font-stretch:semi-condensed]', NUM_SIZE[size], className)}>
			{formatDuration(Math.max(0, seconds))}
		</span>
	);
}

/** 數字後面的單位：文字字型、14px、ink-2（和 NumDisplay 的 unit 一致）。放在 font-num 的數值裡，例如 `12<Unit>天</Unit>` */
export function Unit({ children }: { children: ReactNode }) {
	return <span className="mr-1.5 ml-1 font-sans text-sm font-normal text-ink-2 last:mr-0">{children}</span>;
}

/** 分鐘數 → [{ value, unit }]：45 分鐘、2 小時、1 小時 20 分 */
function minuteParts(min: number): { value: number; unit: string }[] {
	const m = Math.round(min);
	if (m < 60) return [{ value: m, unit: '分鐘' }];
	const h = Math.floor(m / 60);
	const rest = m % 60;
	return rest
		? [
				{ value: h, unit: '小時' },
				{ value: rest, unit: '分' },
			]
		: [{ value: h, unit: '小時' }];
}

/** 分鐘數：數字沿用外層的數字字型，單位用 Unit（例如放在 StatStrip 的數值裡：1 小時 20 分） */
export function Duration({ minutes }: { minutes: number }) {
	return (
		<>
			{minuteParts(minutes).map((p) => (
				<Fragment key={p.unit}>
					{p.value}
					<Unit>{p.unit}</Unit>
				</Fragment>
			))}
		</>
	);
}

/**
 * 一格數字：dt 標籤（14px ink-2）＋ dd 數值 ＋ 可選的 dd 補充說明（13px ink-3）。
 * 必須放在 <dl> 裡；卡片內用分隔線分格時，第二格起加 `className="border-l border-line"`。
 */
export function Figure({ label, sub, children, className }: { label: string; sub?: string; children: ReactNode; className?: string }) {
	return (
		<div className={cn('min-w-0 px-4 py-3.5 sm:px-5', className)}>
			<dt className="truncate text-sm text-ink-2">{label}</dt>
			<dd className="mt-1">{children}</dd>
			{sub && <dd className="mt-0.5 text-meta text-ink-3">{sub}</dd>}
		</div>
	);
}
