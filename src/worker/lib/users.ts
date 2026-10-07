import type { PublicUser } from '../../shared/api-types';
import type { User } from '../db/schema';

/** 回傳給前端（與 JSON 備份）的使用者資料：逐欄列出，不含密碼雜湊與頭像的 R2 key */
export function publicUser(u: User): PublicUser {
	return {
		id: u.id,
		email: u.email,
		displayName: u.displayName,
		timezone: u.timezone,
		createdAt: u.createdAt,
		dailyGoalMinutes: u.dailyGoalMinutes,
		weeklyGoalMinutes: u.weeklyGoalMinutes,
		avatarUpdatedAt: u.avatarUpdatedAt,
	};
}
