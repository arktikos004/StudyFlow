import { useCallback, useRef, useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

// 確認對話框：const [confirm, confirmDialog] = useConfirm(); if (await confirm({...})) …

/**
 * 確認對話框的語氣：
 * - danger（預設）：破壞性操作（刪除、放棄）。確認鈕是紅色 danger，預設焦點在「取消」，連按 Enter 不會誤刪。
 * - primary：一般的確認（例如「要一併完成任務嗎？」）。確認鈕是 primary，預設焦點在確認鈕，Enter 直接確認。
 * 觸控裝置兩者都不自動 focus（同 Dialog）。
 */
export type ConfirmTone = 'danger' | 'primary';

export type ConfirmOptions = {
	title: string;
	/** 說明文字；danger 省略時顯示「刪除後無法復原。」，primary 省略時不顯示 */
	message?: string;
	/** 確認鈕文字；danger 預設「刪除」，primary 預設「確定」 */
	confirmText?: string;
	/** 取消鈕文字，預設「取消」 */
	cancelText?: string;
	/** 預設 'danger'（也可以在 useConfirm({ tone }) 設定整個 hook 的預設值） */
	tone?: ConfirmTone;
};

/**
 * 用法：const [confirm, confirmDialog] = useConfirm(); if (await confirm({...})) ... ；並渲染 {confirmDialog}
 * 非破壞性的確認：confirm({ title: '要一併完成任務嗎？', confirmText: '完成任務', tone: 'primary' })。
 */
export function useConfirm(defaults: { tone?: ConfirmTone } = {}) {
	const [state, setState] = useState<ConfirmOptions | null>(null);
	const answer = useRef<((v: boolean) => void) | null>(null);

	const confirm = useCallback(
		(opts: ConfirmOptions) =>
			new Promise<boolean>((resolve) => {
				// 前一個還沒回答就被新的取代：當成取消，不讓呼叫端永遠等不到結果
				answer.current?.(false);
				answer.current = resolve;
				setState(opts);
			}),
		[],
	);
	const close = (v: boolean) => {
		answer.current?.(v);
		answer.current = null;
		setState(null);
	};

	const danger = (state?.tone ?? defaults.tone ?? 'danger') === 'danger';
	const message = state?.message ?? (danger ? '刪除後無法復原。' : undefined);
	const element = (
		<Dialog
			open={!!state}
			onClose={() => close(false)}
			title={state?.title ?? ''}
			footer={
				<>
					{/* 破壞性操作：預設焦點放在「取消」，避免連按 Enter 就刪除；一般確認的焦點放在確認鈕 */}
					<Button onClick={() => close(false)} autoFocus={danger}>
						{state?.cancelText ?? '取消'}
					</Button>
					<Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus={!danger}>
						{state?.confirmText ?? (danger ? '刪除' : '確定')}
					</Button>
				</>
			}
		>
			{message && <p className="text-sm text-ink-2">{message}</p>}
		</Dialog>
	);
	return [confirm, element] as const;
}
