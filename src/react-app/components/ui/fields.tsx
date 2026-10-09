import { ChevronDown, Search, X } from 'lucide-react';
import {
	cloneElement,
	forwardRef,
	isValidElement,
	useId,
	useRef,
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';
import { InlineError } from './states';

// 表單元件：Input、Textarea、Select 的外觀在 index.css 的 .sf-field；Field 負責標籤、提示、錯誤與 aria

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
		<InlineError id={noteId}>{error}</InlineError>
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
