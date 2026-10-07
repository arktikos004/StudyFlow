// 照片的解碼與轉檔（頭像、筆記照片共用）：瀏覽器的 createImageBitmap 與 canvas。
// 只寫出用到的形狀：測試的 tsconfig 沒有 DOM 的型別，這樣兩邊都能編譯；
// 一律從 globalThis 呼叫，測試用 vi.stubGlobal 換成假的（test/profile-image.spec.ts、attachment-image.spec.ts）。

export type Bitmap = { width: number; height: number; close(): void };
type Context2D = {
	fillStyle: string;
	imageSmoothingQuality: string;
	fillRect(x: number, y: number, width: number, height: number): void;
	drawImage(image: Bitmap, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
};
export type Canvas = {
	width: number;
	height: number;
	getContext(type: '2d'): Context2D | null;
	toBlob(callback: (blob: Blob | null) => void, type: string, quality: number): void;
};
type Imaging = {
	createImageBitmap(file: Blob, options?: { imageOrientation: 'from-image' }): Promise<Bitmap>;
	document: { createElement(tag: 'canvas'): Canvas };
};
/** 不先取出函式：脫離 window 呼叫會是 Illegal invocation */
const imaging = () => globalThis as unknown as Imaging;

/**
 * 解碼照片。先要求依 EXIF 轉正（手機直拍的照片不會躺著）；瀏覽器不接受這個選項時
 * （舊版 Safari 會直接丟錯，讓每張照片都失敗）不帶選項再試一次，兩次都失敗才回傳 null。
 */
export async function decodeImage(file: Blob): Promise<Bitmap | null> {
	try {
		return await imaging().createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		try {
			return await imaging().createImageBitmap(file);
		} catch {
			return null;
		}
	}
}

export function createCanvas(width: number, height: number): Canvas {
	const canvas = imaging().document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

/** 轉成 JPEG；瀏覽器轉檔失敗時是 null */
export const canvasToJpeg = (canvas: Canvas, quality: number) =>
	new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
