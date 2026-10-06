import clsx, { type ClassValue } from 'clsx';
import {
	ChartColumn,
	Check,
	ChevronDown,
	ChevronRight,
	CircleAlert,
	CircleCheck,
	Loader2,
	Minus,
	RotateCw,
	Search,
	Table2,
	X,
	type LucideIcon,
} from 'lucide-react';
import {
	cloneElement,
	createElement,
	forwardRef,
	Fragment,
	isValidElement,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
	type ButtonHTMLAttributes,
	type HTMLAttributes,
	type InputHTMLAttributes,
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from 'react';
import { Link, type LinkProps } from 'react-router';
import { formatDuration } from '../lib/format';

export const cn = (...args: ClassValue[]) => clsx(args);

// 元件的預設樣式（.sf-btn、.sf-field…）定義在 index.css 的 @layer components，
// 頁面傳進來的 className（工具類）一定蓋得過，不需要 tailwind-merge。

// ---- 圖示 prop ----

/**
 * 元件的 icon prop：傳 lucide 元件（`icon={Clock}`，建議）由元件決定大小與顏色；
 * 傳已經組好的元素（`icon={<Clock className="…" aria-hidden />}`）則照原樣顯示，大小與顏色由呼叫端負責。
 */
export type IconProp = LucideIcon | ReactNode;

const COMPONENT_TYPES: ReadonlySet<unknown> = new Set([Symbol.for('react.forward_ref'), Symbol.for('react.memo'), Symbol.for('react.lazy')]);

/** 傳進來的是「元件」而不是元素嗎？lucide 的圖示是 forwardRef 物件（不是函式），所以兩種都要認 */
function isIconComponent(icon: IconProp): icon is LucideIcon {
	if (typeof icon === 'function') return true;
	return typeof icon === 'object' && icon !== null && COMPONENT_TYPES.has((icon as { $$typeof?: unknown }).$$typeof);
}

/** icon 是元件時套上元件決定的 class 並加 aria-hidden；是元素時原樣回傳 */
function renderIcon(icon: IconProp, className: string): ReactNode {
	return isIconComponent(icon) ? createElement(icon, { className, 'aria-hidden': true }) : icon;
}

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

/**
 * 看起來像按鈕的導覽連結（語意是 <a>：可以用新分頁開啟、中鍵點擊）。外觀、尺寸、按下回饋與 Button 相同。
 * 會「前往另一頁」的動作用 ButtonLink；在原地執行的動作（儲存、刪除、開對話框）用 Button。
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, LinkProps & { variant?: ButtonVariant; size?: ButtonSize }>(function ButtonLink(
	{ variant = 'secondary', size = 'md', className, ...props },
	ref,
) {
	return <Link ref={ref} className={cn('sf-btn', `sf-btn-${variant}`, size !== 'md' && `sf-btn-${size}`, className)} {...props} />;
});

/**
 * 文字連結＋ChevronRight（連結後面不加「→」）：accent-ink、14px、600。
 * min-h-11 撐出 44px 的點擊高度（會佔版面）；放在卡片標題列的請改用 MoreLink。
 */
export function TextLink({ children, className, ...props }: LinkProps) {
	return (
		<Link
			className={cn('inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-semibold text-accent-ink hover:underline', className)}
			{...props}
		>
			{children}
			<ChevronRight className="size-4 shrink-0" aria-hidden />
		</Link>
	);
}

/**
 * CardHeader 右側的「查看全部」連結：文字加 ChevronRight，14px、400。
 * 外觀不佔額外高度，點擊範圍用 ::after 擴大到 44px：往上 16px、往下 8px
 * （CardHeader 下方只有 pb-2，往下擴大太多會蓋到卡片第一列的按鈕）。
 */
export function MoreLink({ children, className, ...props }: LinkProps) {
	return (
		<Link
			className={cn(
				"relative inline-flex shrink-0 items-center gap-0.5 rounded-sm text-sm whitespace-nowrap text-accent-ink after:absolute after:-inset-x-1 after:-top-4 after:-bottom-2 after:content-[''] hover:underline",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronRight className="size-4 shrink-0" aria-hidden />
		</Link>
	);
}

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

/** Field 的版型：stacked（預設）標籤在上、欄位在下；inline 標籤與提示在左、欄位在右（設定列、短數字欄位） */
export type FieldLayout = 'stacked' | 'inline';

/**
 * 標籤 + 欄位 + 提示／錯誤。
 * children 可以是 `(id, aria) => <Input id={id} {...aria} />`（建議），或舊寫法 `(id) => <Input id={id} />`：
 * 舊寫法會自動把 aria 屬性補到回傳的元素上（元素本身已指定的不覆蓋）。
 * layout="inline"：標籤與提示／錯誤在左欄、欄位在右欄並垂直置中；右欄寬度由欄位決定，請給欄位寬度（例如 `className="w-24"`）。
 */
export function Field({
	label,
	hint,
	error,
	children,
	className,
	layout = 'stacked',
}: {
	label: ReactNode;
	hint?: ReactNode;
	error?: ReactNode;
	children: (id: string, aria: FieldAria) => ReactNode;
	className?: string;
	layout?: FieldLayout;
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
	const labelEl = (
		<label htmlFor={id} className="text-sm font-semibold text-ink-2">
			{label}
		</label>
	);
	const note = error ? (
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
	);
	if (layout === 'inline')
		return (
			<div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4', className)}>
				<div className="flex min-w-0 flex-col gap-0.5">
					{labelEl}
					{note}
				</div>
				{control}
			</div>
		);
	return (
		<div className={cn('flex flex-col gap-1.5', className)}>
			{labelEl}
			{control}
			{note}
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

/**
 * 卡片標題（h2）＋ 可選的 meta（例如「3 項」）＋ 右側動作（文字加 ChevronRight）。
 * icon：傳 lucide 元件（`icon={Clock}`）時統一 18px、ink-3；傳元素時照原樣顯示。
 * 同一頁的卡片要嘛都有圖示、要嘛都沒有；附註放 meta，不寫在標題的括號裡。
 */
export function CardHeader({ title, action, icon, meta }: { title: ReactNode; action?: ReactNode; icon?: IconProp; meta?: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
			<div className="flex min-w-0 items-center gap-2">
				{renderIcon(icon, 'size-[18px] shrink-0 text-ink-3')}
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<h2 className="text-h2 font-semibold text-balance">{title}</h2>
					{meta && <span className="text-meta text-ink-3">{meta}</span>}
				</div>
			</div>
			{action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
		</div>
	);
}

/**
 * 頁面標題（h1）＋ 即時摘要（或什麼都不放）＋ 動作。下方自帶區塊間距（手機 24、桌面 32）。
 * - eyebrow：標題上方的小字（13px ink-2），例如總覽的日期。
 * - actionsClassName：套在動作列上，例如手機撐滿寬度 `w-full sm:w-auto`（裡面的主要按鈕再加 `flex-1 sm:flex-none`）。
 */
export function PageHeader({
	title,
	description,
	actions,
	eyebrow,
	className,
	actionsClassName,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	eyebrow?: ReactNode;
	className?: string;
	actionsClassName?: string;
}) {
	return (
		<header className={cn('mb-section flex flex-wrap items-end justify-between gap-3', className)}>
			<div className="min-w-0">
				{eyebrow && <p className="mb-1 text-meta text-ink-2">{eyebrow}</p>}
				<h1 className="text-[1.375rem] leading-[1.3] font-bold text-balance sm:text-h1">{title}</h1>
				{description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
			</div>
			{actions && <div className={cn('flex flex-wrap gap-2', actionsClassName)}>{actions}</div>}
		</header>
	);
}

/**
 * 頁面裡區塊與區塊之間的直向間距（DESIGN.md §5：手機 24、桌面 32，讀 --section-gap）。
 * 兩欄以上的格線用工具類 `gap-section`，欄內再用 PageStack。卡片內部的間距不要用它。
 */
export function PageStack({ as: As = 'div', className, ...props }: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' }) {
	return <As className={cn('space-y-section', className)} {...props} />;
}

export type SectionLabelTone = 'neutral' | 'danger' | 'warning' | 'success';
const LABEL_TONE: Record<SectionLabelTone, string | false> = { neutral: false, danger: 'text-danger', warning: 'text-warning', success: 'text-success' };

/**
 * 小標：卡片外的分組標題（「已釘選 2」「已逾期 1」）或卡片內的欄位小標（「題目」「正確答案」）。600、ink-2。
 * - as：標題層級，預設 h2；卡片或對話框裡的欄位小標用 h3。
 * - size：meta（13px，預設）或 sm（14px）。
 * - icon：lucide 元件時 16px（neutral 是 ink-3，其他語氣跟著語氣色）；元素時照原樣顯示，只統一成 16px。
 * - tone：圖示與文字一起變色（已逾期 danger、今天 warning、已完成 success），狀態仍然是圖示加文字。
 * - count：後面的數量（數字字型、ink-3）；報讀成「，N 項」，單位用 countUnit 改（「則」「題」）。
 * 間距由呼叫端決定（`className="mb-2 px-1"`）。
 */
export function SectionLabel({
	as: As = 'h2',
	size = 'meta',
	tone = 'neutral',
	icon,
	count,
	countUnit = '項',
	id,
	className,
	children,
}: {
	as?: 'h2' | 'h3' | 'h4' | 'p' | 'div';
	size?: 'meta' | 'sm';
	tone?: SectionLabelTone;
	icon?: IconProp;
	count?: number;
	countUnit?: string;
	id?: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<As id={id} className={cn('flex items-center gap-1.5 font-semibold text-ink-2', size === 'sm' ? 'text-sm' : 'text-meta', className)}>
			<span className={cn('inline-flex min-w-0 items-center gap-1.5 [&_svg]:size-4 [&_svg]:shrink-0', LABEL_TONE[tone])}>
				{renderIcon(icon, tone === 'neutral' ? 'text-ink-3' : '')}
				{children}
			</span>
			{count !== undefined && (
				<span className="font-num font-normal text-ink-3 tabular-nums">
					<span className="sr-only">，</span>
					{count}
					<span className="sr-only">{countUnit}</span>
				</span>
			)}
		</As>
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

/**
 * 載入失敗的提示（圖示加文字，role="alert"）。
 * onRetry：有給就在右側顯示「重新載入」按鈕（通常傳 query 的 refetch），使用者不必重新整理頁面；
 * retrying：重試中（query 的 isRefetching），按鈕顯示轉圈並暫停點擊。不傳 onRetry 時和原本一樣只有訊息。
 */
export function ErrorNote({ error, onRetry, retrying }: { error: unknown; onRetry?: () => void; retrying?: boolean }) {
	return (
		<div
			className={cn('flex flex-wrap gap-x-3 gap-y-2 rounded-lg bg-danger-soft px-4 text-sm text-danger', onRetry ? 'items-center py-2' : 'items-start py-3')}
			role="alert"
		>
			<span className="flex min-w-0 flex-[1_1_12rem] items-start gap-2">
				<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
				<span className="min-w-0">{error instanceof Error ? error.message : '載入失敗'}</span>
			</span>
			{onRetry && (
				<Button size="sm" onClick={onRetry} loading={retrying}>
					{!retrying && <RotateCw className="size-4" aria-hidden />}
					重新載入
				</Button>
			)}
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

/**
 * 確認對話框的語氣：
 * - danger（預設）：破壞性操作（刪除、放棄）。確認鈕是紅色 danger，預設焦點在「取消」，連按 Enter 不會誤刪。
 * - primary：一般的確認（例如「要一併完成任務嗎？」）。確認鈕是 primary，預設焦點在確認鈕，Enter 直接確認。
 * 觸控裝置兩者都不自動 focus（同 Dialog）。
 */
export type ConfirmTone = 'danger' | 'primary';

export type ConfirmOptions = {
	title: string;
	/** 說明文字；danger 省略時顯示「刪除後無法復原。」，primary 省略時不顯示 */
	message?: string;
	/** 確認鈕文字；danger 預設「刪除」，primary 預設「確定」 */
	confirmText?: string;
	/** 取消鈕文字，預設「取消」 */
	cancelText?: string;
	/** 預設 'danger'（也可以在 useConfirm({ tone }) 設定整個 hook 的預設值） */
	tone?: ConfirmTone;
};

/**
 * 用法：const [confirm, confirmDialog] = useConfirm(); if (await confirm({...})) ... ；並渲染 {confirmDialog}
 * 非破壞性的確認：confirm({ title: '要一併完成任務嗎？', confirmText: '完成任務', tone: 'primary' })。
 */
export function useConfirm(defaults: { tone?: ConfirmTone } = {}) {
	const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

	const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), []);
	const close = (v: boolean) => {
		state?.resolve(v);
		setState(null);
	};

	const danger = (state?.tone ?? defaults.tone ?? 'danger') === 'danger';
	const message = state?.message ?? (danger ? '刪除後無法復原。' : undefined);
	const element = (
		<Dialog
			open={!!state}
			onClose={() => close(false)}
			title={state?.title ?? ''}
			footer={
				<>
					{/* 破壞性操作：預設焦點放在「取消」，避免連按 Enter 就刪除；一般確認的焦點放在確認鈕 */}
					<Button onClick={() => close(false)} autoFocus={danger}>
						{state?.cancelText ?? '取消'}
					</Button>
					<Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus={!danger}>
						{state?.confirmText ?? (danger ? '刪除' : '確定')}
					</Button>
				</>
			}
		>
			{message && <p className="text-sm text-ink-2">{message}</p>}
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
		<div {...progressAria(props)} className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
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
	return rest ? [{ value: h, unit: '小時' }, { value: rest, unit: '分' }] : [{ value: h, unit: '小時' }];
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

/** 圖表／表格切換：每張圖都有表格檢視（dataviz）。aria-pressed 表示目前是表格檢視；文字與 aria-label 寫出按下去會切到哪一種 */
export function TableToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
	return (
		<Button size="sm" variant="ghost" onClick={onToggle} aria-pressed={on} aria-label={on ? '改用圖表檢視' : '改用表格檢視'}>
			{on ? <ChartColumn className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
			{on ? '圖表' : '表格'}
		</Button>
	);
}

// ---- 切換、小按鈕、整格可點 ----

type ToggleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
	/** 目前是否按下（aria-pressed） */
	pressed: boolean;
	onPressedChange: (pressed: boolean) => void;
	/** 儲存中：aria-disabled 加 aria-busy（不用 disabled，焦點才不會掉到 body），並忽略點擊 */
	busy?: boolean;
	/** text（預設）：圖示加文字的 sm 按鈕；icon：只有圖示（桌面 36px、觸控 44px），一定要給 aria-label */
	variant?: 'icon' | 'text';
	/** lucide 元件時 16px，按下時轉成實心（fill-current）；元素時照原樣顯示 */
	icon?: IconProp;
	size?: ButtonSize;
};

/**
 * 切換按鈕（釘選、收藏這類開／關）：aria-pressed 表示狀態，名稱不隨狀態改字（「釘選」，不是「取消釘選」）。
 * 按下時是 accent-soft 底、accent-ink 字，圖示轉成實心：形狀與顏色都不同，不只靠顏色。
 */
export const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(function ToggleButton(
	{ pressed, onPressedChange, busy = false, variant = 'text', icon, size, className, children, onClick, ...props },
	ref,
) {
	const iconOnly = variant === 'icon';
	return (
		<Button
			ref={ref}
			variant={iconOnly ? 'ghost' : 'secondary'}
			size={size ?? (iconOnly ? 'icon' : 'sm')}
			aria-pressed={pressed}
			aria-disabled={busy || undefined}
			aria-busy={busy || undefined}
			onClick={(e) => {
				if (busy) return;
				onClick?.(e);
				if (!e.defaultPrevented) onPressedChange(!pressed);
			}}
			className={cn('sf-toggle', iconOnly && 'sf-toggle-icon', className)}
			{...props}
		>
			{renderIcon(icon, cn('size-4 shrink-0', pressed && 'fill-current'))}
			{iconOnly ? null : children}
		</Button>
	);
});

/**
 * 小圓形圖示按鈕（照片角落的刪除、移除）：看起來 28px，點擊範圍用 ::after 擴大到 44px。
 * label 是無障礙名稱（必填）；icon 預設是 X。位置由呼叫端決定，例如 `className="absolute top-1 right-1"`。
 */
export const MiniIconButton = forwardRef<
	HTMLButtonElement,
	Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> & { label: string; icon?: LucideIcon }
>(function MiniIconButton({ label, icon = X, className, type = 'button', ...props }, ref) {
	return (
		<button ref={ref} type={type} aria-label={label} className={cn('sf-mini-btn', className)} {...props}>
			{createElement(icon, { className: 'size-4', 'aria-hidden': true })}
		</button>
	);
});

/**
 * 整格可點的標題按鈕：::after 蓋滿最近的 relative 容器，焦點框畫在整格外圍（按鈕本身只是標題文字）。
 * - cover="cell"（預設）：清單列、看板卡裡的標題格，::after 比容器往外 4px、圓角 md。
 * - cover="card"：蓋滿整張卡（容器是 relative 的 Card），圓角 xl，焦點框內縮 2px（卡片有 overflow-hidden 也不會被裁掉）。
 * 同一格裡其他可以點的元素要加 `relative z-10` 才會疊在上面。文字樣式由 className 決定。
 */
export const StretchedButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { cover?: 'cell' | 'card' }>(
	function StretchedButton({ cover = 'cell', className, type = 'button', ...props }, ref) {
		return <button ref={ref} type={type} className={cn('sf-stretched', cover === 'card' && 'sf-stretched-card', className)} {...props} />;
	},
);

/**
 * 長清單的「顯示全部 N 項／只顯示前 N 項」切換（aria-expanded）。total 不超過 limit 時不顯示。
 * 預設撐滿寬度（放在卡片底部或欄位底部）；外層的分隔線與內距由呼叫端決定。
 */
export function ShowAllToggle({
	expanded,
	onToggle,
	total,
	limit,
	unit = '項',
	className,
}: {
	expanded: boolean;
	onToggle: () => void;
	total: number;
	limit: number;
	unit?: string;
	className?: string;
}) {
	if (total <= limit) return null;
	return (
		<Button variant="ghost" size="sm" aria-expanded={expanded} onClick={onToggle} className={cn('sf-btn-block', className)}>
			{expanded ? `只顯示前 ${limit} ${unit}` : `顯示全部 ${total} ${unit}`}
			<ChevronDown
				className={cn('size-4 transition-transform duration-180 ease-out motion-reduce:transition-none', expanded && 'rotate-180')}
				aria-hidden
			/>
		</Button>
	);
}

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'aria-label'> & {
	value: string;
	onValueChange: (value: string) => void;
	/** 無障礙名稱，例如「搜尋任務」 */
	label: string;
	/** 清除鈕的無障礙名稱 */
	clearLabel?: string;
};

/**
 * 搜尋框：左側放大鏡、有文字時右側出現清除鈕（44px 寬，清除後焦點回到輸入框），Esc 也會清空。
 * - Esc：有文字時清空並攔下事件（preventDefault＋stopPropagation：外層的對話框不會關閉，外層的 Escape 快捷鍵也不會觸發）；已經是空的就交給外層。注音選字中不攔截。
 * - **className 套在外層容器**（寬度、flex），和 Select 一樣；其餘屬性（placeholder、maxLength…）傳給 input。
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
	{ value, onValueChange, label, clearLabel = '清除搜尋', className, onKeyDown, ...props },
	ref,
) {
	const inner = useRef<HTMLInputElement | null>(null);
	return (
		<div role="search" className={cn('relative', className)}>
			<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
			<input
				enterKeyHint="search"
				{...props}
				ref={(el) => {
					inner.current = el;
					if (typeof ref === 'function') ref(el);
					else if (ref) ref.current = el;
				}}
				type="search"
				value={value}
				aria-label={label}
				onChange={(e) => onValueChange(e.target.value)}
				onKeyDown={(e) => {
					onKeyDown?.(e);
					if (e.defaultPrevented || e.key !== 'Escape' || !value || e.nativeEvent.isComposing) return;
					// 這次 Esc 只用來清空：preventDefault 讓原生 <dialog> 不關閉，stopPropagation 讓外層（document、window）的 Escape 處理不會同時觸發
					e.preventDefault();
					e.stopPropagation();
					onValueChange('');
				}}
				className="sf-field sf-input sf-search-input"
			/>
			{value && (
				<button
					type="button"
					aria-label={clearLabel}
					onClick={() => {
						onValueChange('');
						inner.current?.focus();
					}}
					className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-3 transition-colors duration-120 ease-out hover:text-ink focus-visible:-outline-offset-2"
				>
					<X className="size-4" aria-hidden />
				</button>
			)}
		</div>
	);
});

// ---- 動效 ----

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** 使用者是否要求減少動態。CSS 能處理的用 `motion-reduce:`；只有 JS 控制的動畫（拖曳歸位、捲動）才需要這個 hook */
export function usePrefersReducedMotion(): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const media = window.matchMedia(REDUCED_MOTION);
			media.addEventListener('change', onChange);
			return () => media.removeEventListener('change', onChange);
		},
		() => window.matchMedia(REDUCED_MOTION).matches,
	);
}

// ---- 鍵盤 ----

/**
 * 排成格狀的 radiogroup（圖示、主題色、色格）的方向鍵，跟著畫面上的排列移動：
 * - 左右：前一個／下一個，頭尾相接（同 WAI-ARIA radio group）。
 * - 上下：同一欄的上一列／下一列，到邊界就停住。
 * - Home／End：第一個／最後一個。
 * 欄數直接讀 CSS grid 實際排出來的欄（grid-template-columns 的計算值），所以 auto-fill、斷點都不用另外同步。
 * 不是這些按鍵時回傳 null（交給瀏覽器處理，例如 Tab）。
 * e 只需要 key：React 的合成事件與 DOM 的 KeyboardEvent 都能直接傳。
 */
export function gridKeyTarget(e: { readonly key: string }, index: number, count: number, grid: HTMLElement | null): number | null {
	if (count <= 0) return null;
	const cols = grid ? Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length) : 1;
	switch (e.key) {
		case 'ArrowRight':
			return (index + 1) % count;
		case 'ArrowLeft':
			return (index - 1 + count) % count;
		case 'ArrowDown':
			return index + cols < count ? index + cols : index;
		case 'ArrowUp':
			return index - cols >= 0 ? index - cols : index;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}
