import { ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { minuteParts } from '../../lib/dashboard-format';
import { cn } from '../ui';

// 總覽與統計頁共用的小元件。若設計師決定收進共用元件，可以直接搬到 ui.tsx。

/**
 * 文字連結加 ChevronRight（CardHeader 的動作、「設定目標」等），連結後面不加「→」。
 * 外觀不變，點擊範圍用 ::after 擴大到 44px 高：往上 16px、往下 8px。
 * 往下只擴大 8px：CardHeader 下方只有 pb-2，擴大範圍不能蓋到卡片第一列的按鈕（例如今日任務的 ▶）；
 * 上方是卡片的 pt-4／標題文字，沒有其他可以點的元素。
 */
export function MoreLink({
	to,
	children,
	className,
	'aria-label': ariaLabel,
}: {
	to: string;
	children: ReactNode;
	className?: string;
	'aria-label'?: string;
}) {
	return (
		<Link
			to={to}
			aria-label={ariaLabel}
			className={cn(
				"relative inline-flex shrink-0 items-center gap-0.5 rounded-sm text-sm whitespace-nowrap text-accent-ink after:absolute after:-inset-x-1 after:-top-4 after:-bottom-2 after:content-[''] hover:underline",
				className,
			)}
		>
			{children}
			<ChevronRight className="size-4 shrink-0" aria-hidden />
		</Link>
	);
}

/** 數字後面的單位：文字字型、較小、次要文字色（和 NumDisplay 的 unit 一致） */
export function Unit({ children }: { children: ReactNode }) {
	return <span className="mr-1.5 ml-1 font-sans text-sm font-normal text-ink-2 last:mr-0">{children}</span>;
}

/** 分鐘數：數字用數字字型、單位較小，例如 1 小時 20 分（放在 StatStrip 的數值裡） */
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
