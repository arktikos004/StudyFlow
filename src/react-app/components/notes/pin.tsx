import { Pin } from 'lucide-react';
import { Button, cn } from '../ui';

/**
 * 釘選開關（NOTE-1）：aria-pressed 表示狀態，名稱固定是「釘選」，不隨狀態改字。
 * 釘選中：實心圖釘、accent-soft 底（形狀與顏色都不同，不只靠顏色）。
 * 儲存中用 aria-disabled（不用 disabled，焦點才不會掉到 body），並忽略重複點擊。
 * - icon：卡片角落的圖示按鈕（桌面 36px、觸控 44px），名稱帶筆記標題
 * - text：詳細內容裡的「釘選」按鈕
 */
export function PinToggle({
	pinned,
	title,
	busy = false,
	onToggle,
	variant = 'icon',
	noteId,
	className,
}: {
	pinned: boolean;
	/** 筆記標題，組成「釘選「…」」的無障礙名稱 */
	title: string;
	busy?: boolean;
	onToggle: () => void;
	variant?: 'icon' | 'text';
	/** 放在 data-pin-id：清單重新排序後，用它把焦點放回同一則筆記的釘選按鈕 */
	noteId?: string;
	className?: string;
}) {
	const props = {
		'aria-pressed': pinned,
		'aria-disabled': busy || undefined,
		'aria-busy': busy || undefined,
		onClick: () => {
			if (!busy) onToggle();
		},
		'data-pin-id': noteId,
	};
	const icon = <Pin className={cn('size-4', pinned && 'fill-current')} aria-hidden />;
	if (variant === 'text')
		return (
			<Button
				{...props}
				size="sm"
				className={cn(pinned && 'border-transparent bg-accent-soft text-accent-ink hover:bg-accent-soft', busy && 'opacity-70', className)}
			>
				{icon}
				釘選
			</Button>
		);
	return (
		<Button
			{...props}
			variant="ghost"
			size="icon"
			aria-label={`釘選「${title}」`}
			title={pinned ? '取消釘選' : '釘選到最前面'}
			className={cn(
				pinned ? 'bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink' : 'text-ink-3',
				busy && 'opacity-70',
				className,
			)}
		>
			{icon}
		</Button>
	);
}
