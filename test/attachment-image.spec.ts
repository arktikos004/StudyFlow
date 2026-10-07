import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from '../src/react-app/lib/attachment-image';

// 筆記照片上傳前的壓縮：用到瀏覽器的 createImageBitmap 與 canvas，這裡換成假的（同 profile-image.spec.ts）。

const photo = new Blob(['raw'], { type: 'image/png' });
type DecodeOptions = { imageOrientation: 'from-image' } | undefined;

function stubImaging({
	width = 4000,
	height = 3000,
	decode,
	noContext = false,
	blob = true,
}: {
	width?: number;
	height?: number;
	decode?: (options: DecodeOptions) => Promise<void>;
	noContext?: boolean;
	blob?: boolean;
} = {}) {
	const bitmap = { width, height, close: vi.fn() };
	const ctx = { fillStyle: '', imageSmoothingQuality: '', fillRect: vi.fn(), drawImage: vi.fn() };
	const canvas = {
		width: 0,
		height: 0,
		getContext: vi.fn(() => (noContext ? null : ctx)),
		toBlob: vi.fn((callback: (b: Blob | null) => void) => callback(blob ? new Blob(['jpeg'], { type: 'image/jpeg' }) : null)),
	};
	const createImageBitmap = vi.fn(async (_file: Blob, options?: DecodeOptions) => {
		await decode?.(options);
		return bitmap;
	});
	vi.stubGlobal('createImageBitmap', createImageBitmap);
	vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
	return { bitmap, ctx, canvas, createImageBitmap };
}

afterEach(() => vi.unstubAllGlobals());

describe('筆記照片壓縮（compressImage）', () => {
	it('長邊縮到 1600px、鋪白底、轉成品質 0.85 的 JPEG，用完釋放 bitmap', async () => {
		const s = stubImaging({ width: 4000, height: 3000 });
		const out = await compressImage(photo);
		expect(out.type).toBe('image/jpeg');
		expect([s.canvas.width, s.canvas.height]).toEqual([1600, 1200]);
		expect(s.ctx.fillStyle).toBe('#ffffff');
		expect(s.ctx.drawImage).toHaveBeenCalledWith(s.bitmap, 0, 0, 4000, 3000, 0, 0, 1600, 1200);
		expect(s.canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
		expect(s.bitmap.close).toHaveBeenCalledOnce();
	});

	it('比 1600px 小的照片不放大', async () => {
		const s = stubImaging({ width: 800, height: 1200 });
		await compressImage(photo);
		expect([s.canvas.width, s.canvas.height]).toEqual([800, 1200]);
	});

	it('瀏覽器不接受依 EXIF 轉正的選項時，不帶選項再解碼一次（舊版 Safari）', async () => {
		const s = stubImaging({ decode: async (options) => void (options && (await Promise.reject(new TypeError('unsupported option')))) });
		await expect(compressImage(photo)).resolves.toBeInstanceOf(Blob);
		expect(s.createImageBitmap.mock.calls).toEqual([[photo, { imageOrientation: 'from-image' }], [photo]]);
	});

	it('讀不出來、拿不到 canvas、轉檔失敗時丟出中文訊息；有解碼成功就一定釋放 bitmap', async () => {
		stubImaging({ decode: () => Promise.reject(new Error('bad')) });
		await expect(compressImage(photo)).rejects.toThrow('無法讀取這張圖片');
		const noCtx = stubImaging({ noContext: true });
		await expect(compressImage(photo)).rejects.toThrow('圖片壓縮失敗');
		expect(noCtx.bitmap.close).toHaveBeenCalledOnce();
		const noBlob = stubImaging({ blob: false });
		await expect(compressImage(photo)).rejects.toThrow('圖片壓縮失敗');
		expect(noBlob.bitmap.close).toHaveBeenCalledOnce();
	});
});
