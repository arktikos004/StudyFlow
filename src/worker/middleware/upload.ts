import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { sniffImageType, tooLargeMessage, type ImageType } from '../lib/image';
import type { AppEnv } from '../types';

/** multipart 的分隔線與欄位標頭只有幾百 bytes：整個 body 超過「檔案上限＋這個值」就不再讀取 */
const MULTIPART_OVERHEAD_BYTES = 16 * 1024;

/**
 * 圖片上傳的 body 大小上限，放在路由的 handler 之前（解析 multipart 之前）：
 * - 有 Content-Length：直接比對，超過就回 413，不讀內容。
 * - 沒有 Content-Length（chunked）：邊讀邊算，一超過就停止讀取並回 413。
 * 只靠 handler 裡的 file.size 不夠：檢查到的時候整個 body 已經讀進記憶體（每個 isolate 只有 128MB）。
 * 錯誤丟 HTTPException，由 index.ts 的 onError 回 { error }，和其他錯誤同一種格式。
 */
export const imageUploadLimit = (maxFileBytes: number) =>
	bodyLimit({
		maxSize: maxFileBytes + MULTIPART_OVERHEAD_BYTES,
		onError: () => {
			throw new HTTPException(413, { message: tooLargeMessage(maxFileBytes) });
		},
	});

/**
 * 讀出 multipart 的 file 欄位並檢查：有選檔（400）、大小（413）、實際格式是 JPEG／PNG／WebP（415）。
 * 回傳內容與偵測到的格式；筆記照片與頭像共用。
 */
export async function readImageUpload(c: Context<AppEnv>, maxFileBytes: number): Promise<{ bytes: Uint8Array; contentType: ImageType }> {
	// 不是 multipart（例如送了 JSON 或沒有內容）時 formData() 會丟錯：一樣當作沒有選照片
	const form = await c.req.formData().catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File) || file.size === 0) throw new HTTPException(400, { message: '請選擇照片' });
	if (file.size > maxFileBytes) throw new HTTPException(413, { message: tooLargeMessage(maxFileBytes) });

	const bytes = new Uint8Array(await file.arrayBuffer());
	const contentType = sniffImageType(bytes);
	if (!contentType) throw new HTTPException(415, { message: '只支援 JPEG、PNG、WebP 圖片' });
	return { bytes, contentType };
}
