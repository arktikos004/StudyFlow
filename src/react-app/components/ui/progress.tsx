import { CircleCheck } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';

// 進度：長條、圓環、目標進度

export type ProgressTone = 'accent' | 'success' | 'warning' | 'danger';

const FILL: Record<ProgressTone, string> = { accent: 'bg-accent', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };

const TRACK: Record<ProgressTone, string> = {
	accent: 'bg-accent-soft',
	success: 'bg-success-soft',
	warning: 'bg-warning-soft',
	danger: 'bg-danger-soft',
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/** 科目色（subjectTone 的 mark）的軌道：同色系淡一階 */
const tintTrack = (color: string) => `color-mix(in oklab, ${color} 20%, var(--subtle))`;

type ProgressProps = {
	value: number;
	max?: number;
	/** 無障礙名稱；或改用 labelledBy 指向畫面上的標籤 id */
	label?: string;
	labelledBy?: string;
	/** 報讀用的文字，例如「45／60 分鐘」 */
	valueText?: string;
	tone?: ProgressTone;
	/** 科目色：傳 subjectTone(...).mark，會取代 tone */
	color?: string;
	className?: string;
};

function progressAria({ value, max = 100, label, labelledBy, valueText }: ProgressProps) {
	return {
		role: 'progressbar' as const,
		'aria-label': labelledBy ? undefined : label,
		'aria-labelledby': labelledBy,
		'aria-valuemin': 0,
		'aria-valuemax': max,
		'aria-valuenow': Math.round(Math.min(max, Math.max(0, value)) * 100) / 100,
		'aria-valuetext': valueText,
	};
}

/** 進度條（role="progressbar"）。填色用 transform 位移，不動畫寬度。 */
export function ProgressBar(props: ProgressProps & { size?: 'sm' | 'md' }) {
	const { value, max = 100, tone = 'accent', color, size = 'md', className } = props;
	const ratio = max > 0 ? clamp01(value / max) : 0;
	return (
		<div
			{...progressAria(props)}
			className={cn('relative w-full overflow-hidden rounded-full', size === 'sm' ? 'h-1.5' : 'h-2.5', !color && TRACK[tone], className)}
			style={color ? { background: tintTrack(color) } : undefined}
		>
			<div
				className={cn(
					'size-full rounded-full transition-transform duration-180 ease-out motion-reduce:transition-none',
					!color && FILL[tone],
				)}
				style={{ transform: `translateX(${(ratio - 1) * 100}%)`, ...(color ? { background: color } : {}) }}
			/>
		</div>
	);
}

/**
 * 進度環（role="progressbar"），children 放在圓心（例如數字或圖示）。trackColor 可在底色與軌道相同時改用別的顏色。
 * children 是純展示：progressbar 的子元素在無障礙樹裡是 presentational，螢幕報讀器不會念，
 * 要報讀的內容請放在 label／valueText；圓心也不要放按鈕、連結等可互動元素。
 */
export function ProgressRing(props: ProgressProps & { size?: number; stroke?: number; trackColor?: string; children?: ReactNode }) {
	const { value, max = 100, tone = 'accent', color, size = 40, stroke = 4, trackColor, className, children } = props;
	const ratio = max > 0 ? clamp01(value / max) : 0;
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	return (
		<div
			{...progressAria(props)}
			className={cn('relative inline-grid shrink-0 place-items-center', className)}
			style={{ width: size, height: size }}
		>
			<svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full -rotate-90" aria-hidden>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					strokeWidth={stroke}
					stroke={trackColor ?? (color ? tintTrack(color) : `var(--${tone}-soft)`)}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					strokeWidth={stroke}
					stroke={color ?? `var(--${tone})`}
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={c * (1 - ratio)}
					opacity={ratio > 0 ? 1 : 0}
					className="transition-[stroke-dashoffset] duration-180 ease-out motion-reduce:transition-none"
				/>
			</svg>
			{children !== undefined && <span className="relative">{children}</span>}
		</div>
	);
}

/** 目標進度：已讀／目標、百分比、達成狀態（達成時圖示加「已達成」）。goal 需大於 0；沒有目標時請改顯示「設定目標」。 */
export function GoalProgress({
	label,
	value,
	goal,
	unit = '分鐘',
	format = (n: number) => String(Math.round(n)),
	color,
	className,
}: {
	label: ReactNode;
	value: number;
	goal: number;
	unit?: string;
	format?: (n: number) => string;
	color?: string;
	className?: string;
}) {
	const labelId = useId();
	const done = goal > 0 && value >= goal;
	const pct = goal > 0 ? Math.round((value / goal) * 100) : 0;
	const suffix = unit ? ` ${unit}` : '';
	return (
		<div className={cn('flex flex-col gap-1.5', className)}>
			<div className="flex items-baseline justify-between gap-3">
				<span id={labelId} className="min-w-0 truncate text-sm text-ink-2">
					{label}
				</span>
				<span className="shrink-0 font-num text-sm tabular-nums">
					<span className="font-semibold text-ink">{format(value)}</span>
					<span className="text-ink-3">
						／{format(goal)}
						{suffix}
					</span>
				</span>
			</div>
			<ProgressBar
				value={value}
				max={goal}
				labelledBy={labelId}
				valueText={`${format(value)}／${format(goal)}${suffix}，${pct}%${done ? '，已達成' : ''}`}
				color={color}
				tone={done ? 'success' : 'accent'}
			/>
			<div className="flex items-center justify-between gap-3 text-meta">
				{done ? (
					<span className="inline-flex items-center gap-1 font-semibold text-success">
						<CircleCheck className="size-3.5" aria-hidden />
						已達成
					</span>
				) : (
					<span className="text-ink-3">
						還差 {format(Math.max(0, goal - value))}
						{suffix}
					</span>
				)}
				<span className="font-num text-ink-2 tabular-nums">{pct}%</span>
			</div>
		</div>
	);
}
