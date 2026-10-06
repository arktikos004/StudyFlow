import { Ban } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import type { SubjectTone } from '../../../shared/color';
import type { SubjectIcon } from '../../../shared/schemas';
import { SUBJECT_ICON_OPTIONS, type SubjectIconDef } from '../../lib/subject-icons';
import { cn, gridKeyTarget } from '../ui';

type Option = { key: SubjectIcon | null } & Partial<SubjectIconDef> & { label: string };

// 第一格是「無圖示」：和其他格一樣只放圖示（Ban），名稱由 aria-label「無圖示」提供，滑鼠停留時 title 也會顯示
const OPTIONS: readonly Option[] = [{ key: null, label: '無圖示' }, ...SUBJECT_ICON_OPTIONS];

/**
 * 科目圖示選擇器（SUB-2）：WAI-ARIA radiogroup，roving tabindex，方向鍵依畫面上的排列移動並選取。
 * 觸控裝置每格 44px；滑鼠等精確指標每格 36px。選中的格子用科目 tint 底加 ink 內框（不只靠顏色）。
 */
export function IconPicker({
	value,
	onChange,
	tone,
	labelledBy,
}: {
	value: SubjectIcon | null;
	onChange: (icon: SubjectIcon | null) => void;
	/** 目前選的科目色（subjectTone），選中的格子用它的 tint 底，預覽實際的樣子 */
	tone: SubjectTone;
	/** 可見標籤的 id（例如「圖示」） */
	labelledBy: string;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const checked = Math.max(
		0,
		OPTIONS.findIndex((o) => o.key === value),
	);

	const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
		const next = gridKeyTarget(e, i, OPTIONS.length, gridRef.current);
		if (next === null) return;
		e.preventDefault();
		if (next === i) return;
		onChange(OPTIONS[next].key);
		refs.current[next]?.focus();
	};

	return (
		<div
			ref={gridRef}
			role="radiogroup"
			aria-labelledby={labelledBy}
			className="grid grid-cols-[repeat(auto-fill,2.75rem)] gap-1 pointer-fine:grid-cols-[repeat(auto-fill,2.25rem)]"
		>
			{OPTIONS.map((o, i) => {
				const on = i === checked;
				return (
					<button
						key={o.key ?? 'none'}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="radio"
						aria-checked={on}
						aria-label={o.label}
						title={o.label}
						tabIndex={on ? 0 : -1}
						onClick={() => onChange(o.key)}
						onKeyDown={(e) => onKeyDown(e, i)}
						className={cn(
							'grid size-11 place-items-center rounded-lg transition-colors duration-120 ease-out pointer-fine:size-9',
							on ? 'text-ink ring-2 ring-ink ring-inset' : 'text-ink-2 hover:bg-subtle hover:text-ink',
						)}
						style={on ? { background: tone.tint } : undefined}
					>
						{o.Icon ? <o.Icon className="size-5" aria-hidden /> : <Ban className="size-5" aria-hidden />}
					</button>
				);
			})}
		</div>
	);
}
