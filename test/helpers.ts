import { SELF } from 'cloudflare:test';
import type { EventItem, NoteItem, Subject, TaskItem } from '../src/shared/api-types';
import { addDays, startOfLocalDay, today } from '../src/shared/dates';
import { HOUR_MS, MINUTE_MS } from '../src/shared/time';

export const BASE = 'http://example.com';

let counter = 0;

/** 模擬一個瀏覽器：記住 session cookie，並用獨立的 IP 避免碰到註冊頻率限制 */
export function createClient() {
	const ip = `10.0.${Math.floor(counter / 250)}.${(counter++ % 250) + 1}`;
	let cookie = '';

	async function request(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
		// 瀏覽器送出非 GET 請求時一定會帶 Origin
		const headers: Record<string, string> = { 'cf-connecting-ip': ip, ...(method !== 'GET' ? { origin: BASE } : {}), ...extraHeaders };
		if (cookie) headers.cookie = cookie;
		let payload: BodyInit | undefined;
		if (body instanceof FormData) {
			payload = body;
		} else if (body !== undefined) {
			payload = JSON.stringify(body);
			headers['content-type'] = 'application/json';
		}
		const res = await SELF.fetch(`${BASE}${path}`, { method, headers, body: payload });
		const setCookie = res.headers.get('set-cookie');
		if (setCookie) {
			const [pair] = setCookie.split(';');
			cookie = pair.endsWith('=') ? '' : pair;
		}
		const isJson = res.headers.get('content-type')?.includes('application/json');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const data: any = isJson ? await res.json() : await res.arrayBuffer();
		return { status: res.status, data, headers: res.headers };
	}

	return {
		ip,
		get cookie() {
			return cookie;
		},
		set cookie(v: string) {
			cookie = v;
		},
		get: (path: string) => request('GET', path),
		post: (path: string, body?: unknown, headers?: Record<string, string>) => request('POST', path, body, headers),
		patch: (path: string, body?: unknown) => request('PATCH', path, body),
		put: (path: string, body?: unknown) => request('PUT', path, body),
		del: (path: string) => request('DELETE', path),
	};
}

export type Client = ReturnType<typeof createClient>;

let userCounter = 0;
export async function registeredClient(displayName = '測試同學') {
	const client = createClient();
	const email = `student${Date.now()}_${userCounter++}@example.com`;
	const res = await client.post('/api/auth/register', { email, password: 'correct-horse-battery', displayName });
	if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.data)}`);
	return Object.assign(client, { email, user: res.data.user });
}

/**
 * 「現在」剛好是當地中午前後的固定時區（Etc/GMT±N，沒有夏令時間）。
 * 測試「今天」「本週」時，當天早上一定有空檔可以記錄學習時段，不受測試執行時刻影響。
 */
export function noonTimezone(now = Date.now()) {
	const offset = 12 - new Date(now).getUTCHours(); // 當地 = UTC + offset
	if (offset === 0) return 'Etc/GMT';
	// Etc/GMT 的正負號和 UTC 偏移相反：Etc/GMT-8 = UTC+8
	return offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

/** 已註冊、時區設為 noonTimezone() 的使用者；today 是該時區的今天 */
export async function noonClient(displayName?: string) {
	const client = await registeredClient(displayName);
	const tz = noonTimezone();
	const res = await client.patch('/api/auth/me', { timezone: tz });
	if (res.status !== 200) throw new Error(`set timezone failed: ${res.status} ${JSON.stringify(res.data)}`);
	return Object.assign(client, { tz, today: today(tz) });
}

export type NoonClient = Awaited<ReturnType<typeof noonClient>>;

/** 在某個當地日期的 startHour 點開始記錄 minutes 分鐘（手動補登） */
export async function logSession(c: NoonClient, date: string, startHour: number, minutes: number, extra: Record<string, unknown> = {}) {
	const startedAt = startOfLocalDay(date, c.tz) + startHour * HOUR_MS;
	const res = await c.post('/api/study-sessions', { mode: 'manual', startedAt, endedAt: startedAt + minutes * MINUTE_MS, ...extra });
	if (res.status !== 201) throw new Error(`log session failed: ${res.status} ${JSON.stringify(res.data)}`);
	return res.data.session;
}

/** 送出新增並確認成功（201），回傳回應裡的那一筆；失敗時連同伺服器的錯誤一起丟出，不會只看到「讀不到 id」 */
async function create<T>(c: Client, path: string, body: Record<string, unknown>, key: string): Promise<T> {
	const res = await c.post(path, body);
	if (res.status !== 201) throw new Error(`POST ${path} failed: ${res.status} ${JSON.stringify(res.data)}`);
	return res.data[key];
}

export const makeSubject = (c: Client, name = '資料結構', extra: Record<string, unknown> = {}) =>
	create<Subject>(c, '/api/subjects', { name, color: '#2a78d6', ...extra }, 'subject');

export const makeTask = (c: Client, body: Record<string, unknown> = {}) =>
	create<TaskItem>(c, '/api/tasks', { title: '期末報告', ...body }, 'task');

export const makeNote = (c: Client, title: string, body: Record<string, unknown> = {}) =>
	create<NoteItem>(c, '/api/notes', { kind: 'note', title, ...body }, 'note');

/** 預設是一週後（台北時間）的考試 */
export const makeEvent = (c: Client, body: Record<string, unknown> = {}) =>
	create<EventItem>(c, '/api/events', { kind: 'exam', title: '期中考', date: addDays(today('Asia/Taipei'), 7), ...body }, 'event');

/** 下載的檔案內容；保留開頭的 BOM（Response.text() 會把它去掉） */
export function decodeText(data: ArrayBuffer) {
	return new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(data);
}

// 最小的合法 PNG（1x1 像素）
export const PNG_1X1 = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
	(c) => c.charCodeAt(0),
);
