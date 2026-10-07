import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

// Dialog：使用原生 <dialog>，內建焦點管理與 Esc 關閉；觸控裝置上是可以往下拖曳關閉的底部面板

/**
 * 放在對話框內容的最前面：在子元件的 autoFocus 執行之前先 showModal()，autoFocus 才會生效。
 * （React 的 layout 階段依樹狀順序處理，這個元件比後面的內容先執行。）
 */
function OpenBeforeContent() {
	const ref = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		const dialog = ref.current?.closest('dialog');
		if (dialog && !dialog.open) dialog.showModal();
	}, []);
	return <span ref={ref} hidden />;
}

const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * 對話框：小於 sm 是由下滑入的 bottom sheet（拖曳把手往下拉可關閉），sm 以上置中。
 * - aria-labelledby 指向標題；Esc、點背景、關閉鈕都會呼叫 onClose。
 * - 關閉後內容會卸載（表單靠這個重設狀態）；進場動畫只在打開時播放。
 * - 觸控裝置不自動 focus（避免跳出鍵盤），焦點放在對話框本身；其他裝置照常套用 autoFocus。
 */
export function Dialog({
	open,
	onClose,
	title,
	children,
	footer,
	wide,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	wide?: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const [coarse] = useState(isCoarsePointer);
	const downOnBackdrop = useRef(false);
	const drag = useRef<{ y: number; dy: number; t: number } | null>(null);
	// 呼叫端用 open=false 關閉時，el.close() 會再觸發一次原生的 close 事件：這個回音不再通知 onClose，
	// onClose 才是「每次關閉只呼叫一次」（也不會落到緊接著打開的下一個確認對話框上，把它自動取消）
	const closingFromProp = useRef(false);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (open && !el.open) {
			closingFromProp.current = false;
			el.showModal();
			if (coarse) el.focus();
		}
		if (!open && el.open) {
			closingFromProp.current = true;
			el.close();
		}
	}, [open, coarse]);

	const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
		const el = ref.current;
		if (!el) return;
		drag.current = { y: e.clientY, dy: 0, t: e.timeStamp };
		e.currentTarget.setPointerCapture(e.pointerId);
		el.style.transition = 'none';
	};
	const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
		const d = drag.current;
		if (!d || !ref.current) return;
		d.dy = Math.max(0, e.clientY - d.y);
		ref.current.style.transform = `translateY(${d.dy}px)`;
	};
	const onHandleEnd = (e: PointerEvent<HTMLDivElement>) => {
		const d = drag.current;
		const el = ref.current;
		drag.current = null;
		if (!d || !el) return;
		el.style.transition = '';
		el.style.transform = '';
		const fast = d.dy / Math.max(1, e.timeStamp - d.t) > 0.5;
		if (d.dy > 80 || (fast && d.dy > 24)) onClose();
	};

	return (
		<dialog
			ref={ref}
			aria-labelledby={titleId}
			tabIndex={-1}
			onClose={() => {
				if (closingFromProp.current) closingFromProp.current = false;
				else onClose();
			}}
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
			onPointerDown={(e) => {
				downOnBackdrop.current = e.target === e.currentTarget;
			}}
			onClick={(e) => {
				// 點背景關閉（按下與放開都在背景上才算，拖選文字到外面不會誤關）
				if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
				downOnBackdrop.current = false;
			}}
			className={cn(
				'sf-dialog m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl border border-b-0 border-line bg-card p-0 text-ink shadow-lg outline-none',
				'sm:m-auto sm:max-h-[85dvh] sm:rounded-2xl sm:border-b',
				wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
			)}
		>
			{open && (
				<div className="flex max-h-[inherit] flex-col">
					{!coarse && <OpenBeforeContent />}
					<div
						className="flex h-5 shrink-0 cursor-grab touch-none items-end justify-center sm:hidden"
						onPointerDown={onHandleDown}
						onPointerMove={onHandleMove}
						onPointerUp={onHandleEnd}
						onPointerCancel={onHandleEnd}
						aria-hidden
					>
						<span className="h-1 w-10 rounded-full bg-line-strong" />
					</div>
					<div className="flex items-center justify-between gap-2 border-b border-line py-2.5 pr-3 pl-5 sm:py-3">
						<h2 id={titleId} className="text-h2 font-semibold text-balance">
							{title}
						</h2>
						<Button variant="ghost" size="icon" onClick={onClose} aria-label="關閉">
							<X className="size-5" />
						</Button>
					</div>
					<div
						className={cn('flex-1 overflow-y-auto overscroll-contain px-5 py-4', !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))]')}
					>
						{children}
					</div>
					{footer && (
						<div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
							{footer}
						</div>
					)}
				</div>
			)}
		</dialog>
	);
}
