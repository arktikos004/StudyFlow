import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';

// 開關與核取方塊（role + aria-checked，觸控範圍 44px）

type ToggleProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** 顯示在右側的文字，也是無障礙名稱；不給的話請給 aria-label */
	label?: ReactNode;
	disabled?: boolean;
	id?: string;
	className?: string;
	'aria-label'?: string;
	'aria-labelledby'?: string;
	'aria-describedby'?: string;
};

/**
 * 開關（role="switch"）。整列可點、至少 44px。
 * description：標籤下方的說明（13px ink-3），以 aria-describedby 連到開關；無障礙名稱仍只有 label。
 */
export function Switch({
	checked,
	onChange,
	label,
	description,
	disabled,
	id,
	className,
	...aria
}: ToggleProps & { description?: ReactNode }) {
	const uid = useId();
	const labelId = `${uid}-label`;
	const descId = `${uid}-desc`;
	const ariaProps = description
		? {
				...aria,
				// 說明放在按鈕裡，名稱改用 aria-labelledby 只取標籤，說明另外用 aria-describedby 報讀
				'aria-labelledby': aria['aria-labelledby'] ?? (label && !aria['aria-label'] ? labelId : undefined),
				'aria-describedby': [aria['aria-describedby'], descId].filter(Boolean).join(' '),
			}
		: aria;
	return (
		<button
			type="button"
			role="switch"
			id={id}
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				'inline-flex min-h-11 min-w-11 gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50',
				description ? 'items-start py-2.5' : 'items-center',
				!label && 'justify-center',
				className,
			)}
			{...ariaProps}
		>
			<span
				aria-hidden
				className={cn(
					'inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-180 ease-out',
					checked ? 'bg-accent' : 'bg-line-field',
				)}
			>
				<span
					className={cn(
						'size-5 rounded-full bg-card shadow-sm transition-transform duration-180 ease-out motion-reduce:transition-none',
						checked && 'translate-x-4',
					)}
				/>
			</span>
			{description ? (
				<span className="flex min-w-0 flex-col gap-0.5">
					{label && (
						<span id={labelId} className="text-dense text-ink">
							{label}
						</span>
					)}
					<span id={descId} className="text-meta text-ink-3">
						{description}
					</span>
				</span>
			) : (
				label && <span className="min-w-0 text-dense text-ink">{label}</span>
			)}
		</button>
	);
}

export function Checkbox({ checked, onChange, label, disabled, id, className, ...aria }: ToggleProps) {
	return (
		<button
			type="button"
			role="checkbox"
			id={id}
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			onKeyDown={(e) => {
				// WAI-ARIA：核取方塊只用空白鍵切換
				if (e.key === 'Enter') e.preventDefault();
			}}
			className={cn(
				'group inline-flex min-h-11 min-w-11 items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50',
				!label && 'justify-center',
				className,
			)}
			{...aria}
		>
			<span
				aria-hidden
				className={cn(
					'grid size-5 shrink-0 place-items-center rounded-sm border-[1.5px] transition-colors duration-180 ease-out',
					checked ? 'border-accent bg-accent text-on-accent' : 'border-line-field bg-card group-hover:border-ink-3',
				)}
			>
				{checked && <Check className="size-3.5" strokeWidth={3} />}
			</span>
			{label && <span className="min-w-0 text-dense text-ink">{label}</span>}
		</button>
	);
}
