import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { AVATAR_MAX_BYTES } from '../src/shared/schemas';
import { createClient, PNG_1X1, registeredClient, type Client } from './helpers';
import { MINUTE_MS } from '../src/shared/time';

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
		expect(Math.abs(user.avatarUpdatedAt - Date.now())).toBeLessThan(MINUTE_MS);
		expect((await c.get('/api/auth/me')).data.user.avatarUpdatedAt).toBe(user.avatarUpdatedAt);

		const key = await storedKey(c.user.id);
		expect(key).toMatch(keyPattern(c.user.id));
		expect((await env.BUCKET.head(key!))?.httpMetadata?.contentType).toBe('image/png');

		// v 等於目前的 avatarUpdatedAt（avatarUrl() 的網址）才 immutable；沒帶 v 或 v 不對時每次重新驗證
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

describe('頭像的併發與時鐘', () => {
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
			now.mockReturnValue(T - MINUTE_MS); // 時鐘倒退一分鐘
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
