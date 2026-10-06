// 頭像裁切範圍的純函式（PRO-1）。不碰 DOM，test/profile-ui-image.spec.ts 直接測；
// 實際的解碼與 canvas 在 lib/profile-image.ts。

/** 輸出的最大邊長（px）：個人檔案最大顯示 96px，3 倍螢幕也夠用 */
export const AVATAR_MAX_EDGE = 512;

/** 照片處理的失敗原因（zh-TW），可以直接顯示給使用者 */
export class AvatarImageError extends Error {}

export type SquareCrop = {
	/** 來源的裁切起點與邊長（px） */
	sx: number;
	sy: number;
	side: number;
	/** 輸出的邊長（px）：短邊與 max 中較小的，小圖不放大 */
	out: number;
};

/**
 * 置中的正方形裁切：邊長是短邊，長邊的兩側平均裁掉（差奇數像素時，左／上少裁 1px）。
 * 寬高（取整數後）不到 1px 時丟出 AvatarImageError。
 */
export function squareCrop(width: number, height: number, max: number = AVATAR_MAX_EDGE): SquareCrop {
	const w = Number.isFinite(width) ? Math.floor(width) : 0;
	const h = Number.isFinite(height) ? Math.floor(height) : 0;
	const side = Math.min(w, h);
	if (side < 1) throw new AvatarImageError('無法讀取這張照片的尺寸，請換一張照片');
	return { sx: Math.floor((w - side) / 2), sy: Math.floor((h - side) / 2), side, out: Math.max(1, Math.min(Math.floor(max), side)) };
}
