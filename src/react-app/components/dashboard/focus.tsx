import { Button, Dialog } from '../ui';

/**
 * 切換專注任務的確認框（DASH-1）。
 * 切換會先結束並儲存目前的計時，不是破壞性操作，所以確認鈕用 primary，不用紅色（DESIGN.md §1、§8）。
 * 預設焦點放在「取消」，連按 Enter 不會直接切換；觸控裝置由 Dialog 處理，不自動 focus。
 */
export function FocusSwitchDialog({
	open,
	message,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	message: string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog
			open={open}
			onClose={onCancel}
			title="要切換成這個任務嗎？"
			footer={
				<>
					<Button onClick={onCancel} autoFocus>
						取消
					</Button>
					<Button variant="primary" onClick={onConfirm}>
						切換任務
					</Button>
				</>
			}
		>
			<p className="text-sm text-ink-2">{message}</p>
		</Dialog>
	);
}
