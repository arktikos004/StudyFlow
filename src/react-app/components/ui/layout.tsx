import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { renderIcon, type IconProp } from './icon';

// 版面：卡片、頁首、頁面的區塊間距、區塊標籤

/**
 * 卡片：圓角 xl、邊框 line、陰影 sm。卡片裡不放卡片。
 * variant：plain（只有邊框，無陰影），例如已經過去的考試。
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
	as?: 'section' | 'div' | 'article';
	variant?: 'default' | 'plain';
	interactive?: boolean;
}) {
	return (
		<As
			className={cn(
				'rounded-xl border border-line bg-card',
				variant === 'default' && 'shadow-sm',
				interactive && 'transition-[border-color,box-shadow] duration-120 ease-out hover:border-line-strong hover:shadow-md',
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

const LABEL_TONE: Record<SectionLabelTone, string | false> = {
	neutral: false,
	danger: 'text-danger',
	warning: 'text-warning',
	success: 'text-success',
};

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
	as?: 'h2' | 'h3';
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
