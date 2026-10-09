import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { addDays, today } from '../src/shared/dates';
import { makeNote, noonClient, PNG_1X1, registeredClient, type Client, type NoonClient } from './helpers';

async function upload(c: Client, noteId: string) {
	const form = new FormData();
	form.append('file', new File([PNG_1X1], 'p.png', { type: 'image/png' }));
	const res = await c.post(`/api/notes/${noteId}/attachments`, form);
	expect(res.status).toBe(201);
	return res.data.attachment;
}

const setUpdatedAt = (id: string, ts: number) => env.DB.prepare('UPDATE notes SET updated_at = ? WHERE id = ?').bind(ts, id).run();
const titles = async (c: Client, query = '') => (await c.get(`/api/notes${query}`)).data.notes.map((n: { title: string }) => n.title);

describe('釘選筆記（NOTE-1）', () => {
	it('釘選的排最前面，其次依更新時間；釘選不改變更新時間與複習排程', async () => {
		const c = await registeredClient();
		const a = await makeNote(c, 'A');
		const b = await makeNote(c, 'B');
		const m = await makeNote(c, '錯題 M', { kind: 'mistake' });
		await setUpdatedAt(a.id, 3_000);
		await setUpdatedAt(b.id, 2_000);
		await setUpdatedAt(m.id, 1_000);
		expect(await titles(c)).toEqual(['A', 'B', '錯題 M']);

		const pinned = (await c.patch(`/api/notes/${m.id}`, { pinned: true })).data.note;
		expect(pinned).toMatchObject({ pinned: true, updatedAt: 1_000, reviewStage: 0, mastered: false, nextReviewDate: m.nextReviewDate });
		expect(await titles(c)).toEqual(['錯題 M', 'A', 'B']);

		// 都釘選時，釘選的之間依更新時間
		await c.patch(`/api/notes/${b.id}`, { pinned: true });
		expect(await titles(c)).toEqual(['B', '錯題 M', 'A']);

		expect((await c.patch(`/api/notes/${m.id}`, { pinned: false })).data.note).toMatchObject({ pinned: false, updatedAt: 1_000 });
		expect(await titles(c)).toEqual(['B', 'A', '錯題 M']);
		expect((await c.get(`/api/notes/${b.id}`)).data.note).toMatchObject({ pinned: true, updatedAt: 2_000 });
	});

	it('套用篩選時，符合條件的釘選筆記仍然排在最前面', async () => {
		const c = await registeredClient();
		const m1 = await makeNote(c, '遞迴錯題 1', { kind: 'mistake' });
		const m2 = await makeNote(c, '遞迴錯題 2', { kind: 'mistake', tags: ['遞迴'] });
		const n = await makeNote(c, '遞迴筆記', { tags: ['遞迴'] });
		await setUpdatedAt(m1.id, 3_000);
		await setUpdatedAt(m2.id, 2_000);
		await setUpdatedAt(n.id, 4_000);
		await c.patch(`/api/notes/${m2.id}`, { pinned: true });
		await c.patch(`/api/notes/${n.id}`, { pinned: true });

		expect(await titles(c, '?kind=mistake')).toEqual(['遞迴錯題 2', '遞迴錯題 1']);
		expect(await titles(c, `?q=${encodeURIComponent('遞迴')}`)).toEqual(['遞迴筆記', '遞迴錯題 2', '遞迴錯題 1']);
		expect(await titles(c, `?tag=${encodeURIComponent('遞迴')}`)).toEqual(['遞迴筆記', '遞迴錯題 2']);
	});

	it('同時修改內容時照常更新「最後更新」時間；pinned 必須是 true／false', async () => {
		const c = await registeredClient();
		const a = await makeNote(c, 'A');
		await setUpdatedAt(a.id, 1_000);
		const edited = (await c.patch(`/api/notes/${a.id}`, { pinned: true, title: 'A（改）' })).data.note;
		expect(edited.pinned).toBe(true);
		expect(edited.updatedAt).toBeGreaterThan(1_000);

		const bad = await c.patch(`/api/notes/${a.id}`, { pinned: 'yes' });
		expect(bad.status).toBe(400);
		expect(bad.data.error).toBe('釘選格式錯誤');

		// 沒有任何欄位的 PATCH 不改動資料
		await setUpdatedAt(a.id, 2_000);
		const noop = await c.patch(`/api/notes/${a.id}`, {});
		expect(noop.status).toBe(200);
		expect(noop.data.note).toMatchObject({ title: 'A（改）', pinned: true, updatedAt: 2_000 });
	});
});

describe('筆記列表的照片（BUG-1）', () => {
	it('筆記超過 100 則時列表仍正常，照片對應到正確的筆記', async () => {
		// D1 每個查詢最多 100 個參數：測試端的 env.DB 包了這個上限（test/apply-migrations.ts），
		// 改回 inArray(筆記 id) 的話，這裡的列表查詢會失敗
		const c = await registeredClient();
		const base = Date.now() - 1_000_000;
		const ids = Array.from({ length: 120 }, () => crypto.randomUUID());
		const insert = env.DB.prepare("INSERT INTO notes (id, user_id, kind, title, created_at, updated_at) VALUES (?, ?, 'note', ?, ?, ?)");
		await env.DB.batch(ids.map((id, i) => insert.bind(id, c.user.id, `筆記 ${i}`, base + i, base + i)));

		const first = [await upload(c, ids[0]), await upload(c, ids[0])];
		const last = await upload(c, ids[119]);

		const res = await c.get('/api/notes');
		expect(res.status).toBe(200);
		const list: { id: string; attachments: { id: string; noteId: string }[] }[] = res.data.notes;
		expect(list).toHaveLength(120);
		const byId = new Map(list.map((n) => [n.id, n]));
		expect(
			byId
				.get(ids[0])!
				.attachments.map((a) => a.id)
				.sort(),
		).toEqual(first.map((a) => a.id).sort());
		expect(byId.get(ids[119])!.attachments).toMatchObject([{ id: last.id, noteId: ids[119] }]);
		expect(list.filter((n) => n.attachments.length === 0)).toHaveLength(118);

		// 篩選後的列表與單筆查詢也正常
		const filtered = (await c.get(`/api/notes?q=${encodeURIComponent('筆記 119')}`)).data.notes;
		expect(filtered).toMatchObject([{ id: ids[119], attachments: [{ id: last.id }] }]);
		expect((await c.get(`/api/notes/${ids[0]}`)).data.note.attachments).toHaveLength(2);
	});
});

describe('筆記搜尋', () => {
	it('長的中文關鍵字也能搜尋；英文不分大小寫，% 與 _ 是一般字元', async () => {
		const c = await registeredClient();
		// 25 個中文字 = 75 bytes，超過 D1 LIKE pattern 的 50 bytes 上限
		const long = '資料結構與演算法期中考重點整理第一章到第五章完整版';
		await makeNote(c, `${long}（上）`);
		await makeNote(c, '內容裡有', { content: `前言 ${long} 結尾` });
		await makeNote(c, '其他');
		const res = await c.get(`/api/notes?q=${encodeURIComponent(long)}`);
		expect(res.status).toBe(200);
		expect(res.data.notes).toHaveLength(2);

		await makeNote(c, 'Big-O Notation', { content: '100% 會考' });
		await makeNote(c, 'snake_case 命名');
		expect(await titles(c, '?q=big-o')).toEqual(['Big-O Notation']);
		expect(await titles(c, `?q=${encodeURIComponent('%')}`)).toEqual(['Big-O Notation']);
		expect(await titles(c, `?q=${encodeURIComponent('_')}`)).toEqual(['snake_case 命名']);
	});
});

describe('筆記的跨使用者隔離', () => {
	it('不能釘選別人的筆記；列表只帶自己的照片；引用別人的科目回 400', async () => {
		const alice = await registeredClient('Alice');
		const bob = await registeredClient('Bob');
		const aliceNote = await makeNote(alice, 'Alice 的筆記');
		const aliceAtt = await upload(alice, aliceNote.id);
		const bobNote = await makeNote(bob, 'Bob 的筆記');
		const aliceSubject = (await alice.post('/api/subjects', { name: '化學', color: '#2a78d6' })).data.subject;

		const res = await bob.patch(`/api/notes/${aliceNote.id}`, { pinned: true });
		expect(res.status).toBe(404);
		expect(res.data.error).toBe('找不到此筆記');
		const bad = await bob.patch(`/api/notes/${bobNote.id}`, { pinned: true, subjectId: aliceSubject.id });
		expect(bad.status).toBe(400);
		expect(bad.data.error).toBe('找不到指定的科目');

		expect((await bob.get('/api/notes')).data.notes).toMatchObject([{ id: bobNote.id, pinned: false, attachments: [] }]);
		expect((await alice.get('/api/notes')).data.notes).toMatchObject([
			{ id: aliceNote.id, pinned: false, attachments: [{ id: aliceAtt.id }] },
		]);
	});
});

const TZ = 'Asia/Taipei';

describe('筆記、錯題與複習', () => {
	it('錯題預設排入明天複習，答對逐步拉長間隔，全部通過即掌握', async () => {
		const c = await registeredClient();
		const n = (
			await c.post('/api/notes', { kind: 'mistake', title: '遞迴時間複雜度', question: 'T(n)=2T(n/2)+n', correctAnswer: 'O(n log n)' })
		).data.note;
		expect(n.nextReviewDate).toBe(addDays(today(TZ), 1));

		// 模擬已到複習日
		await env.DB.prepare('UPDATE notes SET next_review_date = ? WHERE id = ?').bind(today(TZ), n.id).run();
		expect((await c.get('/api/notes?review=due')).data.notes).toHaveLength(1);

		let note = (await c.post(`/api/notes/${n.id}/review`, { result: 'remembered' })).data.note;
		expect(note).toMatchObject({ reviewStage: 1, nextReviewDate: addDays(today(TZ), 3), mastered: false });
		expect((await c.get('/api/notes?review=due')).data.notes).toHaveLength(0);

		note = (await c.post(`/api/notes/${n.id}/review`, { result: 'forgot' })).data.note;
		expect(note).toMatchObject({ reviewStage: 0, nextReviewDate: addDays(today(TZ), 1) });

		for (let i = 0; i < 5; i++) note = (await c.post(`/api/notes/${n.id}/review`, { result: 'remembered' })).data.note;
		expect(note).toMatchObject({ mastered: true, nextReviewDate: null });
	});

	it('一般筆記預設不排複習，可搜尋關鍵字與標籤', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'note', title: 'TCP 三向交握', content: 'SYN → SYN-ACK → ACK', tags: ['網路'] })).data
			.note;
		expect(n.nextReviewDate).toBeNull();
		await c.post('/api/notes', { kind: 'note', title: '100% 會考', content: '無關內容' });

		expect((await c.get('/api/notes?q=SYN-ACK')).data.notes).toHaveLength(1);
		expect((await c.get(`/api/notes?q=${encodeURIComponent('%')}`)).data.notes).toHaveLength(1);
		expect((await c.get(`/api/notes?tag=${encodeURIComponent('網路')}`)).data.notes).toHaveLength(1);
	});

	it('照片上傳到 R2，檢查真實格式，刪除筆記時一併刪除照片', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'mistake', title: '看圖題' })).data.note;

		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'q.png', { type: 'image/png' }));
		const up = await c.post(`/api/notes/${n.id}/attachments`, form);
		expect(up.status).toBe(201);
		expect(up.data.attachment.contentType).toBe('image/png');

		const img = await c.get(`/api/attachments/${up.data.attachment.id}`);
		expect(img.status).toBe(200);
		expect(img.headers.get('content-type')).toBe('image/png');
		expect(new Uint8Array(img.data)).toEqual(PNG_1X1);

		// 副檔名是 .png 但內容是 HTML：要擋下
		const fake = new FormData();
		fake.append('file', new File(['<script>alert(1)</script>'], 'x.png', { type: 'image/png' }));
		expect((await c.post(`/api/notes/${n.id}/attachments`, fake)).status).toBe(415);

		const detail = (await c.get(`/api/notes/${n.id}`)).data.note;
		expect(detail.attachments).toHaveLength(1);

		await c.del(`/api/notes/${n.id}`);
		expect(await env.BUCKET.get(`users/${c.user.id}/${up.data.attachment.id}`)).toBeNull();
	});

	it('照片上傳：沒有選檔、送的不是表單、空檔案都回 400「請選擇照片」（和頭像相同），不會變成 500', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'mistake', title: '看圖題' })).data.note;
		const url = `/api/notes/${n.id}/attachments`;

		const noFile = await c.post(url, new FormData());
		const json = await c.post(url, { file: 'not-a-file' });
		const noBody = await c.post(url);
		const empty = new FormData();
		empty.append('file', new File([], 'empty.png', { type: 'image/png' }));
		const emptyFile = await c.post(url, empty);

		for (const res of [noFile, json, noBody, emptyFile]) {
			expect(res.status, JSON.stringify(res.data)).toBe(400);
			expect(res.data.error).toBe('請選擇照片');
		}
		expect((await c.get(`/api/notes/${n.id}`)).data.note.attachments).toEqual([]);
	});

	it('照片上傳先檢查送來的內容（400），再找筆記（404）：和其他路由的順序一致', async () => {
		const c = await registeredClient();
		const missing = `/api/notes/${crypto.randomUUID()}/attachments`;
		const empty = await c.post(missing, new FormData());
		expect(empty.status, JSON.stringify(empty.data)).toBe(400);
		expect(empty.data.error).toBe('請選擇照片');
		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'p.png', { type: 'image/png' }));
		expect((await c.post(missing, form)).status).toBe(404);
	});

	it('刪除單張照片：資料列與 R2 的檔案都刪掉，再刪一次回 404', async () => {
		const c = await registeredClient();
		const n = (await c.post('/api/notes', { kind: 'mistake', title: '看圖題' })).data.note;
		const form = new FormData();
		form.append('file', new File([PNG_1X1], 'q.png', { type: 'image/png' }));
		const photo = (await c.post(`/api/notes/${n.id}/attachments`, form)).data.attachment;

		expect((await c.del(`/api/attachments/${photo.id}`)).status).toBe(200);
		expect(await env.BUCKET.get(`users/${c.user.id}/${photo.id}`)).toBeNull();
		expect((await c.get(`/api/notes/${n.id}`)).data.note.attachments).toEqual([]);
		expect((await c.del(`/api/attachments/${photo.id}`)).status).toBe(404);
	});
});

describe('已掌握題目的定期複習', () => {
	async function masteredMistake(c: Client, title: string) {
		const n = await makeNote(c, title, { kind: 'mistake' });
		const res = await c.patch(`/api/notes/${n.id}`, { mastered: true });
		expect(res.status, JSON.stringify(res.data)).toBe(200);
		return res.data.note;
	}
	const reviewDateOf = async (c: NoonClient, id: string) => (await c.get(`/api/notes/${id}`)).data.note.nextReviewDate;

	it('預設不提醒；設定成每 30 天後，跟著預設的已掌握題目排到 30 天後，改回不提醒就清掉', async () => {
		const c = await noonClient();
		const n = await masteredMistake(c, '已掌握');
		expect(n.nextReviewDate).toBeNull();

		const me = await c.patch('/api/auth/me', { masteredReviewDays: 30 });
		expect(me.data.user.masteredReviewDays).toBe(30);
		expect(await reviewDateOf(c, n.id)).toBe(addDays(c.today, 30));

		await c.patch('/api/auth/me', { masteredReviewDays: null });
		expect(await reviewDateOf(c, n.id)).toBeNull();
	});

	it('單則的設定優先（0 = 不提醒、N = 每 N 天），之後改預設也不影響它', async () => {
		const c = await noonClient();
		await c.patch('/api/auth/me', { masteredReviewDays: 30 });
		const n = await masteredMistake(c, '每週複習');
		expect(n.nextReviewDate).toBe(addDays(c.today, 30));

		const weekly = (await c.patch(`/api/notes/${n.id}`, { masteredReviewDays: 7 })).data.note;
		expect(weekly).toMatchObject({ masteredReviewDays: 7, nextReviewDate: addDays(c.today, 7) });
		expect((await c.patch(`/api/notes/${n.id}`, { masteredReviewDays: 0 })).data.note.nextReviewDate).toBeNull();

		await c.patch('/api/auth/me', { masteredReviewDays: 60 });
		expect(await reviewDateOf(c, n.id)).toBeNull();
	});

	it('到期時出現在今天到期；記住了仍是已掌握、再隔 N 天；還不熟就從頭開始並取消已掌握', async () => {
		const c = await noonClient();
		const n = await masteredMistake(c, '定期複習');
		await c.patch(`/api/notes/${n.id}`, { masteredReviewDays: 14 });
		await env.DB.prepare('UPDATE notes SET next_review_date = ? WHERE id = ?').bind(c.today, n.id).run();
		expect((await c.get('/api/notes?review=due')).data.notes.map((x: { id: string }) => x.id)).toContain(n.id);

		const remembered = (await c.post(`/api/notes/${n.id}/review`, { result: 'remembered' })).data.note;
		expect(remembered).toMatchObject({ mastered: true, nextReviewDate: addDays(c.today, 14) });
		const forgot = (await c.post(`/api/notes/${n.id}/review`, { result: 'forgot' })).data.note;
		expect(forgot).toMatchObject({ mastered: false, reviewStage: 0, nextReviewDate: addDays(c.today, 1) });
	});

	it('同時送「標成已掌握」與「加入排程」：以已掌握為準，預設不提醒時沒有複習日', async () => {
		const c = await registeredClient();
		const n = await makeNote(c, '一般筆記');
		expect((await c.patch(`/api/notes/${n.id}`, { mastered: true, scheduleReview: true })).data.note).toMatchObject({
			mastered: true,
			nextReviewDate: null,
		});
	});

	it('間隔超出範圍時回 400（中文訊息）；使用者的預設不能是 0', async () => {
		const c = await registeredClient();
		const me = await c.patch('/api/auth/me', { masteredReviewDays: 0 });
		expect(me.status).toBe(400);
		expect(me.data.error).toBe('複習間隔需介於 1–365 天');
		const n = await makeNote(c, '筆記');
		const res = await c.patch(`/api/notes/${n.id}`, { masteredReviewDays: 366 });
		expect(res.status).toBe(400);
		expect(res.data.error).toBe('複習間隔需介於 1–365 天');
	});
});
