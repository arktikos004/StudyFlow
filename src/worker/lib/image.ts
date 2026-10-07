import type { ATTACHMENT_TYPES } from '../../shared/schemas';

/** 接受的圖片格式（筆記照片與頭像相同） */
export type ImageType = (typeof ATTACHMENT_TYPES)[number];

/**
 * 用檔案開頭的 magic bytes 判斷真正的圖片格式，不相信瀏覽器送來的 Content-Type 與副檔名。
 * 筆記照片與頭像共用；只認得 JPEG、PNG、WebP，其他一律回 null。
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
	return null;
}

/** 「照片太大（上限 5MB）」：上限由常數算出來，筆記照片與頭像同一種說法 */
export const tooLargeMessage = (maxBytes: number) => `照片太大（上限 ${maxBytes / (1024 * 1024)}MB）`;

/**
 * 把不公開的 R2 圖片轉送給本人：格式用上傳時偵測到的，不讓瀏覽器猜（nosniff），一律 inline。
 * cacheControl 由呼叫端決定（內容不會變的可以長期快取）。
 */
export function imageResponse(object: R2ObjectBody, contentType: string, cacheControl: string): Response {
	return new Response(object.body, {
		headers: {
			'Content-Type': contentType,
			'Content-Length': String(object.size),
			'Cache-Control': cacheControl,
			'Content-Disposition': 'inline',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}
