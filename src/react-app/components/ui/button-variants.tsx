import { ChartColumn, ChevronDown, Table2, X, type LucideIcon } from 'lucide-react';
import { createElement, forwardRef, type ButtonHTMLAttributes } from 'react';
import { Button, type ButtonSize } from './Button';
import { cn } from './cn';
import { renderIcon, type IconProp } from './icon';

// 建在 Button 上的特殊按鈕：表格／圖表切換、狀態切換、小圖示按鈕、整格可點、顯示全部

/** 圖表／表格切換：每張圖都有表格檢視（dataviz）。aria-pressed 表示目前是表格檢視；文字與 aria-label 寫出按下去會切到哪一種 */
export function TableToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
	return (
		<Button size="sm" variant="ghost" onClick={onToggle} aria-pressed={on} aria-label={on ? '改用圖表檢視' : '改用表格檢視'}>
			{on ? <ChartColumn className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
			{on ? '圖表' : '表格'}
		</Button>
	);
}

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
