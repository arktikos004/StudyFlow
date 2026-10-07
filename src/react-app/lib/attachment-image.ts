import { canvasToJpeg, createCanvas, decodeImage } from './image-bitmap';

const MAX_EDGE = 1600;
const QUALITY = 0.85;

/**
 * 筆記照片上傳前在瀏覽器壓縮：長邊縮到 1600px（小的不放大）並轉成 JPEG。
 * 手機拍的考卷通常 3–8MB，壓縮後約 200–500KB，上傳快也省空間。
 */
export async function compressImage(file: Blob): Promise<Blob> {
	const bitmap = await decodeImage(file);
	if (!bitmap) throw new Error('無法讀取這張圖片，請改用 JPEG 或 PNG');
	try {
		const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
		const width = Math.round(bitmap.width * scale);
		const height = Math.round(bitmap.height * scale);
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('圖片壓縮失敗');
		// JPEG 沒有透明度，先鋪白底避免透明 PNG 變黑（這是影像的底色，不是介面的顏色）
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, width, height);
		ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height);
		const blob = await canvasToJpeg(canvas, QUALITY);
		if (!blob) throw new Error('圖片壓縮失敗');
		return blob;
	} finally {
		bitmap.close();
	}
}
