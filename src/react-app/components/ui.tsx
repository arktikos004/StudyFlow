import clsx, { type ClassValue } from 'clsx';
import { Loader2, X } from 'lucide-react';
import {
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	type ButtonHTMLAttributes,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from 'react';

export const cn = (...args: ClassValue[]) => clsx(args);

// ---- Button ----

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
	size?: 'sm' | 'md' | 'icon';
	loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...props },
	ref,
) {
	return (
		<button
			ref={ref}
			type={type}
			disabled={disabled || loading}
			className={cn(
				'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors select-none disabled:opacity-50',
				size === 'sm' && 'h-8 px-3 text-sm',
				size === 'md' && 'h-10 px-4 text-sm',
				size === 'icon' && 'size-9',
				variant === 'primary' && 'bg-accent text-on-accent hover:bg-accent-hover',
				variant === 'secondary' && 'border border-line bg-card text-ink hover:bg-subtle',
				variant === 'ghost' && 'text-ink-2 hover:bg-subtle hover:text-ink',
				variant === 'danger' && 'bg-danger text-white hover:opacity-90',
				className,
			)}
			{...props}
		>
			{loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
			{children}
		</button>
	);
});

// ---- 表單元件 ----

const fieldBase =
	'w-full rounded-lg border border-line bg-card px-3 text-[15px] text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
	return <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
	{ className, ...props },
	ref,
) {
	return <textarea ref={ref} className={cn(fieldBase, 'min-h-24 py-2 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
	return <select ref={ref} className={cn(fieldBase, 'h-10 pr-8', className)} {...props} />;
});

export function Field({
	label,
	hint,
	error,
	children,
	className,
}: {
	label: string;
	hint?: string;
	error?: string;
	children: (id: string) => ReactNode;
	className?: string;
}) {
	const id = useId();
	return (
		<div className={cn('flex flex-col gap-1.5', className)}>
			<label htmlFor={id} className="text-sm font-medium text-ink-2">
				{label}
			</label>
			{children(id)}
			{error ? (
				<p className="text-sm text-danger" role="alert">
					{error}
				</p>
			) : (
				hint && <p className="text-xs text-ink-3">{hint}</p>
			)}
		</div>
	);
}

// ---- 版面 ----

export function Card({
	className,
	children,
	as: As = 'section',
}: {
	className?: string;
	children: ReactNode;
	as?: 'section' | 'div' | 'article';
}) {
	return <As className={cn('rounded-xl border border-line bg-card shadow-card', className)}>{children}</As>;
}

export function CardHeader({ title, action, icon }: { title: ReactNode; action?: ReactNode; icon?: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
			<h2 className="flex items-center gap-2 text-[15px] font-semibold">
				{icon}
				{title}
			</h2>
			{action}
		</div>
	);
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
	return (
		<header className="mb-5 flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
				{description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</header>
	);
}

export function Badge({
	children,
	tone = 'neutral',
	className,
}: {
	children: ReactNode;
	tone?: 'neutral' | 'accent' | 'danger' | 'success' | 'warning';
	className?: string;
}) {
	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
				tone === 'neutral' && 'bg-subtle text-ink-2',
				tone === 'accent' && 'bg-accent-soft text-accent-ink',
				tone === 'danger' && 'bg-danger-soft text-danger',
				tone === 'success' && 'bg-success-soft text-success',
				tone === 'warning' && 'bg-warning-soft text-warning',
				className,
			)}
		>
			{children}
		</span>
	);
}

export function EmptyState({
	icon,
	title,
	description,
	action,
}: {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
			{icon && <div className="mb-1 text-ink-3 [&_svg]:size-8">{icon}</div>}
			<p className="font-medium">{title}</p>
			{description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}

export function Spinner({ className }: { className?: string }) {
	return <Loader2 className={cn('size-5 animate-spin text-ink-3', className)} aria-label="載入中" />;
}

export function PageLoader() {
	return (
		<div className="flex min-h-40 items-center justify-center">
			<Spinner />
		</div>
	);
}

export function ErrorNote({ error }: { error: unknown }) {
	return (
		<div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
			{error instanceof Error ? error.message : '載入失敗'}
		</div>
	);
}

/** 分段按鈕（例如 7 天 / 30 天 / 90 天） */
export function Segmented<T extends string>({
	value,
	onChange,
	options,
	label,
	className,
}: {
	value: T;
	onChange: (v: T) => void;
	options: { value: T; label: ReactNode }[];
	label: string;
	className?: string;
}) {
	return (
		<div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg border border-line bg-subtle p-0.5', className)}>
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={value === o.value}
					onClick={() => onChange(o.value)}
					className={cn(
						'h-8 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
						value === o.value ? 'bg-card text-ink shadow-card' : 'text-ink-2 hover:text-ink',
					)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

// ---- Dialog（使用原生 <dialog>：內建焦點管理與 Esc 關閉）----

export function Dialog({
	open,
	onClose,
	title,
	children,
	footer,
	wide,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	wide?: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (open && !el.open) el.showModal();
		if (!open && el.open) el.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			onClose={onClose}
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
			onClick={(e) => {
				// 點背景關閉
				if (e.target === ref.current) onClose();
			}}
			className={cn(
				'm-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl border border-line bg-card p-0 shadow-xl',
				'sm:m-auto sm:max-h-[85dvh] sm:rounded-2xl',
				wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
			)}
		>
			{open && (
				<div className="flex max-h-[inherit] flex-col">
					<div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3.5">
						<h2 className="text-base font-semibold">{title}</h2>
						<Button variant="ghost" size="icon" onClick={onClose} aria-label="關閉">
							<X className="size-5" />
						</Button>
					</div>
					<div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
					{footer && (
						<div className="flex justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
							{footer}
						</div>
					)}
				</div>
			)}
		</dialog>
	);
}

/** 用法：const [confirm, confirmDialog] = useConfirm(); if (await confirm({...})) ... ；並渲染 {confirmDialog} */
export function useConfirm() {
	const [state, setState] = useState<{ title: string; message?: string; confirmText?: string; resolve: (v: boolean) => void } | null>(null);

	const confirm = useCallback(
		(opts: { title: string; message?: string; confirmText?: string }) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
		[],
	);
	const close = (v: boolean) => {
		state?.resolve(v);
		setState(null);
	};

	const element = (
		<Dialog
			open={!!state}
			onClose={() => close(false)}
			title={state?.title ?? ''}
			footer={
				<>
					<Button onClick={() => close(false)}>取消</Button>
					<Button variant="danger" onClick={() => close(true)} autoFocus>
						{state?.confirmText ?? '刪除'}
					</Button>
				</>
			}
		>
			<p className="text-sm text-ink-2">{state?.message ?? '刪除後無法復原。'}</p>
		</Dialog>
	);
	return [confirm, element] as const;
}
