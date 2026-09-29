export class ApiError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
	if (body instanceof FormData) {
		init.body = body;
	} else if (body !== undefined) {
		init.body = JSON.stringify(body);
		(init.headers as Record<string, string>)['Content-Type'] = 'application/json';
	}

	let res: Response;
	try {
		res = await fetch(`/api${path}`, init);
	} catch {
		throw new ApiError(navigator.onLine ? '無法連線到伺服器，請稍後再試' : '目前離線，請確認網路連線', 0);
	}
	const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
	if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error ?? `請求失敗（${res.status}）`, res.status);
	return data as T;
}

export const api = {
	get: <T>(path: string) => request<T>('GET', path),
	post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
	patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
	put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
	del: <T = { ok: true }>(path: string) => request<T>('DELETE', path),
};

export function qs(params: Record<string, string | number | undefined | null>) {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
	const s = sp.toString();
	return s ? `?${s}` : '';
}

export const attachmentUrl = (id: string) => `/api/attachments/${id}`;

export type ExportFile = 'backup.json' | 'sessions.csv' | 'tasks.csv' | 'calendar.ics';
/**
 * 匯出檔的下載網址，給 <a href={exportUrl(...)} download> 使用（同源，會帶登入 cookie）。
 * 例如 exportUrl('calendar.ics', { tasks: 1 }) → /api/export/calendar.ics?tasks=1
 */
export const exportUrl = (file: ExportFile, params: Record<string, string | number | undefined | null> = {}) =>
	`/api/export/${file}${qs(params)}`;
