import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';

/**
 * 上傳的 body 大小上限，放在路由的 handler 之前（解析 multipart 之前）：
 * - 有 Content-Length：直接比對，超過就回 413，不讀內容。
 * - 沒有 Content-Length（chunked）：邊讀邊算，一超過就停止讀取並回 413，最多只暫存 maxBytes。
 * 只靠 handler 裡的 file.size 不夠：檢查到的時候整個 body 已經讀進記憶體（每個 isolate 只有 128MB）。
 * 錯誤丟 HTTPException，由 index.ts 的 onError 回 { error }，和其他錯誤同一種格式。
 */
export const uploadLimit = (maxBytes: number, message: string) =>
	bodyLimit({
		maxSize: maxBytes,
		onError: () => {
			throw new HTTPException(413, { message });
		},
	});
