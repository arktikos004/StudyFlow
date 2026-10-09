import { describe, expect, it } from 'vitest';
import { changePasswordSchema, eventSchema, registerSchema, taskSchema } from '../src/shared/schemas';
import { fieldErrors } from '../src/react-app/lib/form-errors';

describe('表單的欄位錯誤（fieldErrors）', () => {
	it('每個欄位只取第一則訊息', () => {
		const issues = [
			{ path: ['email'], message: 'Email 格式錯誤' },
			{ path: ['email'], message: '第二則不要' },
			{ path: ['password'], message: '密碼至少 8 個字元' },
		];
		expect(fieldErrors(issues, ['email', 'password'])).toEqual({ email: 'Email 格式錯誤', password: '密碼至少 8 個字元' });
	});

	it('不在 fields 裡的欄位與沒有欄位的錯誤不收', () => {
		const issues = [
			{ path: [], message: '表單層級' },
			{ path: ['other'], message: '別的欄位' },
			{ path: ['name'], message: '請輸入名稱' },
		];
		expect(fieldErrors(issues, ['name'])).toEqual({ name: '請輸入名稱' });
	});

	it('直接接共用 schema 的結果', () => {
		const register = registerSchema.safeParse({ email: 'x', password: '123', displayName: '' });
		expect(register.success).toBe(false);
		expect(fieldErrors(register.error!.issues, ['displayName', 'email', 'password'])).toEqual({
			displayName: '請輸入暱稱',
			email: 'Email 格式錯誤',
			password: '密碼至少 8 個字元',
		});
		const password = changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'short' });
		expect(fieldErrors(password.error!.issues, ['currentPassword', 'newPassword'])).toEqual({
			currentPassword: '請輸入目前密碼',
			newPassword: '密碼至少 8 個字元',
		});
	});
	it('考試與任務表單：錯誤都對得到畫面上的欄位，訊息是中文', () => {
		const event = eventSchema.safeParse({ kind: 'exam', title: ' ', date: '2026-02-31', time: '25:00', location: 'x'.repeat(101) });
		expect(fieldErrors(event.error!.issues, ['title', 'date', 'time', 'location', 'notes'])).toEqual({
			title: '請輸入標題',
			date: '沒有這一天，請確認日期',
			time: '時間格式錯誤',
			location: '最多 100 個字',
		});
		const task = taskSchema.safeParse({ title: '', dueDate: '2026-13-01', estimatedMinutes: 0 });
		expect(fieldErrors(task.error!.issues, ['title', 'dueDate', 'estimatedMinutes', 'description'])).toEqual({
			title: '請輸入任務名稱',
			dueDate: '沒有這一天，請確認日期',
			estimatedMinutes: '預估時間需介於 1–1440 分鐘',
		});
		const estimate = (minutes: number) => taskSchema.safeParse({ title: 't', estimatedMinutes: minutes }).error?.issues[0].message;
		expect(estimate(1441)).toBe('預估時間需介於 1–1440 分鐘');
		expect(estimate(1.5)).toBe('預估時間必須是整數');
	});
});
