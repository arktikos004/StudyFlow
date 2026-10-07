import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ZodType } from 'zod';

/** 驗證失敗時回給使用者的訊息：第一個錯誤（schema 裡寫的 zh-TW 訊息） */
export const firstIssueMessage = (error: { issues: readonly { message: string }[] }) => error.issues[0]?.message ?? '輸入資料格式錯誤';

/** 包一層 zValidator：驗證失敗時統一回傳 400 { error: 第一個錯誤訊息 } */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
	zValidator(target, schema, (result) => {
		if (!result.success) throw new HTTPException(400, { message: firstIssueMessage(result.error) });
	});
