import { SELF } from 'cloudflare:test';

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

// 最小的合法 PNG（1x1 像素）
export const PNG_1X1 = Uint8Array.from(
	atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
	(c) => c.charCodeAt(0),
);
