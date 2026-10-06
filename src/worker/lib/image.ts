/**
 * 用檔案開頭的 magic bytes 判斷真正的圖片格式，不相信瀏覽器送來的 Content-Type 與副檔名。
 * 筆記照片與頭像共用；只認得 JPEG、PNG、WebP（ATTACHMENT_TYPES），其他一律回 null。
 */
export function sniffImageType(bytes: Uint8Array): string | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
	return null;
}
