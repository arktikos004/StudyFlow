// 頭像照片的前端處理（PRO-1）：置中裁成正方形、縮到最大 512×512、轉成 JPEG（透明的地方鋪白）。
// 裁切範圍與大小上限是 lib/profile-crop.ts 的純函式；解碼與轉檔在 lib/image-bitmap.ts（和筆記照片共用）。
// 測試（test/profile-image.spec.ts）用 vi.stubGlobal 換成假的 createImageBitmap 與 document。
import { AVATAR_TYPES } from '../../shared/schemas';
import { canvasToJpeg, createCanvas, decodeImage } from './image-bitmap';
import { AVATAR_TOO_LARGE, AvatarImageError, squareCrop, withinAvatarLimit } from './profile-crop';

/** 檔案選擇器只列出這些格式（後端的 AVATAR_TYPES：JPEG、PNG、WebP；送出的一律是轉好的 JPEG） */
export const AVATAR_ACCEPT = AVATAR_TYPES.join(',');
/** JPEG 品質：先用 0.86；超過後端上限時降低品質再試（512×512 實際上不會超過，只是保險） */
export const AVATAR_QUALITIES = [0.86, 0.72, 0.6] as const;

/**
 * 把使用者選的照片做成頭像：置中裁成正方形、最大 512×512、JPEG（品質 0.86，通常 30–120KB，遠低於後端的 1MB 上限）。
 * 依 EXIF 轉正（手機直拍的照片不會躺著）。不是圖片、讀不出來、轉檔失敗，或降低品質後仍超過後端上限（AVATAR_MAX_BYTES）時，
 * 丟出 AvatarImageError（zh-TW 訊息）：在選照片時就提示，不會送出後才收到 413。
 */
export async function prepareAvatar(file: Blob): Promise<Blob> {
	if (file.type && !file.type.startsWith('image/')) throw new AvatarImageError('請選擇照片檔（JPEG、PNG 或 WebP）');
	const bitmap = await decodeImage(file);
	if (!bitmap) throw new AvatarImageError('無法讀取這張照片，請改用 JPEG、PNG 或 WebP');
	try {
		const { sx, sy, side, out } = squareCrop(bitmap.width, bitmap.height);
		const canvas = createCanvas(out, out);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new AvatarImageError('照片處理失敗，請再試一次');
		// JPEG 沒有透明度：先鋪白底，透明的 PNG、WebP 才不會變成黑底（這是影像的底色，不是介面的顏色）
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, out, out);
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
		for (const quality of AVATAR_QUALITIES) {
			const blob = await canvasToJpeg(canvas, quality);
			if (!blob) throw new AvatarImageError('照片處理失敗，請再試一次');
			if (withinAvatarLimit(blob.size)) return blob;
		}
		throw new AvatarImageError(AVATAR_TOO_LARGE);
	} finally {
		bitmap.close();
	}
}
