import { describe, expect, it } from 'vitest';
import { changePasswordSchema, registerSchema } from '../src/shared/schemas';
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
});
