import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES } from '../src/shared/schemas';
import { AVATAR_MAX_EDGE, AVATAR_TOO_LARGE, AvatarImageError, squareCrop, withinAvatarLimit } from '../src/react-app/lib/profile-crop';

describe('頭像的正方形裁切（squareCrop）', () => {
	it('橫的照片：取高度為邊長，左右平均裁掉', () => {
		expect(squareCrop(1200, 700)).toEqual({ sx: 250, sy: 0, side: 700, out: 512 });
		expect(squareCrop(4032, 3024)).toEqual({ sx: 504, sy: 0, side: 3024, out: 512 });
	});

	it('直的照片：取寬度為邊長，上下平均裁掉', () => {
		expect(squareCrop(3024, 4032)).toEqual({ sx: 0, sy: 504, side: 3024, out: 512 });
		expect(squareCrop(600, 900)).toEqual({ sx: 0, sy: 150, side: 600, out: 512 });
	});

	it('正方形不裁切，只縮小', () => {
		expect(squareCrop(1080, 1080)).toEqual({ sx: 0, sy: 0, side: 1080, out: 512 });
		expect(squareCrop(512, 512)).toEqual({ sx: 0, sy: 0, side: 512, out: 512 });
	});

	it('差奇數像素時左／上少裁 1px，裁切範圍不會超出照片', () => {
		const c = squareCrop(101, 100);
		expect(c).toEqual({ sx: 0, sy: 0, side: 100, out: 100 });
		const d = squareCrop(100, 103);
		expect(d).toEqual({ sx: 0, sy: 1, side: 100, out: 100 });
		for (const [w, h] of [
			[1201, 700],
			[333, 1000],
			[7, 3],
		]) {
			const r = squareCrop(w, h);
			expect(r.sx + r.side).toBeLessThanOrEqual(w);
			expect(r.sy + r.side).toBeLessThanOrEqual(h);
			// 兩側裁掉的差距最多 1px
			expect(Math.abs(w - r.side - 2 * r.sx)).toBeLessThanOrEqual(1);
			expect(Math.abs(h - r.side - 2 * r.sy)).toBeLessThanOrEqual(1);
		}
	});

	it('小於 512 的照片不放大', () => {
		expect(squareCrop(300, 200)).toEqual({ sx: 50, sy: 0, side: 200, out: 200 });
		expect(squareCrop(1, 1)).toEqual({ sx: 0, sy: 0, side: 1, out: 1 });
	});

	it('可以指定最大邊長；小數的寬高取整數', () => {
		expect(squareCrop(1000, 800, 256)).toEqual({ sx: 100, sy: 0, side: 800, out: 256 });
		expect(squareCrop(640.7, 480.2)).toEqual({ sx: 80, sy: 0, side: 480, out: 480 });
		expect(AVATAR_MAX_EDGE).toBe(512);
	});

	it('沒有尺寸的照片丟出 zh-TW 的錯誤', () => {
		for (const [w, h] of [
			[0, 100],
			[100, 0],
			[0.5, 0.5],
			[-10, 20],
			[Number.NaN, 10],
			[Number.POSITIVE_INFINITY, 10],
		]) {
			expect(() => squareCrop(w, h)).toThrow(AvatarImageError);
		}
		expect(() => squareCrop(0, 0)).toThrow('無法讀取這張照片的尺寸，請換一張照片');
	});
});

describe('送出前的大小檢查（withinAvatarLimit）', () => {
	it('以後端的 AVATAR_MAX_BYTES（1MB）為上限，剛好 1MB 可以', () => {
		expect(AVATAR_MAX_BYTES).toBe(1024 * 1024);
		expect(withinAvatarLimit(80_000)).toBe(true);
		expect(withinAvatarLimit(AVATAR_MAX_BYTES)).toBe(true);
		expect(withinAvatarLimit(AVATAR_MAX_BYTES + 1)).toBe(false);
	});

	it('空的或不合法的大小不算通過', () => {
		expect(withinAvatarLimit(0)).toBe(false);
		expect(withinAvatarLimit(-1)).toBe(false);
		expect(withinAvatarLimit(Number.NaN)).toBe(false);
	});

	it('訊息和後端同一種說法（zh-TW），並說明怎麼辦', () => {
		expect(AVATAR_TOO_LARGE).toBe('照片太大（上限 1MB），請換一張照片');
	});
});

describe('極端比例的照片（review B3）', () => {
	it('很寬或很長的照片：取中間的正方形，邊長是短邊', () => {
		expect(squareCrop(10000, 100)).toEqual({ sx: 4950, sy: 0, side: 100, out: 100 });
		expect(squareCrop(100, 10000)).toEqual({ sx: 0, sy: 4950, side: 100, out: 100 });
		expect(squareCrop(12000, 2000)).toEqual({ sx: 5000, sy: 0, side: 2000, out: 512 });
		expect(squareCrop(1, 5000)).toEqual({ sx: 0, sy: 2499, side: 1, out: 1 });
	});
});
