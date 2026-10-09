import { CircleAlert, Loader2, RotateCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

// 空狀態、載入中、錯誤（DESIGN.md 原則 6：每個資料區塊都要有這三種狀態）

/**
 * 空狀態。page 版：圖示圓、標題、一句邀請、primary 動作；inline 版：一行文字加 ghost 動作。
 * 文案用動詞開頭的邀請（「新增第一題錯題」），不要只寫「沒有資料」。
 * flush：放在已經有左右內距的容器裡（例如卡片內容區）時不再加左右內距，和旁邊的內容對齊。
 */
export function EmptyState({
	icon,
	title,
	description,
	action,
	variant = 'page',
	flush = false,
	className,
}: {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	variant?: 'page' | 'inline';
	flush?: boolean;
	className?: string;
}) {
	if (variant === 'inline')
		return (
			<div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3', !flush && 'px-4 sm:px-5', className)}>
				<p className="min-w-0 text-sm text-ink-2">
					{title}
					{description && <span className="text-ink-3">，{description}</span>}
				</p>
				{action}
			</div>
		);
	return (
		<div className={cn('flex flex-col items-center justify-center gap-1 py-10 text-center', !flush && 'px-6', className)}>
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
 * 行內錯誤：圖示加紅字（不只靠顏色），role="alert" 讓報讀器馬上念出來。
 * size="sm"（預設）：欄位底下的錯誤；size="md"：整張表單的錯誤，放在送出按鈕上方。
 * id：給欄位的 aria-describedby 指向。
 */
export function InlineError({
	id,
	size = 'sm',
	className,
	children,
}: {
	id?: string;
	size?: 'sm' | 'md';
	className?: string;
	children: ReactNode;
}) {
	return (
		<p id={id} role="alert" className={cn('flex items-start gap-1.5 text-danger', size === 'sm' ? 'text-meta' : 'text-sm', className)}>
			<CircleAlert className={cn('shrink-0', size === 'sm' ? 'mt-[3px] size-3.5' : 'mt-0.5 size-4')} aria-hidden />
			<span className="min-w-0">{children}</span>
		</p>
	);
}

/**
 * 載入失敗的提示（圖示加文字，role="alert"）。
 * onRetry：有給就在右側顯示「重新載入」按鈕（通常傳 query 的 refetch），使用者不必重新整理頁面；
 * retrying：重試中（query 的 isRefetching），按鈕顯示轉圈並忽略點擊；用 aria-disabled＋aria-busy（不用 disabled），焦點留在按鈕上。
 * 不傳 onRetry 時和原本一樣只有訊息。
 */
export function ErrorNote({ error, onRetry, retrying }: { error: unknown; onRetry?: () => void; retrying?: boolean }) {
	return (
		<div
			className={cn(
				'flex flex-wrap gap-x-3 gap-y-2 rounded-lg bg-danger-soft px-4 text-sm text-danger',
				onRetry ? 'items-center py-2' : 'items-start py-3',
			)}
			role="alert"
		>
			<span className="flex min-w-0 flex-[1_1_12rem] items-start gap-2">
				<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
				<span className="min-w-0">{error instanceof Error ? error.message : '載入失敗'}</span>
			</span>
			{onRetry && (
				// 重試中用 aria-disabled＋aria-busy 並忽略點擊，不用 disabled（Button 的 loading）：
				// 停用的按鈕會讓焦點掉到 body，鍵盤使用者重試失敗後就找不回這個按鈕
				<Button
					size="sm"
					aria-disabled={retrying || undefined}
					aria-busy={retrying || undefined}
					onClick={() => {
						if (!retrying) onRetry();
					}}
				>
					{retrying ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : <RotateCw className="size-4" aria-hidden />}
					重新載入
				</Button>
			)}
		</div>
	);
}
