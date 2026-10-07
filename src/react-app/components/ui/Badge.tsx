import { type ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'success' | 'warning' | 'outline';

/** 高 20px、12px 字、圓角 sm。狀態一律圖示加文字（icon 或 children 裡的 svg 會自動縮成 12px）；標籤用 outline。 */
export function Badge({
	children,
	tone = 'neutral',
	icon,
	className,
}: {
	children: ReactNode;
	tone?: BadgeTone;
	icon?: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
				tone === 'neutral' && 'bg-subtle text-ink-2',
				tone === 'accent' && 'bg-accent-soft text-accent-ink',
				tone === 'danger' && 'bg-danger-soft text-danger',
				tone === 'success' && 'bg-success-soft text-success',
				tone === 'warning' && 'bg-warning-soft text-warning',
				tone === 'outline' && 'text-ink-2 ring-1 ring-line-strong ring-inset',
				className,
			)}
		>
			{icon}
			{children}
		</span>
	);
}
