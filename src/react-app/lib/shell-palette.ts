// 指令面板（APP-1）的純邏輯：快速鍵判斷、本機比對、搜尋結果的深連結。
// 不碰 DOM 與 React，test/shell-palette.spec.ts 直接測。

/** 搜尋結果的種類（後端 /api/search 的四組） */
export type SearchKind = 'task' | 'event' | 'note' | 'subject';

/**
 * 搜尋結果選取後要前往的網址：任務、考試、筆記用 `?open=<id>` 由各頁開啟項目，科目前往單科總覽。
 * id 一律編碼，避免特殊字元破壞網址。
 */
export function resultHref(kind: SearchKind, id: string): string {
	const v = encodeURIComponent(id);
	switch (kind) {
		case 'task':
			return `/tasks?open=${v}`;
		case 'event':
			return `/events?open=${v}`;
		case 'note':
			return `/notes?open=${v}`;
		case 'subject':
			return `/subjects/${v}`;
	}
}

/** 還沒輸入時的快捷動作（順序即顯示順序）。圖示由元件決定，這裡只放資料。 */
export const QUICK_ACTIONS = [
	{ id: 'focus', label: '開始專注', to: '/timer', keywords: ['番茄鐘', '計時', '專注', 'pomodoro', 'focus', 'timer'] },
	{ id: 'new-task', label: '新增任務', to: '/tasks?new=1', keywords: ['任務', '待辦', '作業', 'task', 'todo'] },
	{ id: 'new-mistake', label: '新增錯題', to: '/notes?new=mistake', keywords: ['錯題', '題目', 'mistake'] },
	{ id: 'new-subject', label: '新增科目', to: '/settings?new=1', keywords: ['科目', '課程', 'subject'] },
] as const;

export type QuickActionId = (typeof QUICK_ACTIONS)[number]['id'];

/** 各頁的別名：輸入「番茄」也找得到「學習計時」。key 是 nav.ts 的 to。 */
export const PAGE_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
	'/': ['首頁', '今天', 'dashboard', 'home'],
	'/calendar': ['行事曆', '日曆', '週', 'calendar'],
	'/events': ['考試', '截止', '倒數', 'exam'],
	'/tasks': ['任務', '待辦', '作業', 'task', 'todo'],
	'/timer': ['番茄鐘', '專注', '碼錶', '計時', 'pomodoro', 'timer'],
	'/notes': ['筆記', '錯題', '複習', 'note'],
	'/stats': ['統計', '圖表', '報表', 'stats'],
	'/achievements': ['成就', '徽章', '里程碑', 'badge'],
	'/settings': ['設定', '科目', '主題色', '外觀', '目標', '匯出', '備份', 'settings'],
};

/** 比對用的正規化：全形轉半形（NFKC）、不分大小寫 */
export const normalize = (s: string) => s.normalize('NFKC').toLowerCase();

/**
 * 本機比對（快捷動作與頁面）：關鍵字以空白分隔，每個關鍵字都要出現在任一段文字裡（子字串，支援中文）。
 * 空字串視為全部符合。
 */
export function matchesQuery(texts: readonly string[], query: string): boolean {
	const terms = normalize(query).split(/\s+/).filter(Boolean);
	if (!terms.length) return true;
	const hay = texts.map(normalize);
	return terms.every((t) => hay.some((h) => h.includes(t)));
}

/** 是否為蘋果平台（顯示 ⌘ 或 Ctrl，以及快速鍵判斷） */
export const isApplePlatform = (platform: string) => /mac|iphone|ipad|ipod/i.test(platform);

type ShortcutEvent = { key: string; code?: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

/**
 * 開關指令面板的快速鍵：
 * - Windows／Linux：Ctrl+K。
 * - macOS：⌘K；Ctrl+K 只在不是輸入欄位時有效（macOS 文字欄位的 Ctrl+K 是「刪到行尾」，不能搶走）。
 * 加了 Alt 或 Shift 的組合不算。
 * 先看 key（Dvorak 等佈局的 K 不在 QWERTY 的位置，實體 KeyK 打出來的是 T）；
 * 只有 key 不是單一拉丁字母時（注音等輸入法的 'Process'、'Unidentified'、俄文等非拉丁佈局）才改看實體鍵 code。
 */
export function isPaletteShortcut(e: ShortcutEvent, apple: boolean, inEditable: boolean): boolean {
	if (e.altKey || e.shiftKey) return false;
	const key = e.key.toLowerCase();
	if (/^[a-z]$/.test(key) ? key !== 'k' : e.code !== 'KeyK') return false;
	if (apple) return (e.metaKey && !e.ctrlKey) || (e.ctrlKey && !e.metaKey && !inEditable);
	return e.ctrlKey && !e.metaKey;
}

/** 選項在 listbox 裡的移動：上下鍵循環 */
export function stepIndex(current: number, delta: number, count: number): number {
	if (count <= 0) return -1;
	if (current < 0) return delta > 0 ? 0 : count - 1;
	return (((current + delta) % count) + count) % count;
}
