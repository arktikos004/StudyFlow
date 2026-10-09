import { describe, expect, it } from 'vitest';
import { CUSTOM_CHOICE, fromIntervalChoice, masteredReviewLabel, toIntervalChoice } from '../src/react-app/lib/mastered-review';
import { updateProfileSchema } from '../src/shared/schemas';

/** 設定頁：不提醒存成 null */
const SETTINGS = { none: null };
/** 單則筆記：跟隨設定存成 null、不提醒存成 0 */
const NOTE = { follow: null, none: 0 };

describe('已掌握題目的複習間隔選單', () => {
	it('特別選項與常用天數直接選，其他天數選「自訂」並填好', () => {
		expect(toIntervalChoice(null, SETTINGS)).toEqual({ choice: 'none', custom: '' });
		expect(toIntervalChoice(null, NOTE)).toEqual({ choice: 'follow', custom: '' });
		expect(toIntervalChoice(0, NOTE)).toEqual({ choice: 'none', custom: '' });
		expect(toIntervalChoice(30, NOTE)).toEqual({ choice: '30', custom: '' });
		expect(toIntervalChoice(45, NOTE)).toEqual({ choice: CUSTOM_CHOICE, custom: '45' });
	});

	it('選單的狀態換回原本的值', () => {
		for (const value of [null, 0, 7, 90, 45, 365]) expect(fromIntervalChoice(toIntervalChoice(value, NOTE), NOTE)).toBe(value);
		for (const value of [null, 14, 200]) expect(fromIntervalChoice(toIntervalChoice(value, SETTINGS), SETTINGS)).toBe(value);
	});

	it('自訂天數：全形數字也可以；沒填或不是數字交給 schema 回報錯誤', () => {
		const custom = (text: string) => fromIntervalChoice({ choice: CUSTOM_CHOICE, custom: text }, SETTINGS);
		expect(custom('４５')).toBe(45);
		const error = (text: string) => updateProfileSchema.safeParse({ masteredReviewDays: custom(text) }).error?.issues[0].message;
		expect(error('')).toBe('複習間隔請輸入數字');
		expect(error('三十')).toBe('複習間隔請輸入數字');
		expect(error('0')).toBe('複習間隔需介於 1–365 天');
		expect(error('1.5')).toBe('複習間隔必須是整數');
	});

	it('說明文字', () => {
		expect(masteredReviewLabel(null)).toBe('不提醒');
		expect(masteredReviewLabel(30)).toBe('每 30 天');
	});
});
