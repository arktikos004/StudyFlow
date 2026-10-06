import { Pin } from 'lucide-react';
import { ToggleButton } from '../ui';

/**
 * 釘選開關（NOTE-1）：內部是共用的 ToggleButton（aria-pressed、按下時 accent-soft 底與實心圖釘，形狀與顏色都不同）。
 * 名稱固定是「釘選」，不隨狀態改字；儲存中用 aria-disabled＋aria-busy（不用 disabled，焦點才不會掉到 body）。
 * - icon：卡片角落的圖示按鈕（桌面 36px、觸控 44px），名稱帶筆記標題
 * - text：詳細內容裡的「釘選」按鈕
 * 對外的 props 不變。
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
	if (variant === 'text')
		return (
			<ToggleButton pressed={pinned} onPressedChange={onToggle} busy={busy} icon={Pin} data-pin-id={noteId} className={className}>
				釘選
			</ToggleButton>
		);
	return (
		<ToggleButton
			variant="icon"
			pressed={pinned}
			onPressedChange={onToggle}
			busy={busy}
			icon={Pin}
			aria-label={`釘選「${title}」`}
			title={pinned ? '取消釘選' : '釘選到最前面'}
			data-pin-id={noteId}
			className={className}
		/>
	);
}
