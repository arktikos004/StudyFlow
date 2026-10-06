import type { Task, TaskItem } from '../../shared/api-types';
import { diffDays } from '../../shared/dates';

// 任務頁（s2/tasks）的格式化。lib/format.ts 在 Sprint 2 凍結，新的格式化放這裡。測試在 test/task-format.spec.ts。

/** 分鐘數（整數）→「45 分」「1 小時 20 分」「2 小時」 */
function minutesText(min: number, hours: boolean): string {
	if (!hours) return `${min} 分`;
	const h = Math.floor(min / 60);
	const rest = min % 60;
	if (!h) return `${rest} 分`;
	return rest ? `${h} 小時 ${rest} 分` : `${h} 小時`;
}

export type TaskTime = {
	/** 例如「已投入 45 分／預估 60 分」；兩者都沒有時是 null */
	text: string | null;
	/** 只有投入的部分，例如「已投入 45 分」；沒有投入時是 null */
	spentText: string | null;
	/** 超過預估的分鐘數（沒有超過或沒有預估時是 0） */
	over: number;
	/** 超過的量，例如「15 分」「2 小時 10 分」；沒有超過時是 null */
	overText: string | null;
};

/**
 * 實際投入與預估時間（TSK-4）。兩個數字用同一種單位方便比較：
 * 較大的一個不到 2 小時就都用「分」（已投入 45 分／預估 60 分），否則用「小時 分」。
 * 有投入但不到 1 分鐘時顯示「不到 1 分」。
 */
export function formatTaskTime(spentMinutes: number, estimatedMinutes: number | null | undefined): TaskTime {
	const spent = Math.max(0, Number.isFinite(spentMinutes) ? spentMinutes : 0);
	const estimate = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : null;
	const spentRounded = Math.round(spent);
	const hours = Math.max(spentRounded, estimate ?? 0) >= 120;
	const spentText = spent > 0 ? `已投入 ${spentRounded < 1 ? '不到 1 分' : minutesText(spentRounded, hours)}` : null;
	const parts = [spentText, estimate && `預估 ${minutesText(estimate, hours)}`].filter((p): p is string => !!p);
	const over = estimate && spentRounded > estimate ? spentRounded - estimate : 0;
	return {
		text: parts.length ? parts.join('／') : null,
		spentText,
		over,
		overText: over ? minutesText(over, over >= 120) : null,
	};
}

export type DueInfo =
	| { kind: 'overdue'; days: number; label: string }
	| { kind: 'today'; label: string }
	| { kind: 'tomorrow'; label: string }
	| { kind: 'later'; label: string };

/**
 * 期限的狀態（未完成的任務才判斷逾期與今天到期）。label 是給 badge 的文字：
 * 逾期 2 天／今天到期／明天到期；其他日期由呼叫端顯示日期。
 */
export function dueInfo(dueDate: string, today: string, done: boolean): DueInfo {
	const days = diffDays(today, dueDate);
	if (!done && days < 0) return { kind: 'overdue', days: -days, label: `逾期 ${-days} 天` };
	if (!done && days === 0) return { kind: 'today', label: '今天到期' };
	if (!done && days === 1) return { kind: 'tomorrow', label: '明天到期' };
	return { kind: 'later', label: '' };
}

/** 任務的實際投入分鐘數；呼叫端傳入的 Task 沒有這個欄位（不是 TaskItem）時當成 0 */
export function spentOf(task: Task | TaskItem): number {
	return 'spentMinutes' in task && typeof task.spentMinutes === 'number' ? task.spentMinutes : 0;
}
