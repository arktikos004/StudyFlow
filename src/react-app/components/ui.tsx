import clsx, { type ClassValue } from 'clsx';
import { Check, ChevronDown, CircleAlert, CircleCheck, Loader2, Minus, X } from 'lucide-react';
import {
	cloneElement,
	forwardRef,
	isValidElement,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type ButtonHTMLAttributes,
	type InputHTMLAttributes,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from 'react';
import { formatDuration } from '../lib/format';

export const cn = (...args: ClassValue[]) => clsx(args);

// 元件的預設樣式（.sf-btn、.sf-field…）定義在 index.css 的 @layer components，
// 頁面傳進來的 className（工具類）一定蓋得過，不需要 tailwind-merge。

// ---- Button ----

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	/** 載入中：保留文字、前面加上轉圈圖示、aria-busy，並暫停點擊 */
	loading?: boolean;
};

/**
 * 高度 40px（觸控裝置 44px）、圓角 lg、15px；primary 與 danger 字重 600。
 * 按下時下沉 1px 並加深填色。只有圖示的按鈕（size="icon"）一定要給 aria-label。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = 'secondary', size = 'md', loading, disabled, className, children, type = 'button', ...props },
	ref,
) {
	return (
		<button
			ref={ref}
			type={type}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			className={cn('sf-btn', `sf-btn-${variant}`, size !== 'md' && `sf-btn-${size}`, className)}
			{...props}
		>
			{loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
			{loading && size === 'icon' ? null : children}
		</button>
	);
});

// ---- 表單元件 ----

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
	return <input ref={ref} className={cn('sf-field sf-input', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
	{ className, ...props },
	ref,
) {
	return <textarea ref={ref} className={cn('sf-field sf-textarea', className)} {...props} />;
});

/** 原生 select 加上 ChevronDown。className 套在外層容器（寬度、版面），select 本身填滿容器。 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
	return (
		<div className={cn('relative', className)}>
			<select ref={ref} className="sf-field sf-select" {...props} />
			<ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
		</div>
	);
});

/** Field 傳給欄位的無障礙屬性：提示或錯誤訊息的 id，以及錯誤狀態 */
export type FieldAria = { 'aria-describedby'?: string; 'aria-invalid'?: true };

/**
 * 標籤 + 欄位 + 提示／錯誤。
 * children 可以是 `(id, aria) => <Input id={id} {...aria} />`（建議），或舊寫法 `(id) => <Input id={id} />`：
 * 舊寫法會自動把 aria 屬性補到回傳的元素上（元素本身已指定的不覆蓋）。
 */
export function Field({
	label,
	hint,
	error,
	children,
	className,
}: {
	label: ReactNode;
	hint?: ReactNode;
	error?: ReactNode;
	children: (id: string, aria: FieldAria) => ReactNode;
	className?: string;
}) {
	const id = useId();
	const noteId = `${id}-note`;
	const aria: FieldAria = {};
	if (error || hint) aria['aria-describedby'] = noteId;
	if (error) aria['aria-invalid'] = true;
	let control = children(id, aria);
	if (children.length < 2 && isValidElement<Record<string, unknown>>(control)) {
		const props = control.props;
		control = cloneElement(control, Object.fromEntries(Object.entries(aria).filter(([k]) => props[k] === undefined)));
	}
	return (
		<div className={cn('flex flex-col gap-1.5', className)}>
			<label htmlFor={id} className="text-sm font-semibold text-ink-2">
				{label}
			</label>
			{control}
			{error ? (
				<p id={noteId} className="flex items-start gap-1.5 text-meta text-danger" role="alert">
					<CircleAlert className="mt-[3px] size-3.5 shrink-0" aria-hidden />
					<span>{error}</span>
				</p>
			) : (
				hint && (
					<p id={noteId} className="text-meta text-ink-3">
						{hint}
					</p>
				)
			)}
		</div>
	);
}

// ---- 版面 ----

/**
 * 卡片：圓角 xl、邊框 line、陰影 sm。卡片裡不放卡片。
 * variant：inset（內嵌、subtle 底，無邊框陰影）、plain（只有邊框，無陰影）。
 * interactive：整張可點的卡片才加（hover 時邊框加深、陰影 md）；靜態卡片不要 hover 效果。
 */
export function Card({
	className,
	children,
	as: As = 'section',
	variant = 'default',
	interactive = false,
}: {
	className?: string;
	children: ReactNode;
	as?: 'section' | 'div' | 'article' | 'li';
	variant?: 'default' | 'inset' | 'plain';
	interactive?: boolean;
}) {
	return (
		<As
			className={cn(
				'rounded-xl',
				variant === 'default' && 'border border-line bg-card shadow-sm',
				variant === 'plain' && 'border border-line bg-card',
				variant === 'inset' && 'bg-subtle',
				interactive &&
					(variant === 'inset'
						? 'transition-colors duration-120 ease-out hover:bg-line'
						: 'transition-[border-color,box-shadow] duration-120 ease-out hover:border-line-strong hover:shadow-md'),
				className,
			)}
		>
			{children}
		</As>
	);
}

/** 卡片標題（h2）＋ 可選的 meta（例如「3 項」）＋ 右側動作（文字加 ChevronRight） */
export function CardHeader({ title, action, icon, meta }: { title: ReactNode; action?: ReactNode; icon?: ReactNode; meta?: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
			<div className="flex min-w-0 items-center gap-2">
				{icon}
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<h2 className="text-h2 font-semibold text-balance">{title}</h2>
					{meta && <span className="text-meta text-ink-3">{meta}</span>}
				</div>
			</div>
			{action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
		</div>
	);
}

/** 頁面標題（h1）＋ 即時摘要（或什麼都不放）＋ 動作 */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
	return (
		<header className="mb-6 flex flex-wrap items-end justify-between gap-3">
			<div className="min-w-0">
				<h1 className="text-[1.375rem] leading-[1.3] font-bold text-balance sm:text-h1">{title}</h1>
				{description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</header>
	);
}

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'success' | 'warning' | 'outline';

/** 高 20px、12px 字、圓角 sm。狀態一律圖示加文字（icon 或 children 裡的 svg 會自動縮成 12px）；標籤用 outline。 */
export function Badge({ children, tone = 'neutral', icon, className }: { children: ReactNode; tone?: BadgeTone; icon?: ReactNode; className?: string }) {
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

/**
 * 空狀態。page 版：圖示圓、標題、一句邀請、primary 動作；inline 版：一行文字加 ghost 動作。
 * 文案用動詞開頭的邀請（「新增第一題錯題」），不要只寫「沒有資料」。
 */
export function EmptyState({
	icon,
	title,
	description,
	action,
	variant = 'page',
	className,
}: {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	variant?: 'page' | 'inline';
	className?: string;
}) {
	if (variant === 'inline')
		return (
			<div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 sm:px-5', className)}>
				<p className="min-w-0 text-sm text-ink-2">
					{title}
					{description && <span className="text-ink-3">，{description}</span>}
				</p>
				{action}
			</div>
		);
	return (
		<div className={cn('flex flex-col items-center justify-center gap-1 px-6 py-10 text-center', className)}>
			{icon && (
				<div className="mb-2 grid size-12 place-items-center rounded-full bg-subtle text-ink-3 [&_svg]:size-6" aria-hidden>
					{icon}
				</div>
			)}
			<p className="text-h3 font-semibold text-ink">{title}</p>
			{description && <p className="max-w-sm text-sm text-pretty text-ink-2">{description}</p>}
			{action && <div className="mt-3">{action}</div>}
		</div>
	);
}

export function Spinner({ className }: { className?: string }) {
	return <Loader2 className={cn('size-5 animate-spin text-ink-3', className)} role="img" aria-label="載入中" />;
}

/** 整頁載入：延遲 150ms 才顯示轉圈，快的請求不會閃一下 */
export function PageLoader() {
	const [show, setShow] = useState(false);
	useEffect(() => {
		const t = setTimeout(() => setShow(true), 150);
		return () => clearTimeout(t);
	}, []);
	return (
		<div className="flex min-h-40 items-center justify-center" role="status">
			{show && <Spinner />}
		</div>
	);
}

export function ErrorNote({ error }: { error: unknown }) {
	return (
		<div className="flex items-start gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
			<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
			<span>{error instanceof Error ? error.message : '載入失敗'}</span>
		</div>
	);
}

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

// ---- Dialog（使用原生 <dialog>：內建焦點管理與 Esc 關閉）----

/**
 * 放在對話框內容的最前面：在子元件的 autoFocus 執行之前先 showModal()，autoFocus 才會生效。
 * （React 的 layout 階段依樹狀順序處理，這個元件比後面的內容先執行。）
 */
function OpenBeforeContent() {
	const ref = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		const dialog = ref.current?.closest('dialog');
		if (dialog && !dialog.open) dialog.showModal();
	}, []);
	return <span ref={ref} hidden />;
}

const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * 對話框：小於 sm 是由下滑入的 bottom sheet（拖曳把手往下拉可關閉），sm 以上置中。
 * - aria-labelledby 指向標題；Esc、點背景、關閉鈕都會呼叫 onClose。
 * - 關閉後內容會卸載（表單靠這個重設狀態）；進場動畫只在打開時播放。
 * - 觸控裝置不自動 focus（避免跳出鍵盤），焦點放在對話框本身；其他裝置照常套用 autoFocus。
 */
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
	const titleId = useId();
	const [coarse] = useState(isCoarsePointer);
	const downOnBackdrop = useRef(false);
	const drag = useRef<{ y: number; dy: number; t: number } | null>(null);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (open && !el.open) {
			el.showModal();
			if (coarse) el.focus();
		}
		if (!open && el.open) el.close();
	}, [open, coarse]);

	const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
		const el = ref.current;
		if (!el) return;
		drag.current = { y: e.clientY, dy: 0, t: e.timeStamp };
		e.currentTarget.setPointerCapture(e.pointerId);
		el.style.transition = 'none';
	};
	const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
		const d = drag.current;
		if (!d || !ref.current) return;
		d.dy = Math.max(0, e.clientY - d.y);
		ref.current.style.transform = `translateY(${d.dy}px)`;
	};
	const onHandleEnd = (e: PointerEvent<HTMLDivElement>) => {
		const d = drag.current;
		const el = ref.current;
		drag.current = null;
		if (!d || !el) return;
		el.style.transition = '';
		el.style.transform = '';
		const fast = d.dy / Math.max(1, e.timeStamp - d.t) > 0.5;
		if (d.dy > 80 || (fast && d.dy > 24)) onClose();
	};

	return (
		<dialog
			ref={ref}
			aria-labelledby={titleId}
			tabIndex={-1}
			onClose={onClose}
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
			onPointerDown={(e) => {
				downOnBackdrop.current = e.target === e.currentTarget;
			}}
			onClick={(e) => {
				// 點背景關閉（按下與放開都在背景上才算，拖選文字到外面不會誤關）
				if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
				downOnBackdrop.current = false;
			}}
			className={cn(
				'sf-dialog m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl border border-b-0 border-line bg-card p-0 text-ink shadow-lg outline-none',
				'sm:m-auto sm:max-h-[85dvh] sm:rounded-2xl sm:border-b',
				wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
			)}
		>
			{open && (
				<div className="flex max-h-[inherit] flex-col">
					{!coarse && <OpenBeforeContent />}
					<div
						className="flex h-5 shrink-0 cursor-grab touch-none items-end justify-center sm:hidden"
						onPointerDown={onHandleDown}
						onPointerMove={onHandleMove}
						onPointerUp={onHandleEnd}
						onPointerCancel={onHandleEnd}
						aria-hidden
					>
						<span className="h-1 w-10 rounded-full bg-line-strong" />
					</div>
					<div className="flex items-center justify-between gap-2 border-b border-line py-2.5 pr-3 pl-5 sm:py-3">
						<h2 id={titleId} className="text-h2 font-semibold text-balance">
							{title}
						</h2>
						<Button variant="ghost" size="icon" onClick={onClose} aria-label="關閉">
							<X className="size-5" />
						</Button>
					</div>
					<div className={cn('flex-1 overflow-y-auto overscroll-contain px-5 py-4', !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))]')}>
						{children}
					</div>
					{footer && (
						<div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
					{/* 破壞性操作：預設焦點放在「取消」，避免連按 Enter 就刪除 */}
					<Button onClick={() => close(false)} autoFocus>
						取消
					</Button>
					<Button variant="danger" onClick={() => close(true)}>
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

// ---- 進度 ----

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
				className={cn('size-full rounded-full transition-transform duration-180 ease-out motion-reduce:transition-none', !color && FILL[tone])}
				style={{ transform: `translateX(${(ratio - 1) * 100}%)`, ...(color ? { background: color } : {}) }}
			/>
		</div>
	);
}

/** 進度環（role="progressbar"），children 放在圓心（例如數字或圖示）。 */
export function ProgressRing(props: ProgressProps & { size?: number; stroke?: number; children?: ReactNode }) {
	const { value, max = 100, tone = 'accent', color, size = 40, stroke = 4, className, children } = props;
	const ratio = max > 0 ? clamp01(value / max) : 0;
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	return (
		<div {...progressAria(props)} className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
			<svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full -rotate-90" aria-hidden>
				<circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={color ? tintTrack(color) : `var(--${tone}-soft)`} />
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

// ---- 開關與核取方塊（role + aria-checked，觸控範圍 44px） ----

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

export function Switch({ checked, onChange, label, disabled, id, className, ...aria }: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			id={id}
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				'inline-flex min-h-11 min-w-11 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50',
				!label && 'justify-center',
				className,
			)}
			{...aria}
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
			{label && <span className="min-w-0 text-dense text-ink">{label}</span>}
		</button>
	);
}

export function Checkbox({ checked, onChange, label, disabled, id, className, indeterminate, ...aria }: ToggleProps & { indeterminate?: boolean }) {
	const on = checked || indeterminate;
	return (
		<button
			type="button"
			role="checkbox"
			id={id}
			aria-checked={indeterminate ? 'mixed' : checked}
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
					on ? 'border-accent bg-accent text-on-accent' : 'border-line-field bg-card group-hover:border-ink-3',
				)}
			>
				{indeterminate ? <Minus className="size-3.5" strokeWidth={3} /> : checked && <Check className="size-3.5" strokeWidth={3} />}
			</span>
			{label && <span className="min-w-0 text-dense text-ink">{label}</span>}
		</button>
	);
}

// ---- 文字小元件 ----

/** 用 <mark>（螢光筆黃）標出關鍵字；query 以空白分隔多個關鍵字，不分大小寫，支援中文子字串 */
export function Highlight({ text, query, className }: { text: string; query: string | readonly string[]; className?: string }) {
	const terms = (typeof query === 'string' ? query.split(/\s+/) : query).map((t) => t.trim()).filter(Boolean);
	if (!text || !terms.length) return <>{text}</>;
	const pattern = terms
		.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.sort((a, b) => b.length - a.length)
		.join('|');
	const parts = text.split(new RegExp(`(${pattern})`, 'giu'));
	return (
		<>
			{parts.map((p, i) =>
				i % 2 === 1 ? (
					<mark key={i} className={className}>
						{p}
					</mark>
				) : (
					p
				),
			)}
		</>
	);
}

/** 鍵盤按鍵，例如 <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<kbd
			className={cn(
				'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-card px-1 font-num text-caption leading-none text-ink-2 shadow-[inset_0_-1px_0_var(--line-strong)]',
				className,
			)}
		>
			{children}
		</kbd>
	);
}

const NUM_SIZE = {
	xl: 'text-num-xl font-semibold tracking-[-0.02em] [font-stretch:semi-condensed]',
	lg: 'text-num-lg font-semibold',
	md: 'text-h2 font-semibold',
	sm: 'text-dense font-semibold',
} as const;
export type NumSize = keyof typeof NUM_SIZE;

/** 數字（Archivo、等寬數字）。xl：計時 clamp(3.5rem,15vw,5.5rem)；lg：統計、倒數 28px。unit 用文字字型、較小。 */
export function NumDisplay({ children, unit, size = 'lg', className }: { children: ReactNode; unit?: ReactNode; size?: NumSize; className?: string }) {
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
