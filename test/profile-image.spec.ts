import { afterEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_QUALITIES, prepareAvatar } from '../src/react-app/lib/profile-image';
import { AVATAR_TOO_LARGE, AvatarImageError } from '../src/react-app/lib/profile-crop';

// prepareAvatar 用到瀏覽器的 createImageBitmap 與 canvas：這裡換成假的，
// 檢查解碼的後備、裁切參數、品質重試的順序、大小上限，以及任何路徑都會釋放 bitmap。
const KB = 1024;
const MB = 1024 * KB;
const blobOf = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
const photo = new Blob(['raw'], { type: 'image/png' });

type DecodeOptions = { imageOrientation: 'from-image' } | undefined;

function stubImaging({
	width = 1200,
	height = 700,
	sizes = [200 * KB],
	decode,
	noContext = false,
}: {
	width?: number;
	height?: number;
	/** toBlob 依序回傳的檔案大小；null 代表轉檔失敗 */
	sizes?: (number | null)[];
	decode?: (options: DecodeOptions) => Promise<void>;
	noContext?: boolean;
} = {}) {
	const bitmap = { width, height, close: vi.fn() };
	const ctx = { fillStyle: '', imageSmoothingQuality: '', fillRect: vi.fn(), drawImage: vi.fn() };
	const qualities: number[] = [];
	const types: string[] = [];
	const canvas = {
		width: 0,
		height: 0,
		getContext: vi.fn(() => (noContext ? null : ctx)),
		toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
			const size = sizes[qualities.length];
			qualities.push(quality);
			types.push(type);
			callback(size == null ? null : blobOf(size));
		},
	};
	const createImageBitmap = vi.fn(async (_file: Blob, options?: DecodeOptions) => {
		await decode?.(options);
		return bitmap;
	});
	vi.stubGlobal('createImageBitmap', createImageBitmap);
	vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
	return { bitmap, ctx, canvas, qualities, types, createImageBitmap };
}

afterEach(() => vi.unstubAllGlobals());

describe('把照片做成頭像（prepareAvatar）', () => {
	it('依 EXIF 轉正解碼、置中裁成正方形、鋪白底後轉成 JPEG，用完釋放 bitmap', async () => {
		const s = stubImaging({ width: 1200, height: 700 });
		const blob = await prepareAvatar(photo);

		expect(s.createImageBitmap).toHaveBeenCalledTimes(1);
		expect(s.createImageBitmap).toHaveBeenCalledWith(photo, { imageOrientation: 'from-image' });
		expect([s.canvas.width, s.canvas.height]).toEqual([512, 512]);
		expect(s.ctx.fillStyle).toBe('#ffffff');
		expect(s.ctx.fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
		// 1200×700：取中間 700×700（左邊裁掉 250），縮到 512×512
		expect(s.ctx.drawImage).toHaveBeenCalledWith(s.bitmap, 250, 0, 700, 700, 0, 0, 512, 512);
		expect(s.types).toEqual(['image/jpeg']);
		expect(s.qualities).toEqual([AVATAR_QUALITIES[0]]);
		expect(blob.size).toBe(200 * KB);
		expect(s.bitmap.close).toHaveBeenCalledTimes(1);
	});

	it('比 512px 小的照片不放大', async () => {
		const s = stubImaging({ width: 300, height: 200 });
		await prepareAvatar(photo);
		expect([s.canvas.width, s.canvas.height]).toEqual([200, 200]);
		expect(s.ctx.drawImage).toHaveBeenCalledWith(s.bitmap, 50, 0, 200, 200, 0, 0, 200, 200);
	});

	it('超過上限時依序降低品質再試，回傳第一個不超過上限的', async () => {
		const s = stubImaging({ sizes: [1500 * KB, 1200 * KB, 900 * KB] });
		const blob = await prepareAvatar(photo);
		expect(s.qualities).toEqual([0.86, 0.72, 0.6]);
		expect(blob.size).toBe(900 * KB);
		expect(s.bitmap.close).toHaveBeenCalledTimes(1);
	});

	it('剛好等於上限可以；降到最低品質仍超過上限就提示換一張，不回傳檔案', async () => {
		const ok = stubImaging({ sizes: [MB] });
		expect((await prepareAvatar(photo)).size).toBe(MB);
		expect(ok.qualities).toEqual([0.86]);

		const tooBig = stubImaging({ sizes: [1500 * KB, 1200 * KB, MB + 1] });
		const error = await prepareAvatar(photo).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AvatarImageError);
		expect((error as Error).message).toBe(AVATAR_TOO_LARGE);
		expect(tooBig.qualities).toEqual([0.86, 0.72, 0.6]);
		expect(tooBig.bitmap.close).toHaveBeenCalledTimes(1);
	});

	it('瀏覽器不接受 imageOrientation 時，不帶選項再解碼一次', async () => {
		const s = stubImaging({
			decode: async (options) => {
				if (options) throw new TypeError('imageOrientation');
			},
		});
		const blob = await prepareAvatar(photo);
		expect(s.createImageBitmap).toHaveBeenCalledTimes(2);
		expect(s.createImageBitmap.mock.calls[0]).toEqual([photo, { imageOrientation: 'from-image' }]);
		expect(s.createImageBitmap.mock.calls[1]).toEqual([photo]);
		expect(blob.size).toBe(200 * KB);
	});

	it('兩次都解不開（例如 HEIC）：請使用者改用 JPEG、PNG 或 WebP', async () => {
		const s = stubImaging({
			decode: async () => {
				throw new Error('decode');
			},
		});
		await expect(prepareAvatar(photo)).rejects.toThrow('無法讀取這張照片，請改用 JPEG、PNG 或 WebP');
		expect(s.createImageBitmap).toHaveBeenCalledTimes(2);
		expect(s.canvas.getContext).not.toHaveBeenCalled();
	});

	it('不是圖片：不解碼，直接提示', async () => {
		const s = stubImaging();
		const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
		const error = await prepareAvatar(pdf).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AvatarImageError);
		expect((error as Error).message).toBe('請選擇照片檔（JPEG、PNG 或 WebP）');
		expect(s.createImageBitmap).not.toHaveBeenCalled();
	});

	it('轉檔失敗或拿不到 canvas：提示再試一次，bitmap 一樣會釋放', async () => {
		const noBlob = stubImaging({ sizes: [null] });
		await expect(prepareAvatar(photo)).rejects.toThrow('照片處理失敗，請再試一次');
		expect(noBlob.bitmap.close).toHaveBeenCalledTimes(1);

		const noContext = stubImaging({ noContext: true });
		await expect(prepareAvatar(photo)).rejects.toThrow('照片處理失敗，請再試一次');
		expect(noContext.bitmap.close).toHaveBeenCalledTimes(1);
	});
});
