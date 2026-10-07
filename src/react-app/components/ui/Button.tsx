import { ChevronRight, Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from './cn';

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
