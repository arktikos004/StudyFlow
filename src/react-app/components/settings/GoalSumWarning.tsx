import { TriangleAlert } from 'lucide-react';
import { formatMinutes } from '../../lib/format';

/**
 * GOAL-2：各科每週目標加總超過每週總目標時提醒（只提醒、不阻擋）。
 * live region 一直存在，提醒出現時螢幕報讀器才會唸出來。
 */
export function GoalSumWarning({ total, weekly }: { total: number; weekly: number | null | undefined }) {
	const over = weekly != null && weekly > 0 && total > weekly;
	return (
		<div role="status" aria-live="polite">
			{over && (
				<p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-ink">
					<TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
					<span>
						各科每週目標加總 {formatMinutes(total)}，超過每週總目標 {formatMinutes(weekly)}。仍然可以儲存；也可以調低各科目標，或調高每週總目標。
					</span>
				</p>
			)}
		</div>
	);
}
