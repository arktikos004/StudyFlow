import { createExecutionContext, env, SELF, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { NOTE_TAGS_MAX, NOTE_TITLE_MAX } from '../src/shared/schemas';
import worker from '../src/worker/index';
import { API_BODY_MAX_BYTES } from '../src/worker/middleware/body-limit';
import { BASE, createClient, makeNote, PNG_1X1, registeredClient, type Client } from './helpers';

// 一般 API 請求的 body 上限（middleware/body-limit.ts）：超過就回 413，而且不會先把整個 body 讀進記憶體。
// 照片上傳的路由用自己的上限，測試在 upload-size-limit.spec.ts。

const MB = 1024 * 1024;
const TOO_LARGE = '送出的資料太大（上限 1MB）';

type Sender = Pick<Client, 'cookie' | 'ip'>;
type ErrorBody = { error?: string };

const headersOf = (c: Sender, contentType: string): Record<string, string> => ({
	origin: BASE,
	'cf-connecting-ip': c.ip,
	'content-type': contentType,
	...(c.cookie ? { cookie: c.cookie } : {}),
});

/** 送出一段原樣的 JSON 文字，長度由呼叫端精確控制（helpers 的 client 會自己 JSON.stringify，控制不了 byte 數） */
async function rawJson(c: Sender, method: string, path: string, text: string) {
	const res = await SELF.fetch(`${BASE}${path}`, { method, headers: headersOf(c, 'application/json'), body: text });
	return { status: res.status, data: (await res.json()) as ErrorBody, headers: res.headers };
}

/** {"<field>":"aaa…"}，整段剛好 totalBytes 個 bytes（都是 ASCII，一個字一個 byte） */
function jsonOfSize(field: string, totalBytes: number): string {
	const head = `{"${field}":"`;
	const tail = '"}';
	return head + 'a'.repeat(totalBytes - head.length - tail.length) + tail;
}

/**
 * 用 ReadableStream 當 body 送出 {"<field>":"aaa…"}，不設 Content-Length（chunked）。
 * 內容邊送邊產生，不會先在記憶體裡組好；pulled 是回應時伺服器實際讀走的 bytes，用來確認超過上限時很早就停止讀取。
 */
async function chunkedJson(c: Sender, path: string, field: string, valueBytes: number) {
	const encoder = new TextEncoder();
	const queue = [encoder.encode(`{"${field}":"`)];
	const tail = encoder.encode('"}');
	let remaining = valueBytes;
	let tailSent = false;
	let pulled = 0;
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			let chunk = queue.shift();
			if (!chunk && remaining > 0) {
				chunk = new Uint8Array(Math.min(64 * 1024, remaining)).fill(0x61);
				remaining -= chunk.byteLength;
			}
			if (!chunk && !tailSent) {
				chunk = tail;
				tailSent = true;
			}
			if (!chunk) return controller.close();
			pulled += chunk.byteLength;
			controller.enqueue(chunk);
		},
	});
	const res = await SELF.fetch(`${BASE}${path}`, { method: 'POST', headers: headersOf(c, 'application/json'), body });
	return { status: res.status, data: (await res.json()) as ErrorBody, pulled };
}

describe('不用登入的路由', () => {
	it('登入、註冊收到超大的 JSON 回 413，和其他錯誤同一種格式、不快取', async () => {
		const anon = createClient();
		for (const path of ['/api/auth/login', '/api/auth/register']) {
			const res = await rawJson(anon, 'POST', path, jsonOfSize('password', API_BODY_MAX_BYTES + 1));
			expect(res.status, path).toBe(413);
			expect(res.data, path).toEqual({ error: TOO_LARGE });
			expect(res.headers.get('content-type')).toContain('application/json');
			expect(res.headers.get('cache-control')).toBe('no-store');
			expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		}
	});

	it('沒有 Content-Length（chunked）的 24MB JSON：讀到上限附近就回 413，不會整個讀進記憶體', async () => {
		const res = await chunkedJson(createClient(), '/api/auth/login', 'password', 24 * MB);
		expect(res.status).toBe(413);
		expect(res.data).toEqual({ error: TOO_LARGE });
		expect(res.pulled).toBeLessThan(4 * MB);
	});

	it('有 Content-Length 時只看標頭就擋下，不讀內容', async () => {
		// 宣告的長度超過上限，實際內容很小：回 413 就代表沒有先讀內容再判斷
		const request = new Request(`${BASE}/api/auth/login`, {
			method: 'POST',
			headers: { origin: BASE, 'content-type': 'application/json', 'content-length': String(API_BODY_MAX_BYTES + 1) },
			body: JSON.stringify({ email: 'someone@example.com', password: 'not-the-password' }),
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(413);
		expect(await res.json()).toEqual({ error: TOO_LARGE });
	});

	it('Content-Length 不是純數字時回 400，不會被當成沒有超過上限（上傳路由也一樣）', async () => {
		// 這種請求正常在 HTTP 層就被拒絕，所以直接呼叫 Worker 才測得到
		const body = JSON.stringify({ email: 'someone@example.com', password: 'not-the-password' });
		const send = async (method: string, path: string, contentLength: string) => {
			const request = new Request(`${BASE}${path}`, {
				method,
				headers: { origin: BASE, 'cf-connecting-ip': '10.9.9.9', 'content-type': 'application/json', 'content-length': contentLength },
				body,
			});
			const ctx = createExecutionContext();
			const res = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			return { status: res.status, data: (await res.json()) as ErrorBody };
		};
		for (const value of ['abc', '5abc', '-1', '1e9', '0x10', '']) {
			const res = await send('POST', '/api/auth/login', value);
			expect(res, JSON.stringify(value)).toEqual({ status: 400, data: { error: 'Content-Length 格式錯誤' } });
		}
		expect((await send('PUT', '/api/auth/avatar', 'abc')).status).toBe(400);
		// 正常的數字照常進到登入的檢查
		const ok = await send('POST', '/api/auth/login', String(new TextEncoder().encode(body).byteLength));
		expect(ok).toEqual({ status: 401, data: { error: 'Email 或密碼錯誤' } });
	});
});

describe('登入後的路由', () => {
	it('剛好到上限的 body 會進到驗證（400），多 1 byte 就回 413', async () => {
		const c = await registeredClient();
		const atLimit = await rawJson(c, 'POST', '/api/tasks', jsonOfSize('title', API_BODY_MAX_BYTES));
		expect(atLimit.status).toBe(400);
		expect(atLimit.data.error).toBe('任務名稱最多 200 個字');

		const over = await rawJson(c, 'POST', '/api/tasks', jsonOfSize('title', API_BODY_MAX_BYTES + 1));
		expect(over.status).toBe(413);
		expect(over.data.error).toBe(TOO_LARGE);

		const chunkedOver = await chunkedJson(c, '/api/tasks', 'title', API_BODY_MAX_BYTES);
		expect(chunkedOver.status).toBe(413);
		expect(chunkedOver.data.error).toBe(TOO_LARGE);
		expect((await c.get('/api/tasks')).data.tasks).toEqual([]);
	});

	it('沒有數量上限的陣列（科目排序）也被 body 上限擋住', async () => {
		const c = await registeredClient();
		// 3 萬個 id 約 1.2MB
		const res = await c.put('/api/subjects/order', { ids: Array.from({ length: 30_000 }, () => crypto.randomUUID()) });
		expect(res.status).toBe(413);
		expect(res.data.error).toBe(TOO_LARGE);
	});

	it('最大的合法請求遠小於上限：每個欄位都填滿、每個字都要跳脫的筆記照常新增', async () => {
		const c = await registeredClient();
		// U+0001 在 JSON 裡要寫成 \u0001（6 bytes），是同樣字數下最大的寫法；中文一個字 3 bytes
		const fill = (chars: number) => '\u0001'.repeat(chars);
		const note = {
			kind: 'mistake',
			title: fill(NOTE_TITLE_MAX),
			content: fill(20_000),
			question: fill(5000),
			wrongAnswer: fill(5000),
			correctAnswer: fill(5000),
			reason: fill(5000),
			tags: Array.from({ length: NOTE_TAGS_MAX }, (_, i) => fill(19) + i),
		};
		// 約 24 萬 bytes：確定送出的真的是最大的那種內容，而且不到上限的四分之一
		const bytes = new TextEncoder().encode(JSON.stringify(note)).byteLength;
		expect(bytes).toBeGreaterThan(240_000);
		expect(bytes).toBeLessThan(API_BODY_MAX_BYTES / 4);

		const res = await c.post('/api/notes', note);
		expect(res.status, JSON.stringify(res.data).slice(0, 200)).toBe(201);
		expect(res.data.note.content).toHaveLength(20_000);
		expect(res.data.note.tags).toHaveLength(NOTE_TAGS_MAX);
	});

	it('不是上傳路由的 multipart 也受這個上限：只有指定的方法與路徑用上傳的上限', async () => {
		const c = await registeredClient();
		const bigPhoto = () => {
			const bytes = new Uint8Array(2 * MB);
			bytes.set(PNG_1X1);
			const form = new FormData();
			form.append('file', new File([bytes], 'big.png', { type: 'image/png' }));
			return form;
		};
		// 一般的 JSON 路由
		const toTasks = await c.post('/api/tasks', bigPhoto());
		expect(toTasks.status).toBe(413);
		expect(toTasks.data.error).toBe(TOO_LARGE);
		// 頭像的路徑，但方法不是 PUT
		const wrongMethod = await c.post('/api/auth/avatar', bigPhoto());
		expect(wrongMethod.status).toBe(413);
		expect(wrongMethod.data.error).toBe(TOO_LARGE);
		// 頭像的方法，但路徑多了結尾的斜線（沒有這條路由）
		const trailingSlash = await c.put('/api/auth/avatar/', bigPhoto());
		expect(trailingSlash.status).toBe(413);
		expect(trailingSlash.data.error).toBe(TOO_LARGE);
		// 筆記照片的路徑，但方法不是 POST
		const note = await makeNote(c, '有照片的筆記');
		const wrongMethodOnNote = await c.put(`/api/notes/${note.id}/attachments`, bigPhoto());
		expect(wrongMethodOnNote.status).toBe(413);
		expect(wrongMethodOnNote.data.error).toBe(TOO_LARGE);
	});
});
