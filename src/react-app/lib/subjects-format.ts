// s2/subjects 的格式化與輸入解析（lib/format.ts 在 Sprint 2 凍結，新的函式放這裡）
import type { Subject } from '../../shared/api-types';

const FULLWIDTH_DIGITS = /[０-９]/g;
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * 目標分鐘數輸入框的字串 → 交給 zod（GOAL_LIMITS）驗證的值：
 * - 空白 → null（不設定）。
 * - 數字（全形數字也可以，注音輸入法常打出全形）→ number；小數與超出範圍交給 schema 回「必須是整數」「需介於 …」。
 * - 其他 → 原字串，schema 會回「…請輸入數字」。
 */
export function parseGoalInput(raw: string): number | string | null {
	const v = raw.trim().replace(FULLWIDTH_DIGITS, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
	if (!v) return null;
	return NUMBER.test(v) ? Number(v) : v;
}

/** 把已儲存的目標（分鐘或 null）轉成輸入框的字串 */
export const goalToInput = (minutes: number | null | undefined) => (minutes == null ? '' : String(minutes));

/** 各科每週目標的加總（GOAL-2）：封存的科目不列入（同總覽）；exceptId 的科目也不算，由呼叫端加上編輯中的值 */
export function sumSubjectGoals(subjects: readonly Pick<Subject, 'id' | 'archived' | 'weeklyGoalMinutes'>[], exceptId?: string): number {
	return subjects.reduce((sum, s) => (s.id === exceptId || s.archived ? sum : sum + (s.weeklyGoalMinutes ?? 0)), 0);
}
