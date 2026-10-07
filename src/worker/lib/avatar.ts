import { eq, sql } from 'drizzle-orm';
import { users, type User } from '../db/schema';
import type { DB } from './db';
import type { ImageType } from './image';
import { deleteObjectsQuietly } from './storage';

/**
 * 把使用者的頭像改指向新的 R2 key（null = 沒有頭像），回傳被換掉的舊 key 與更新後的使用者。
 * 讀舊值與更新放在同一個 batch（D1 的 batch 是一個交易、依序執行）：同時送出兩次上傳時，
 * 每次拿到的都是真正被自己換掉的那一個，不會漏刪檔案。
 */
async function pointAvatarTo(db: DB, userId: string, key: string | null) {
	const [[old], [user]] = await db.batch([
		db.select({ key: users.avatarKey }).from(users).where(eq(users.id, userId)),
		db
			.update(users)
			.set({
				avatarKey: key,
				// 嚴格遞增：同一毫秒內連續更換也會得到不同的網址（?v=），瀏覽器不會拿快取裡的舊圖
				avatarUpdatedAt: key ? sql`max(${Date.now()}, coalesce(${users.avatarUpdatedAt}, 0) + 1)` : null,
			})
			.where(eq(users.id, userId))
			.returning(),
	]);
	return { previousKey: old?.key ?? null, user };
}

const keysOf = (key: string | null) => (key ? [key] : []);

/**
 * 換上新的頭像：先存新檔、資料庫改指向新檔，最後才刪舊檔，任何一步失敗都不會留下壞掉的頭像。
 * 每次都用新的 key，瀏覽器快取裡的舊圖不會被當成新的。
 */
export async function replaceAvatar(bucket: R2Bucket, db: DB, userId: string, bytes: Uint8Array, contentType: ImageType): Promise<User> {
	const key = `users/${userId}/avatar-${crypto.randomUUID()}`;
	await bucket.put(key, bytes, { httpMetadata: { contentType } });
	const swapped = await pointAvatarTo(db, userId, key).catch(async (e) => {
		// 資料庫沒有更新成功：剛存的新檔沒人引用，刪掉
		await deleteObjectsQuietly(bucket, [key]);
		throw e;
	});
	await deleteObjectsQuietly(bucket, keysOf(swapped.previousKey));
	return swapped.user;
}

/** 移除頭像：先讓資料庫不再指向舊檔，再刪 R2 的檔案；本來就沒有頭像也算成功 */
export async function removeAvatar(bucket: R2Bucket, db: DB, userId: string): Promise<User> {
	const swapped = await pointAvatarTo(db, userId, null);
	await deleteObjectsQuietly(bucket, keysOf(swapped.previousKey));
	return swapped.user;
}
