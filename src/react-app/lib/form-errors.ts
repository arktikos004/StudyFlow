import { useRef, useState } from 'react';

// 表單的欄位錯誤：前端先用共用的 zod schema 檢查，錯誤顯示在各欄位旁邊。
// fieldErrors 是純函式（test/form-errors.spec.ts 直接測）；useFieldErrors 管狀態與焦點。

type Issue = { readonly path: readonly PropertyKey[]; readonly message: string };
/** 只寫出用到的形狀：測試的 tsconfig 沒有 DOM 的型別（輸入框都符合） */
type Focusable = { focus(): void };

/** zod 的錯誤 → 每個欄位的第一則訊息；fields 以外的欄位（例如表單層級的錯誤）不收 */
export function fieldErrors<K extends string>(issues: readonly Issue[], fields: readonly K[]): Partial<Record<K, string>> {
	const out: Partial<Record<K, string>> = {};
	for (const issue of issues) {
		const key = issue.path[0];
		if (typeof key === 'string' && (fields as readonly string[]).includes(key)) out[key as K] ??= issue.message;
	}
	return out;
}

/**
 * 欄位錯誤的狀態：送出時一次標出所有錯誤，焦點移到第一個錯的欄位（order 是畫面上的欄位順序）；
 * 修改欄位時清掉那一欄的錯誤。bind(k) 是給輸入框的 ref。
 */
export function useFieldErrors<K extends string>(order: readonly K[]) {
	const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
	const refs = useRef<Partial<Record<K, Focusable | null>>>({});
	const bind = (k: K) => (el: Focusable | null) => {
		refs.current[k] = el;
	};
	const show = (next: Partial<Record<K, string>>) => {
		setErrors(next);
		const first = order.find((k) => next[k]);
		if (first) refs.current[first]?.focus();
	};
	const clear = (k: K) => setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
	return { errors, bind, show, clear };
}
