import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ZodType } from 'zod';

// 包一層 zValidator：驗證失敗時統一回傳 { error: 第一個錯誤訊息 }
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
	zValidator(target, schema, (result) => {
		if (!result.success) {
			const issue = result.error.issues[0];
			throw new HTTPException(400, { message: issue?.message ?? '輸入資料格式錯誤' });
		}
	});
