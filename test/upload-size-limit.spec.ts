import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { ATTACHMENT_MAX_BYTES, AVATAR_MAX_BYTES } from '../src/shared/schemas';
import { BASE, PNG_1X1, registeredClient, type Client } from './helpers';

// 沒有 Content-Length（chunked）的上傳，也要在整個 body 讀進記憶體之前擋下

const MB = 1024 * 1024;
const BOUNDARY = 'studyflow-chunked-upload';

type UploadResponse = {
	error?: string;
	user?: { avatarUpdatedAt: number | null };
	attachment?: { id: string; contentType: string; size: number };
};

/**
 * 用 ReadableStream 當 body 送出 multipart，不設 Content-Length。
 * 檔案內容是 head 後面接 padding 個 0 byte，邊送邊產生，不會先在記憶體裡組好整個 body；
 * pulled 是回應時伺服器實際讀走的 bytes，用來確認超過上限時很早就停止讀取。
 */
async function chunkedUpload(c: Client, method: 'PUT' | 'POST', path: string, head: Uint8Array, padding = 0) {
	const encoder = new TextEncoder();
	const queue = [
		encoder.encode(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`),
		head,
	];
	const tail = encoder.encode(`\r\n--${BOUNDARY}--\r\n`);
	let remaining = padding;
	let tailSent = false;
	let pulled = 0;
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			let chunk = queue.shift();
			if (!chunk && remaining > 0) {
				chunk = new Uint8Array(Math.min(64 * 1024, remaining));
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
	const res = await SELF.fetch(`${BASE}${path}`, {
		method,
		headers: { cookie: c.cookie, origin: BASE, 'cf-connecting-ip': c.ip, 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
		body,
	});
	const data = (await res.json()) as UploadResponse;
	return { status: res.status, data, pulled };
}

describe('沒有 Content-Length 的上傳：頭像', () => {
	it('24MB 的串流在讀到上限附近就回 413，不會整個讀進記憶體；原本沒有頭像也不會被改', async () => {
		const c = await registeredClient();
		const res = await chunkedUpload(c, 'PUT', '/api/auth/avatar', PNG_1X1, 24 * MB);
		expect(res.status).toBe(413);
		expect(res.data.error).toBe('照片太大（上限 1MB）');
		expect(res.pulled).toBeLessThan(4 * MB);
		expect((await c.get('/api/auth/me')).data.user.avatarUpdatedAt).toBeNull();
	});

	it('小的 chunked 合法圖片仍然上傳成功；剛好 1MB 也可以', async () => {
		const c = await registeredClient();
		const small = await chunkedUpload(c, 'PUT', '/api/auth/avatar', PNG_1X1);
		expect(small.status, JSON.stringify(small.data)).toBe(200);
		expect(small.data.user?.avatarUpdatedAt).toEqual(expect.any(Number));
		const img = await c.get('/api/auth/avatar');
		expect(img.headers.get('content-type')).toBe('image/png');
		expect(new Uint8Array(img.data)).toEqual(PNG_1X1);

		const max = await chunkedUpload(c, 'PUT', '/api/auth/avatar', PNG_1X1, AVATAR_MAX_BYTES - PNG_1X1.byteLength);
		expect(max.status, JSON.stringify(max.data)).toBe(200);
		const over = await chunkedUpload(c, 'PUT', '/api/auth/avatar', PNG_1X1, AVATAR_MAX_BYTES - PNG_1X1.byteLength + 1);
		expect(over.status).toBe(413);
		expect(over.data.error).toBe('照片太大（上限 1MB）');
	});
});

describe('沒有 Content-Length 的上傳：筆記照片', () => {
	async function makeNote(c: Client): Promise<{ id: string }> {
		const res = await c.post('/api/notes', { kind: 'note', title: '有照片的筆記' });
		expect(res.status).toBe(201);
		return res.data.note;
	}

	it('24MB 的串流在讀到上限附近就回 413，不會整個讀進記憶體；筆記沒有多出照片', async () => {
		const c = await registeredClient();
		const note = await makeNote(c);
		const res = await chunkedUpload(c, 'POST', `/api/notes/${note.id}/attachments`, PNG_1X1, 24 * MB);
		expect(res.status).toBe(413);
		expect(res.data.error).toBe('照片太大（上限 5MB）');
		expect(res.pulled).toBeLessThan(8 * MB);
		expect((await c.get(`/api/notes/${note.id}`)).data.note.attachments).toEqual([]);
	});

	it('小的 chunked 合法圖片仍然上傳成功；別人的筆記仍回 404', async () => {
		const c = await registeredClient();
		const note = await makeNote(c);
		const res = await chunkedUpload(c, 'POST', `/api/notes/${note.id}/attachments`, PNG_1X1);
		expect(res.status, JSON.stringify(res.data)).toBe(201);
		expect(res.data.attachment).toMatchObject({ contentType: 'image/png', size: PNG_1X1.byteLength });
		const photo = await c.get(`/api/attachments/${res.data.attachment!.id}`);
		expect(new Uint8Array(photo.data)).toEqual(PNG_1X1);

		const other = await registeredClient();
		const stolen = await chunkedUpload(other, 'POST', `/api/notes/${note.id}/attachments`, PNG_1X1);
		expect(stolen.status).toBe(404);
		expect(stolen.data.error).toBe('找不到此筆記');
		expect((await c.get(`/api/notes/${note.id}`)).data.note.attachments).toHaveLength(1);
	});

	it('有 Content-Length 時：超過上限 1 byte 與遠超過上限都回 413', async () => {
		const c = await registeredClient();
		const note = await makeNote(c);
		for (const size of [ATTACHMENT_MAX_BYTES + 1, ATTACHMENT_MAX_BYTES + MB]) {
			const bytes = new Uint8Array(size);
			bytes.set(PNG_1X1);
			const form = new FormData();
			form.append('file', new File([bytes], 'big.png', { type: 'image/png' }));
			const res = await c.post(`/api/notes/${note.id}/attachments`, form);
			expect(res.status, String(size)).toBe(413);
			expect(res.data.error).toBe('照片太大（上限 5MB）');
		}
		expect((await c.get(`/api/notes/${note.id}`)).data.note.attachments).toEqual([]);
	});
});
