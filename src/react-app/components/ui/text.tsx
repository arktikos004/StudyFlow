import { type ReactNode } from 'react';
import { cn } from './cn';

// 文字小元件：搜尋關鍵字的標示、鍵盤按鍵

/** 用 <mark>（螢光筆黃）標出關鍵字；query 以空白分隔多個關鍵字，不分大小寫，支援中文子字串 */
export function Highlight({ text, query, className }: { text: string; query: string | readonly string[]; className?: string }) {
	const terms = (typeof query === 'string' ? query.split(/\s+/) : query).map((t) => t.trim()).filter(Boolean);
	if (!text || !terms.length) return <>{text}</>;
	const pattern = terms
		.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.sort((a, b) => b.length - a.length)
		.join('|');
	const parts = text.split(new RegExp(`(${pattern})`, 'giu'));
	return (
		<>
			{parts.map((p, i) =>
				i % 2 === 1 ? (
					<mark key={i} className={className}>
						{p}
					</mark>
				) : (
					p
				),
			)}
		</>
	);
}

/** 鍵盤按鍵，例如 <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<kbd
			className={cn(
				'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-card px-1 font-num text-caption leading-none text-ink-2 shadow-[inset_0_-1px_0_var(--line-strong)]',
				className,
			)}
		>
			{children}
		</kbd>
	);
}
