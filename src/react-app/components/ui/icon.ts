import { type LucideIcon } from 'lucide-react';
import { createElement, type ReactNode } from 'react';

// 圖示 prop：可以傳 lucide 元件（由元件決定大小）或已經做好的元素（照原樣顯示）

// 元件的預設樣式（.sf-btn、.sf-field…）定義在 index.css 的 @layer components，
// 頁面傳進來的 className（工具類）一定蓋得過，不需要 tailwind-merge。

/**
 * 元件的 icon prop：傳 lucide 元件（`icon={Clock}`，建議）由元件決定大小與顏色；
 * 傳已經組好的元素（`icon={<Clock className="…" aria-hidden />}`）則照原樣顯示，大小與顏色由呼叫端負責。
 */
export type IconProp = LucideIcon | ReactNode;

const COMPONENT_TYPES: ReadonlySet<unknown> = new Set([
	Symbol.for('react.forward_ref'),
	Symbol.for('react.memo'),
	Symbol.for('react.lazy'),
]);

/** 傳進來的是「元件」而不是元素嗎？lucide 的圖示是 forwardRef 物件（不是函式），所以兩種都要認 */
function isIconComponent(icon: IconProp): icon is LucideIcon {
	if (typeof icon === 'function') return true;
	return typeof icon === 'object' && icon !== null && COMPONENT_TYPES.has((icon as { $$typeof?: unknown }).$$typeof);
}

/** icon 是元件時套上元件決定的 class 並加 aria-hidden；是元素時原樣回傳 */
export function renderIcon(icon: IconProp, className: string): ReactNode {
	return isIconComponent(icon) ? createElement(icon, { className, 'aria-hidden': true }) : icon;
}
