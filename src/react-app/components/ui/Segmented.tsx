import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * 分段按鈕（例如 7 天 / 30 天 / 90 天）。
 * WAI-ARIA radio group：只有選中的項目在 Tab 順序中（roving tabindex），方向鍵循環移動並選取，Home／End 到頭尾。
 * stretch：撐滿容器寬度、每項等寬。
 */
export function Segmented<T extends string>({
	value,
	onChange,
	options,
	label,
	className,
	stretch = false,
}: {
	value: T;
	onChange: (v: T) => void;
	options: { value: T; label: ReactNode; disabled?: boolean }[];
	label: string;
	className?: string;
	stretch?: boolean;
}) {
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const selected = options.findIndex((o) => o.value === value);
	const tabStop = selected >= 0 && !options[selected].disabled ? selected : options.findIndex((o) => !o.disabled);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		const current = refs.current.findIndex((el) => el === document.activeElement);
		if (current < 0) return;
		const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));
		if (!enabled.length) return;
		const pos = Math.max(0, enabled.indexOf(current));
		let next: number;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				next = enabled[(pos + 1) % enabled.length];
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				next = enabled[(pos - 1 + enabled.length) % enabled.length];
				break;
			case 'Home':
				next = enabled[0];
				break;
			case 'End':
				next = enabled[enabled.length - 1];
				break;
			default:
				return;
		}
		e.preventDefault();
		refs.current[next]?.focus();
		onChange(options[next].value);
	};

	return (
		<div
			role="radiogroup"
			aria-label={label}
			onKeyDown={onKeyDown}
			className={cn('gap-0.5 rounded-lg border border-line bg-subtle p-0.5', stretch ? 'flex w-full' : 'inline-flex max-w-full', className)}
		>
			{options.map((o, i) => {
				const checked = i === selected;
				return (
					<button
						key={o.value}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="radio"
						aria-checked={checked}
						tabIndex={i === tabStop ? 0 : -1}
						disabled={o.disabled}
						onClick={() => onChange(o.value)}
						className={cn(
							'inline-flex h-9 min-w-0 items-center justify-center rounded-md px-3 text-sm whitespace-nowrap transition-[color,background-color,box-shadow] duration-180 ease-out pointer-coarse:h-10 disabled:cursor-not-allowed disabled:opacity-50',
							stretch && 'flex-1',
							checked ? 'bg-card text-ink shadow-sm dark:bg-line' : 'text-ink-2 hover:text-ink',
						)}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}
