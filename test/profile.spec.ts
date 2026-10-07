import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import type { Achievement, ProfileSummary } from '../src/shared/api-types';
import { addDays, startOfLocalDay, today, zonedTime } from '../src/shared/dates';
import { AVATAR_MAX_BYTES } from '../src/shared/schemas';
import { createClient, logSession, noonClient, PNG_1X1, registeredClient, type Client } from './helpers';

const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));
// 後端只看檔案開頭判斷格式，測試用最小的檔頭就夠了
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF'), 0x00, 0xff, 0xd9]);
const WEBP = Uint8Array.from([...ascii('RIFF'), 0x0c, 0x00, 0x00, 0x00, ...ascii('WEBPVP8L'), 0x00, 0x00, 0x00, 0x00]);

type FileContent = Uint8Array | string;

/** 開頭是 PNG 檔頭、總共 size bytes 的檔案 */
function pngOfSize(size: number) {
	const bytes = new Uint8Array(size);
	bytes.set(PNG_1X1);
	return bytes;
}

function avatarForm(content: FileContent, name = 'avatar.png', type = 'image/png') {
	const form = new FormData();
	form.append('file', new File([content], name, { type }));
	return form;
}

async function uploadAvatar(c: Client, content: FileContent = PNG_1X1, type = 'image/png') {
	const res = await c.put('/api/auth/avatar', avatarForm(content, 'avatar', type));
	expect(res.status, JSON.stringify(res.data)).toBe(200);
	return res.data.user;
}

/** 資料庫裡的 R2 key：API 不會回傳，只能直接查 D1 */
async function storedKey(userId: string) {
	const row = await env.DB.prepare('SELECT avatar_key FROM users WHERE id = ?').bind(userId).first<{ avatar_key: string | null }>();
	return row!.avatar_key;
}

/** R2 裡這個使用者的全部頭像檔 */
async function avatarObjects(userId: string) {
	return (await env.BUCKET.list({ prefix: `users/${userId}/avatar-` })).objects.map((o) => o.key);
}

const keyPattern = (userId: string) => new RegExp(`^users/${userId}/avatar-[0-9a-f-]{36}$`);

describe('頭像（PRO-1）', () => {
	it('上傳後取回同樣的內容；標頭用偵測到的格式、不讓瀏覽器猜；只有目前的 ?v= 才快取一年', async () => {
		const c = await registeredClient();
		expect(c.user.avatarUpdatedAt).toBeNull();
		const none = await c.get('/api/auth/avatar');
		expect(none.status).toBe(404);
		expect(none.data.error).toBe('找不到頭像');

		// 瀏覽器說是 octet-stream：以實際內容判斷
		const user = await uploadAvatar(c, PNG_1X1, 'application/octet-stream');
		expect(user).toMatchObject({ id: c.user.id, email: c.email, displayName: c.user.displayName });
		expect(user).not.toHaveProperty('avatarKey');
		expect(Math.abs(user.avatarUpdatedAt - Date.now())).toBeLessThan(60_000);
		expect((await c.get('/api/auth/me')).data.user.avatarUpdatedAt).toBe(user.avatarUpdatedAt);

		const key = await storedKey(c.user.id);
		expect(key).toMatch(keyPattern(c.user.id));
		expect((await env.BUCKET.head(key!))?.httpMetadata?.contentType).toBe('image/png');

		// review 2：v 等於目前的 avatarUpdatedAt（avatarUrl() 的網址）才 immutable；沒帶 v 或 v 不對時每次重新驗證
		const cases: [string, string][] = [
			[`/api/auth/avatar?v=${user.avatarUpdatedAt}`, 'private, max-age=31536000, immutable'],
			['/api/auth/avatar', 'private, no-cache'],
			[`/api/auth/avatar?v=${user.avatarUpdatedAt - 1}`, 'private, no-cache'],
			['/api/auth/avatar?v=', 'private, no-cache'],
		];
		for (const [path, cacheControl] of cases) {
			const img = await c.get(path);
			expect(img.status, path).toBe(200);
			expect(new Uint8Array(img.data)).toEqual(PNG_1X1);
			expect(img.headers.get('content-type')).toBe('image/png');
			expect(img.headers.get('content-length')).toBe(String(PNG_1X1.byteLength));
			expect(img.headers.get('cache-control'), path).toBe(cacheControl);
			expect(img.headers.get('content-disposition')).toBe('inline');
			expect(img.headers.get('x-content-type-options')).toBe('nosniff');
		}
	});

	it('更換頭像：存成實際的格式、avatarUpdatedAt 變大、舊檔從 R2 刪除，只留一個檔', async () => {
		const c = await registeredClient();
		const first = await uploadAvatar(c, PNG_1X1);
		const firstKey = await storedKey(c.user.id);

		// 瀏覽器說是 PNG，實際上是 JPEG
		const second = await uploadAvatar(c, JPEG, 'image/png');
		const secondKey = await storedKey(c.user.id);
		expect(secondKey).toMatch(keyPattern(c.user.id));
		expect(secondKey).not.toBe(firstKey);
		expect(second.avatarUpdatedAt).toBeGreaterThan(first.avatarUpdatedAt);
		expect(await env.BUCKET.get(firstKey!)).toBeNull();
		expect(await avatarObjects(c.user.id)).toEqual([secondKey]);
		const jpeg = await c.get(`/api/auth/avatar?v=${second.avatarUpdatedAt}`);
		expect(jpeg.headers.get('content-type')).toBe('image/jpeg');
		expect(jpeg.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
		expect(new Uint8Array(jpeg.data)).toEqual(JPEG);
		// 過期的分頁還在用舊的 v：拿到的是新頭像，而且不會以舊網址被快取一年
		const stale = await c.get(`/api/auth/avatar?v=${first.avatarUpdatedAt}`);
		expect(new Uint8Array(stale.data)).toEqual(JPEG);
		expect(stale.headers.get('cache-control')).toBe('private, no-cache');

		const third = await uploadAvatar(c, WEBP, 'image/jpeg');
		expect(third.avatarUpdatedAt).toBeGreaterThan(second.avatarUpdatedAt);
		expect(await env.BUCKET.get(secondKey!)).toBeNull();
		expect(await avatarObjects(c.user.id)).toEqual([await storedKey(c.user.id)]);
		const webp = await c.get('/api/auth/avatar');
		expect(webp.headers.get('content-type')).toBe('image/webp');
		expect(new Uint8Array(webp.data)).toEqual(WEBP);
	});

	it('移除頭像：刪除 R2 檔、欄位回到 null、之後讀取回 404；沒有頭像時移除也回 200，之後可以再上傳', async () => {
		const c = await registeredClient();
		await uploadAvatar(c);
		const key = await storedKey(c.user.id);

		const res = await c.del('/api/auth/avatar');
		expect(res.status).toBe(200);
		expect(res.data.user).toMatchObject({ id: c.user.id, avatarUpdatedAt: null });
		expect(res.data.user).not.toHaveProperty('avatarKey');
		const row = await env.DB.prepare('SELECT avatar_key, avatar_updated_at FROM users WHERE id = ?').bind(c.user.id).first();
		expect(row).toEqual({ avatar_key: null, avatar_updated_at: null });
		expect(await env.BUCKET.get(key!)).toBeNull();
		expect(await avatarObjects(c.user.id)).toEqual([]);
		const gone = await c.get('/api/auth/avatar');
		expect(gone.status).toBe(404);
		expect(gone.data.error).toBe('找不到頭像');
		expect((await c.get('/api/auth/me')).data.user.avatarUpdatedAt).toBeNull();

		const again = await c.del('/api/auth/avatar');
		expect(again.status).toBe(200);
		expect(again.data.user.avatarUpdatedAt).toBeNull();

		const back = await uploadAvatar(c, JPEG);
		expect(back.avatarUpdatedAt).toEqual(expect.any(Number));
		expect(new Uint8Array((await c.get('/api/auth/avatar')).data)).toEqual(JPEG);
	});

	it('資料庫有紀錄、R2 卻找不到檔案時回 404', async () => {
		const c = await registeredClient();
		await uploadAvatar(c);
		await env.BUCKET.delete((await storedKey(c.user.id))!);
		const res = await c.get('/api/auth/avatar');
		expect(res.status).toBe(404);
		expect(res.data.error).toBe('找不到頭像');
	});

	it('驗證：沒有檔案 400、太大 413、不是 JPEG／PNG／WebP 415；失敗時原本的頭像不變', async () => {
		const c = await registeredClient();
		const original = await uploadAvatar(c);
		const originalKey = await storedKey(c.user.id);

		const noFile = new FormData();
		const textField = new FormData();
		textField.append('file', '不是檔案');
		const cases: [string, unknown, number, string][] = [
			['沒有 file 欄位', noFile, 400, '請選擇照片'],
			['file 是文字', textField, 400, '請選擇照片'],
			['空的檔案', avatarForm(new Uint8Array(0)), 400, '請選擇照片'],
			['送 JSON', { file: 'x' }, 400, '請選擇照片'],
			['沒有內容', undefined, 400, '請選擇照片'],
			['超過上限 1 byte', avatarForm(pngOfSize(AVATAR_MAX_BYTES + 1)), 413, '照片太大（上限 1MB）'],
			['遠超過上限', avatarForm(pngOfSize(AVATAR_MAX_BYTES + 64 * 1024)), 413, '照片太大（上限 1MB）'],
			['HTML 假裝成 PNG', avatarForm('<script>alert(1)</script>'), 415, '只支援 JPEG、PNG、WebP 圖片'],
			['SVG', avatarForm('<svg xmlns="http://www.w3.org/2000/svg"/>', 'a.svg', 'image/svg+xml'), 415, '只支援 JPEG、PNG、WebP 圖片'],
			['GIF', avatarForm(Uint8Array.from(ascii('GIF89a')), 'a.gif', 'image/gif'), 415, '只支援 JPEG、PNG、WebP 圖片'],
		];
		for (const [label, body, status, error] of cases) {
			const res = await c.put('/api/auth/avatar', body);
			expect(res.status, label).toBe(status);
			expect(res.data.error, label).toBe(error);
		}

		expect(await storedKey(c.user.id)).toBe(originalKey);
		expect(await avatarObjects(c.user.id)).toEqual([originalKey]);
		expect((await c.get('/api/auth/me')).data.user.avatarUpdatedAt).toBe(original.avatarUpdatedAt);
		expect(new Uint8Array((await c.get('/api/auth/avatar')).data)).toEqual(PNG_1X1);

		// 剛好 1MB 可以上傳
		expect((await c.put('/api/auth/avatar', avatarForm(pngOfSize(AVATAR_MAX_BYTES)))).status).toBe(200);
		expect((await env.BUCKET.head((await storedKey(c.user.id))!))?.size).toBe(AVATAR_MAX_BYTES);
		expect(await avatarObjects(c.user.id)).toHaveLength(1);
	});

	it('更換或移除頭像不會刪到同一個人的筆記照片', async () => {
		const c = await registeredClient();
		const note = (await c.post('/api/notes', { kind: 'note', title: '有照片的筆記' })).data.note;
		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'q.png', { type: 'image/png' }));
		const att = (await c.post(`/api/notes/${note.id}/attachments`, form)).data.attachment;

		await uploadAvatar(c);
		await uploadAvatar(c, JPEG);
		expect((await c.del('/api/auth/avatar')).status).toBe(200);

		const photo = await c.get(`/api/attachments/${att.id}`);
		expect(photo.status).toBe(200);
		expect(new Uint8Array(photo.data)).toEqual(PNG_1X1);
	});

	it('未登入回 401', async () => {
		const anon = createClient();
		const responses = [
			await anon.get('/api/auth/avatar'),
			await anon.put('/api/auth/avatar', avatarForm(PNG_1X1)),
			await anon.del('/api/auth/avatar'),
		];
		for (const res of responses) {
			expect(res.status).toBe(401);
			expect(res.data.error).toBe('請先登入');
		}
	});
});

describe('頭像的併發與時鐘（review 3）', () => {
	it('同時送出 6 次上傳：全部成功、avatarUpdatedAt 都不同、R2 只留資料庫指向的那一個', async () => {
		const c = await registeredClient();
		const results = await Promise.all(Array.from({ length: 6 }, () => c.put('/api/auth/avatar', avatarForm(PNG_1X1))));
		expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));
		const stamps: number[] = results.map((r) => r.data.user.avatarUpdatedAt);
		expect(new Set(stamps).size).toBe(6);
		const key = await storedKey(c.user.id);
		expect(key).toMatch(keyPattern(c.user.id));
		expect(await avatarObjects(c.user.id)).toEqual([key]);
		// 嚴格遞增：最後寫入資料庫的就是最大的那一個
		expect((await c.get('/api/auth/me')).data.user.avatarUpdatedAt).toBe(Math.max(...stamps));
	});

	it('上傳與移除同時送出：資料庫與 R2 的結果一致', async () => {
		const c = await registeredClient();
		await uploadAvatar(c);
		for (let round = 0; round < 5; round++) {
			const [put, del] = await Promise.all([c.put('/api/auth/avatar', avatarForm(JPEG)), c.del('/api/auth/avatar')]);
			expect([put.status, del.status], `第 ${round} 輪`).toEqual([200, 200]);
			const key = await storedKey(c.user.id);
			expect(await avatarObjects(c.user.id), `第 ${round} 輪`).toEqual(key ? [key] : []);
			expect((await c.get('/api/auth/me')).data.user.avatarUpdatedAt === null, `第 ${round} 輪`).toBe(key === null);
			expect((await c.get('/api/auth/avatar')).status, `第 ${round} 輪`).toBe(key ? 200 : 404);
		}
	});

	it('同一毫秒內連續上傳、時鐘倒退時，avatarUpdatedAt 仍然嚴格遞增', async () => {
		const c = await registeredClient();
		const T = Date.now();
		const now = vi.spyOn(Date, 'now').mockReturnValue(T);
		try {
			const stamps: number[] = [];
			for (let i = 0; i < 3; i++) stamps.push((await uploadAvatar(c)).avatarUpdatedAt);
			expect(stamps).toEqual([T, T + 1, T + 2]);
			now.mockReturnValue(T - 60_000); // 時鐘倒退一分鐘
			expect((await uploadAvatar(c)).avatarUpdatedAt).toBe(T + 3);
			now.mockReturnValue(T + 10_000); // 時鐘超過之後就用現在的時間
			expect((await uploadAvatar(c)).avatarUpdatedAt).toBe(T + 10_000);
		} finally {
			now.mockRestore();
		}
		expect(await avatarObjects(c.user.id)).toHaveLength(1);
	});
});

describe('頭像的跨使用者隔離', () => {
	it('只讀得到自己的頭像；不能把頭像指到別人的檔案；換掉或移除自己的頭像不影響別人', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const a = await uploadAvatar(alice, PNG_1X1);
		const aliceKey = await storedKey(alice.user.id);

		// Bob 沒有頭像：帶 Alice 的 ?v= 也只會讀 Bob 自己的
		for (const path of ['/api/auth/avatar', `/api/auth/avatar?v=${a.avatarUpdatedAt}`]) {
			const res = await bob.get(path);
			expect(res.status, path).toBe(404);
			expect(res.data.error).toBe('找不到頭像');
		}
		expect((await bob.get('/api/auth/me')).data.user).toMatchObject({ id: bob.user.id, displayName: 'Bob', avatarUpdatedAt: null });

		// PATCH /me 不接受頭像欄位（會被忽略），不能指到 Alice 的檔案
		const hijack = await bob.patch('/api/auth/me', { avatarKey: aliceKey, avatarUpdatedAt: a.avatarUpdatedAt });
		expect(hijack.status).toBe(200);
		expect(hijack.data.user.avatarUpdatedAt).toBeNull();
		expect(await storedKey(bob.user.id)).toBeNull();
		expect((await bob.get('/api/auth/avatar')).status).toBe(404);

		// Bob 上傳、移除自己的頭像，Alice 的頭像與檔案都不受影響
		await uploadAvatar(bob, JPEG);
		expect(new Uint8Array((await bob.get('/api/auth/avatar')).data)).toEqual(JPEG);
		expect(new Uint8Array((await alice.get('/api/auth/avatar')).data)).toEqual(PNG_1X1);
		expect((await bob.del('/api/auth/avatar')).status).toBe(200);
		expect(await storedKey(alice.user.id)).toBe(aliceKey);
		expect(await env.BUCKET.head(aliceKey!)).not.toBeNull();
		expect(await avatarObjects(alice.user.id)).toEqual([aliceKey]);
		expect((await alice.get('/api/auth/me')).data.user.avatarUpdatedAt).toBe(a.avatarUpdatedAt);
		expect((await alice.get('/api/auth/avatar')).status).toBe(200);
	});

	it('任何回應都不包含頭像的 R2 key', async () => {
		const c = await registeredClient();
		const put = await c.put('/api/auth/avatar', avatarForm(PNG_1X1));
		const key = (await storedKey(c.user.id))!;
		const login = await c.post('/api/auth/login', { email: c.email, password: 'correct-horse-battery' });
		const bodies = [
			put.data,
			login.data,
			(await c.get('/api/auth/me')).data,
			(await c.patch('/api/auth/me', { displayName: '新暱稱' })).data,
			(await c.get('/api/export/backup.json')).data,
			(await c.del('/api/auth/avatar')).data,
		];
		expect(login.data.user.avatarUpdatedAt).toBe(put.data.user.avatarUpdatedAt);
		for (const body of bodies) {
			const raw = JSON.stringify(body);
			expect(raw).not.toMatch(/avatarKey|avatar_key/i);
			expect(raw).not.toContain(key);
		}
	});
});

describe('JSON 備份與頭像', () => {
	it('使用者資料只多了 avatarUpdatedAt，不含頭像的儲存位置', async () => {
		const c = await registeredClient('小明');
		const user = await uploadAvatar(c);
		const key = (await storedKey(c.user.id))!;

		const res = await c.get('/api/export/backup.json');
		expect(res.status).toBe(200);
		expect(res.data.user).toEqual({ ...c.user, avatarUpdatedAt: user.avatarUpdatedAt });
		const raw = JSON.stringify(res.data);
		expect(raw).not.toMatch(/avatarKey|avatar_key/i);
		expect(raw).not.toContain(key);
	});
});

const EMPTY_SUMMARY: ProfileSummary = {
	totalMinutes: 0,
	totalSessions: 0,
	currentStreak: 0,
	longestStreak: 0,
	tasksDone: 0,
	mistakesMastered: 0,
	achievements: { unlocked: 0, total: 12, badges: [] },
};

async function summary(c: Client): Promise<ProfileSummary> {
	const res = await c.get('/api/profile/summary');
	expect(res.status, JSON.stringify(res.data)).toBe(200);
	return res.data;
}

describe('個人檔案摘要（PRO-1）', () => {
	it('新帳號全是 0；成就總數和成就頁一致；不被快取', async () => {
		const c = await registeredClient();
		const res = await c.get('/api/profile/summary');
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(res.data).toEqual(EMPTY_SUMMARY);
		expect((await c.get('/api/achievements')).data.achievements).toHaveLength(EMPTY_SUMMARY.achievements.total);
	});

	it('學習紀錄、完成的任務、掌握的錯題都算進去；數字和成就頁、總覽一致', async () => {
		const c = await noonClient();
		// 目前連續 3 天（前天、昨天、今天）；更早有一段連續 7 天
		await logSession(c, c.today, 9, 30);
		await logSession(c, c.today, 10, 26, { durationSec: 25 * 60 + 40 });
		await logSession(c, addDays(c.today, -1), 9, 45);
		await logSession(c, addDays(c.today, -2), 9, 20);
		for (let i = 0; i < 7; i++) await logSession(c, addDays(c.today, -20 + i), 9, 10);

		// 完成 2 個任務；進行中、待辦的不算
		const todo = (await c.post('/api/tasks', { title: '完成一' })).data.task;
		await c.patch(`/api/tasks/${todo.id}`, { status: 'done' });
		await c.post('/api/tasks', { title: '完成二', status: 'done' });
		await c.post('/api/tasks', { title: '進行中', status: 'doing' });
		await c.post('/api/tasks', { title: '待辦' });

		// 掌握 10 題錯題（9 題直接寫入資料庫，第 10 題用 API）；還沒掌握的錯題、標成掌握的一般筆記都不算
		const now = Date.now();
		const insert = env.DB.prepare(
			"INSERT INTO notes (id, user_id, kind, title, mastered, created_at, updated_at) VALUES (?, ?, 'mistake', ?, 1, ?, ?)",
		);
		await env.DB.batch(Array.from({ length: 9 }, (_, i) => insert.bind(crypto.randomUUID(), c.user.id, `錯題 ${i}`, now, now)));
		const tenth = (await c.post('/api/notes', { kind: 'mistake', title: '第十題' })).data.note;
		await c.patch(`/api/notes/${tenth.id}`, { mastered: true });
		await c.post('/api/notes', { kind: 'mistake', title: '還沒掌握' });
		const plain = (await c.post('/api/notes', { kind: 'note', title: '一般筆記' })).data.note;
		await c.patch(`/api/notes/${plain.id}`, { mastered: true });

		const s = await summary(c);
		// 30 + 25:40 + 45 + 20 + 7 × 10 分 = 11440 秒 = 190.67 分 → 無條件捨去 190
		expect(s).toEqual({
			totalMinutes: 190,
			totalSessions: 11,
			currentStreak: 3,
			longestStreak: 7,
			tasksDone: 2,
			mistakesMastered: 10,
			achievements: {
				unlocked: 3,
				total: 12,
				// 三個都是經過 API 解鎖的，都有解鎖時間；「最近解鎖的在前」的順序在 achievement-unlocks.spec.ts 測
				badges: expect.arrayContaining([
					{ id: 'first-session', title: '踏出第一步', icon: 'sparkles', unlockedAt: expect.any(Number) },
					{ id: 'streak-7', title: '連續一週', icon: 'flame', unlockedAt: expect.any(Number) },
					{ id: 'mastered-10', title: '錯題剋星', icon: 'brain', unlockedAt: expect.any(Number) },
				]),
			},
		});
		expect(s.achievements.badges).toHaveLength(3);

		const list: Achievement[] = (await c.get('/api/achievements')).data.achievements;
		const unlocked = list.filter((a) => a.unlocked);
		const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
		expect(s.achievements.total).toBe(list.length);
		expect(s.achievements.unlocked).toBe(unlocked.length);
		// 徽章和成就頁的已解鎖成就一致，解鎖時間也相同
		expect([...s.achievements.badges].sort(byId)).toEqual(
			unlocked.map(({ id, title, icon, unlockedAt }) => ({ id, title, icon, unlockedAt })).sort(byId),
		);
		const progress = Object.fromEntries(list.map((a) => [a.id, a.progress]));
		expect(progress).toMatchObject({
			'first-session': 1,
			'streak-30': s.longestStreak,
			'mastered-50': s.mistakesMastered,
			'tasks-50': s.tasksDone,
		});
		expect((await c.get('/api/dashboard')).data.streak).toBe(s.currentStreak);

		// 即時計算：取消掌握第十題後，數字與徽章跟著變
		await c.patch(`/api/notes/${tenth.id}`, { mastered: false });
		const after = await summary(c);
		expect(after.mistakesMastered).toBe(9);
		expect(after.achievements.badges.map((b) => b.id).sort()).toEqual(['first-session', 'streak-7']);
	});

	it('累積分鐘數無條件捨去：換算成時數後和成就頁一致（3599 秒是 59 分、0.9 小時）', async () => {
		const c = await registeredClient();
		/** 前端顯示累積時數的算法 */
		const hours = (s: ProfileSummary) => Math.floor(s.totalMinutes / 6) / 10;
		const achievementHours = async () => {
			const list: Achievement[] = (await c.get('/api/achievements')).data.achievements;
			return list.find((a) => a.id === 'hours-10')!.progress;
		};

		const end = Date.now() - 10 * 60_000;
		const first = await c.post('/api/study-sessions', { mode: 'stopwatch', startedAt: end - 3_600_000, endedAt: end, durationSec: 3599 });
		expect(first.status, JSON.stringify(first.data)).toBe(201);
		let s = await summary(c);
		expect(s.totalMinutes).toBe(59);
		expect(hours(s)).toBe(0.9);
		expect(await achievementHours()).toBe(0.9);

		// 再多 1 秒剛好滿 1 小時：兩邊同時進位
		const second = await c.post('/api/study-sessions', {
			mode: 'stopwatch',
			startedAt: end + 60_000,
			endedAt: end + 61_000,
			durationSec: 1,
		});
		expect(second.status, JSON.stringify(second.data)).toBe(201);
		s = await summary(c);
		expect(s.totalMinutes).toBe(60);
		expect(hours(s)).toBe(1);
		expect(await achievementHours()).toBe(1);
	});

	it('連續天數依使用者時區的當地日期計算', async () => {
		const c = await registeredClient(); // Asia/Taipei
		const tz = 'Asia/Taipei';
		const d = today(tz);
		// 台北的前天 23:30 與昨天 00:10：在台北是連續兩天，在 UTC 是同一天
		for (const [date, time] of [
			[addDays(d, -2), '23:30'],
			[addDays(d, -1), '00:10'],
		]) {
			const startedAt = zonedTime(date, time, tz);
			const res = await c.post('/api/study-sessions', { mode: 'manual', startedAt, endedAt: startedAt + 20 * 60_000 });
			expect(res.status, JSON.stringify(res.data)).toBe(201);
		}
		const taipei = await summary(c);
		expect(taipei).toMatchObject({ totalMinutes: 40, totalSessions: 2, currentStreak: 2, longestStreak: 2 });
		expect((await c.get('/api/dashboard')).data.streak).toBe(2);

		await c.patch('/api/auth/me', { timezone: 'UTC' });
		const utc = await summary(c);
		expect(utc).toMatchObject({ totalMinutes: 40, totalSessions: 2, longestStreak: 1 });
		// UTC 的「今天」依執行時間是台北的今天或昨天：和總覽用同一個算法，結果一定相同
		expect(utc.currentStreak).toBe((await c.get('/api/dashboard')).data.streak);
	});
});

describe('個人檔案摘要的跨使用者隔離', () => {
	it('只計算本人的資料；別人的任務、錯題回 404，引用別人的任務回 400', async () => {
		const alice = await noonClient('Alice');
		const bob = await registeredClient('Bob');
		await logSession(alice, alice.today, 9, 60);
		const task = (await alice.post('/api/tasks', { title: 'Alice 的任務', status: 'done' })).data.task;
		const mistake = (await alice.post('/api/notes', { kind: 'mistake', title: 'Alice 的錯題' })).data.note;
		await alice.patch(`/api/notes/${mistake.id}`, { mastered: true });

		// 不能改別人的任務與錯題，也不能把自己的時間掛到別人的任務上
		expect((await bob.patch(`/api/tasks/${task.id}`, { status: 'todo' })).status).toBe(404);
		expect((await bob.patch(`/api/notes/${mistake.id}`, { mastered: false })).status).toBe(404);
		const now = Date.now();
		const hijack = await bob.post('/api/study-sessions', {
			mode: 'manual',
			startedAt: now - 600_000,
			endedAt: now - 60_000,
			taskId: task.id,
		});
		expect(hijack.status).toBe(400);
		expect(hijack.data.error).toBe('找不到指定的任務');

		expect(await summary(bob)).toEqual(EMPTY_SUMMARY);
		expect(await summary(alice)).toEqual({
			totalMinutes: 60,
			totalSessions: 1,
			currentStreak: 1,
			longestStreak: 1,
			tasksDone: 1,
			mistakesMastered: 1,
			achievements: {
				unlocked: 1,
				total: 12,
				badges: [{ id: 'first-session', title: '踏出第一步', icon: 'sparkles', unlockedAt: expect.any(Number) }],
			},
		});
	});

	it('未登入回 401', async () => {
		const res = await createClient().get('/api/profile/summary');
		expect(res.status).toBe(401);
		expect(res.data.error).toBe('請先登入');
	});
});

describe('連續天數超過一年（review 3）', () => {
	it('個人檔案看全部歷史；總覽只讀近 366 天，今天有讀書時最多 366、還沒讀書時最多 365', async () => {
		const c = await noonClient();
		// 直接寫入今天到 399 天前、每天 9:00 開始 10 分鐘的紀錄
		const insert = env.DB.prepare(
			"INSERT INTO study_sessions (id, user_id, mode, started_at, ended_at, duration_sec, created_at) VALUES (?, ?, 'manual', ?, ?, 600, ?)",
		);
		const startOf = (daysAgo: number) => startOfLocalDay(addDays(c.today, -daysAgo), c.tz) + 9 * 3_600_000;
		await env.DB.batch(
			Array.from({ length: 400 }, (_, i) => insert.bind(crypto.randomUUID(), c.user.id, startOf(i), startOf(i) + 600_000, startOf(i))),
		);

		expect(await summary(c)).toMatchObject({ totalSessions: 400, totalMinutes: 4000, currentStreak: 400, longestStreak: 400 });
		expect((await c.get('/api/dashboard')).data.streak).toBe(366);

		// 今天還沒讀書：從昨天算起
		await env.DB.prepare('DELETE FROM study_sessions WHERE user_id = ? AND started_at >= ?')
			.bind(c.user.id, startOf(0) - 9 * 3_600_000)
			.run();
		expect(await summary(c)).toMatchObject({ totalSessions: 399, currentStreak: 399, longestStreak: 399 });
		expect((await c.get('/api/dashboard')).data.streak).toBe(365);
	});
});
