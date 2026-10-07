import { ShowAllToggle } from '../ui';

/** 卡片底部的「顯示全部 N 項／只顯示前 N 項」（共用的 ShowAllToggle） */
export function ShowMore({
	open,
	onToggle,
	total,
	limit,
	unit,
}: {
	open: boolean;
	onToggle: () => void;
	total: number;
	limit: number;
	unit: string;
}) {
	return (
		<div className="border-t border-line px-2 py-1.5 sm:px-3">
			<ShowAllToggle expanded={open} onToggle={onToggle} total={total} limit={limit} unit={unit} />
		</div>
	);
}
