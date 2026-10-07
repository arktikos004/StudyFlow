// 登入後回到原本要去的頁面（/login?next=/stats）。RequireAuth 組出 next，GuestOnly 依它導回去。

/**
 * next 是不是同一個網站裡的路徑；是的話回傳路徑（含查詢字串與 #），不是就回到總覽。
 * 用 URL 解析判斷，不只看開頭：//evil.example、/\evil.example（瀏覽器把反斜線當斜線）都會被擋下，
 * 不能被拿來把剛登入的人導到外部網站。
 */
export function safeNextPath(next: string | null, origin: string): string {
	if (!next?.startsWith('/')) return '/';
	try {
		const url = new URL(next, origin);
		return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/';
	} catch {
		return '/';
	}
}
