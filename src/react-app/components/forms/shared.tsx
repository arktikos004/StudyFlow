import { Button } from '../ui';

// 對話框的內容只在打開時才掛載，所以表單狀態每次打開都會用最新的初始值建立，不需要另外重設。

export function DialogFooter({
	formId,
	onClose,
	onDelete,
	saving,
}: {
	formId: string;
	onClose: () => void;
	onDelete?: () => void;
	saving: boolean;
}) {
	return (
		<>
			{onDelete && (
				<Button variant="ghost" className="mr-auto text-danger hover:text-danger" onClick={onDelete}>
					刪除
				</Button>
			)}
			<Button onClick={onClose}>取消</Button>
			<Button variant="primary" type="submit" form={formId} loading={saving}>
				儲存
			</Button>
		</>
	);
}
