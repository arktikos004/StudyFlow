const MAX_EDGE = 1600;
const QUALITY = 0.85;

/**
 * 上傳前在瀏覽器壓縮照片：長邊縮到 1600px 並轉成 JPEG。
 * 手機拍的考卷通常 3–8MB，壓縮後約 200–500KB，上傳快也省空間。
 */
export async function compressImage(file: File): Promise<Blob> {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
	if (!bitmap) throw new Error('無法讀取這張圖片，請改用 JPEG 或 PNG');

	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	// JPEG 沒有透明度，先鋪白底避免透明 PNG 變黑
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
	if (!blob) throw new Error('圖片壓縮失敗');
	return blob;
}
