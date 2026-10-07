// 鍵盤：格狀選項（色票、圖示）的方向鍵移動

/**
 * 排成格狀的 radiogroup（圖示、主題色、色格）的方向鍵，跟著畫面上的排列移動：
 * - 左右：前一個／下一個，頭尾相接（同 WAI-ARIA radio group）。
 * - 上下：同一欄的上一列／下一列，到邊界就停住。
 * - Home／End：第一個／最後一個。
 * 欄數直接讀 CSS grid 實際排出來的欄（grid-template-columns 的計算值），所以 auto-fill、斷點都不用另外同步。
 * 不是這些按鍵時回傳 null（交給瀏覽器處理，例如 Tab）。
 * e 只需要 key：React 的合成事件與 DOM 的 KeyboardEvent 都能直接傳。
 */
export function gridKeyTarget(e: { readonly key: string }, index: number, count: number, grid: HTMLElement | null): number | null {
	if (count <= 0) return null;
	const cols = grid ? Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length) : 1;
	switch (e.key) {
		case 'ArrowRight':
			return (index + 1) % count;
		case 'ArrowLeft':
			return (index - 1 + count) % count;
		case 'ArrowDown':
			return index + cols < count ? index + cols : index;
		case 'ArrowUp':
			return index - cols >= 0 ? index - cols : index;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}
