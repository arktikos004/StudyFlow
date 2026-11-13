import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../types';

/**
 * 一般 API 請求的 body 上限（bytes）。合法的請求都遠小於這個值：
 * 最大的是一則每個欄位都填滿的筆記，約 4 萬字；全是中文時約 12 萬 bytes，
 * 全是要跳脫成 \uXXXX 的字元時約 24 萬 bytes，不到上限的四分之一（test/api-body-limit.spec.ts 有測）。
 */
export const API_BODY_MAX_BYTES = 1024 * 1024;

/**
 * 照片上傳的路由自己有比較大的上限（middleware/upload.ts 的 imageUploadLimit），不套用上面的上限。
 * 新增上傳路由時要加進這裡，並在路由上放 imageUploadLimit。
 * 忘了加的話，超過 1MB 的檔案會在這裡被擋下（413），不會變成沒有上限。
 */
const UPLOAD_ROUTES: readonly { method: string; path: RegExp }[] = [
	{ method: 'POST', path: /^\/api\/notes\/[^/]+\/attachments$/ },
	{ method: 'PUT', path: /^\/api\/auth\/avatar$/ },
];

const limitApiBody = bodyLimit({
	maxSize: API_BODY_MAX_BYTES,
	onError: () => {
		throw new HTTPException(413, { message: `送出的資料太大（上限 ${API_BODY_MAX_BYTES / (1024 * 1024)}MB）` });
	},
});

/**
 * /api/* 的 body 大小上限，放在所有路由之前（登入、註冊這些不用登入的路由也一樣）：
 * - 有 Content-Length：直接比對，超過就回 413，不讀內容。
 * - 沒有 Content-Length（chunked）：邊讀邊算，一超過就停止讀取並回 413。
 * 沒有這個上限時，JSON 路由會把整個 body 讀進記憶體再解析：Cloudflare 最多放行 100MB，每個 isolate 只有 128MB。
 * 錯誤丟 HTTPException，由 index.ts 的 onError 回 { error }，和其他錯誤同一種格式。
 */
export const apiBodyLimit = createMiddleware<AppEnv>((c, next) => {
	const isUpload = UPLOAD_ROUTES.some((route) => route.method === c.req.method && route.path.test(c.req.path));
	return isUpload ? next() : limitApiBody(c, next);
});
