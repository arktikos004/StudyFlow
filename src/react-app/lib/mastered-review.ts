import { parseGoalInput } from './goals';

// 已掌握題目的複習間隔選單：特別選項（不提醒、跟隨設定）、常用天數、自訂天數。設定頁與筆記編輯共用。

/** 常用的天數 */
export const MASTERED_REVIEW_PRESETS = [7, 14, 30, 60, 90] as const;
export const CUSTOM_CHOICE = 'custom';

/** 選單的狀態：choice 是特別選項的 key、常用天數（字串）或 CUSTOM_CHOICE；custom 是自訂天數的輸入文字 */
export type IntervalChoice = { choice: string; custom: string };
/** 特別選項：key → 送出的值。設定頁 { none: null }；單則筆記 { follow: null, none: 0 } */
export type SpecialChoices = Record<string, number | null>;

/** 說明文字：每 N 天／不提醒 */
export const masteredReviewLabel = (days: number | null) => (days ? `每 ${days} 天` : '不提醒');

/** 目前的值換成選單的狀態：特別選項與常用天數直接選，其他天數選「自訂」並填好 */
export function toIntervalChoice(value: number | null, special: SpecialChoices): IntervalChoice {
	const specialKey = Object.keys(special).find((key) => special[key] === value);
	if (specialKey) return { choice: specialKey, custom: '' };
	if (value !== null && (MASTERED_REVIEW_PRESETS as readonly number[]).includes(value)) return { choice: String(value), custom: '' };
	return { choice: CUSTOM_CHOICE, custom: value === null ? '' : String(value) };
}

/** 選單的狀態換回要送出的值；自訂的天數沒填或不是數字時回傳原本的文字，交給 schema 回報錯誤 */
export function fromIntervalChoice({ choice, custom }: IntervalChoice, special: SpecialChoices): number | null | string {
	if (choice in special) return special[choice];
	if (choice !== CUSTOM_CHOICE) return Number(choice);
	return parseGoalInput(custom) ?? '';
}
