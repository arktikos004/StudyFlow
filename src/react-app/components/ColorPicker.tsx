import { Check, ChevronDown, CircleAlert, Moon, Sun, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { flushSync } from 'react-dom';
import {
	colorLabel,
	colorWarnings,
	hexToHsv,
	hsvToHex,
	parseHex,
	subjectTone,
	suggestColor,
	TONE_SURFACES,
	type Hsv,
	type NamedColor,
} from '../../shared/color';
import { colorName, PALETTE, paletteIndex, PALETTE_HUES, RECOMMENDED } from '../../shared/palette';
import { useSubjectTone } from '../lib/subject-color';
import { SubjectChip } from './subjects';
import { Button, cn, Input } from './ui';

// 科目選色器（SUB-1）：推薦 8 色 → 「更多顏色」10 × 4 色格 → 「自訂顏色」（飽和度／亮度方塊、色相、hex）。
// 色票與預覽的顏色一律經過 subjectTone；提醒只提醒、不阻擋。

export type PickerSubject = { id: string; name: string; color: string };

type ColorPickerProps = {
	/** 目前的顏色（#rrggbb） */
	value: string;
	/** 選到顏色時呼叫，參數一律是小寫 #rrggbb */
	onChange: (hex: string) => void;
	/** 科目列表，依列表（也就是圖表）的順序；可以包含自己，會用 selfId 排除 */
	subjects: readonly PickerSubject[];
	/** 正在編輯的科目；省略代表新科目（新科目排在最後） */
	selfId?: string;
	/** 預覽 chip 上的名稱；省略時用 selfId 對應的科目名稱 */
	name?: string;
	/** 預覽 chip 上的圖示（SUBJECT_ICONS 的 key）；省略代表不顯示 */
	icon?: string | null;
	/** 選色器的名稱，用在各個 radiogroup 的 aria-label */
	label?: string;
};

const COLS = PALETTE_HUES.length;
const MODES = ['light', 'dark'] as const;
const quote = (names: readonly string[]) => names.map((n) => `「${n}」`).join('、');
const toNamed = (s: PickerSubject): NamedColor => ({ name: s.name, hex: s.color });

/** 圖表中相鄰的科目：列表順序的前一個和後一個。新科目會排在最後，所以只有目前的最後一個科目 */
function neighborsOf(subjects: readonly PickerSubject[], selfId?: string): { before?: PickerSubject; after?: PickerSubject } {
	const i = selfId ? subjects.findIndex((s) => s.id === selfId) : -1;
	if (i < 0) return { before: subjects.at(-1) };
	return { before: subjects[i - 1], after: subjects[i + 1] };
}

export function ColorPicker({ value, onChange, subjects, selfId, name, icon, label = '科目顏色' }: ColorPickerProps) {
	const current = parseHex(value) ?? RECOMMENDED[0].hex;
	const toneOf = useSubjectTone();
	const baseId = useId();
	const moreId = `${baseId}-more`;
	const customId = `${baseId}-custom`;
	const morePanel = useRef<HTMLDivElement>(null);
	const customPanel = useRef<HTMLDivElement>(null);
	// 目前的顏色在哪裡就先展開哪裡，讓使用者看得到選中的色票
	const [moreOpen, setMoreOpen] = useState(() => paletteIndex(current) !== null);
	const [customOpen, setCustomOpen] = useState(() => paletteIndex(current) === null && !RECOMMENDED.some((c) => c.hex === current));

	const { usedBy, before, after, warnings, suggestion } = useMemo(() => {
		const others = subjects.filter((s) => s.id !== selfId);
		const { before, after } = neighborsOf(subjects, selfId);
		const near = [before, after].filter((s): s is PickerSubject => s !== undefined);
		const usedBy = new Map<string, string[]>();
		for (const s of others) {
			const hex = parseHex(s.color);
			if (hex) usedBy.set(hex, [...(usedBy.get(hex) ?? []), s.name]);
		}
		const warnings = colorWarnings(current, others.map(toNamed), near.map(toNamed));
		const suggestion = warnings.length
			? suggestColor(
					current,
					others.map((s) => s.color),
					near.map((s) => s.color),
				)
			: null;
		return { usedBy, before, after, warnings, suggestion };
	}, [current, subjects, selfId]);

	const previewName = name?.trim() || subjects.find((s) => s.id === selfId)?.name || '新科目';

	const toggleMore = () => {
		const open = !moreOpen;
		flushSync(() => setMoreOpen(open));
		if (open) morePanel.current?.scrollIntoView({ block: 'nearest' });
	};
	const toggleCustom = () => {
		const open = !customOpen;
		flushSync(() => setCustomOpen(open));
		if (open) customPanel.current?.scrollIntoView({ block: 'nearest' });
	};
	// 建議色都在「更多顏色」裡：展開色格，把焦點移到選中的色票（提醒消失後焦點才不會掉到頁面最上方）
	const applySuggestion = () => {
		if (!suggestion) return;
		flushSync(() => {
			onChange(suggestion);
			setMoreOpen(true);
		});
		const checked = morePanel.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
		checked?.focus();
		checked?.scrollIntoView({ block: 'nearest' });
	};

	return (
		<div className="@container space-y-3">
			<RecommendedRow value={current} onChange={onChange} usedBy={usedBy} label={label} />

			<div className="flex flex-wrap gap-1">
				<Button variant="ghost" aria-expanded={moreOpen} aria-controls={moreId} onClick={toggleMore}>
					更多顏色
					<ChevronDown
						className={cn('size-4 transition-transform duration-180 motion-reduce:transition-none', moreOpen && 'rotate-180')}
						aria-hidden
					/>
				</Button>
				<Button variant="ghost" aria-expanded={customOpen} aria-controls={customId} onClick={toggleCustom}>
					自訂顏色
					<ChevronDown
						className={cn('size-4 transition-transform duration-180 motion-reduce:transition-none', customOpen && 'rotate-180')}
						aria-hidden
					/>
				</Button>
			</div>

			<div id={moreId} ref={morePanel} hidden={!moreOpen}>
				{moreOpen && <PaletteGrid value={current} onChange={onChange} usedBy={usedBy} label={label} />}
			</div>

			<div id={customId} ref={customPanel} hidden={!customOpen}>
				{customOpen && <CustomColor value={current} onChange={onChange} />}
			</div>

			<Preview hex={current} name={previewName} icon={icon} before={before} after={after} />

			<div role="status" aria-live="polite">
				{warnings.length > 0 && (
					<div className="max-w-[22.25rem] space-y-2.5 rounded-lg bg-warning-soft px-3 py-2.5">
						<ul className="space-y-1 text-sm text-ink">
							{warnings.map((w) => (
								<li key={w} className="flex items-start gap-2">
									<TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
									<span>{w}</span>
								</li>
							))}
						</ul>
						{suggestion && (
							<Button onClick={applySuggestion}>
								<span aria-hidden className="size-4 shrink-0 rounded-full" style={{ background: toneOf(suggestion).mark }} />
								改用建議色：{colorLabel(suggestion)}
							</Button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

type SwatchGroupProps = {
	value: string;
	onChange: (hex: string) => void;
	usedBy: ReadonlyMap<string, readonly string[]>;
	label: string;
};

/** 推薦 8 色：radiogroup，roving tabindex，方向鍵移動並選取（頭尾相接），觸控範圍 44px */
function RecommendedRow({ value, onChange, usedBy, label }: SwatchGroupProps) {
	const toneOf = useSubjectTone();
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const checked = RECOMMENDED.findIndex((c) => c.hex === value);
	const tabStop = Math.max(0, checked);

	const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
		const n = RECOMMENDED.length;
		const moves: Record<string, number> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 };
		const to = moves[e.key];
		if (to === undefined) return;
		e.preventDefault();
		const next = (to + n) % n;
		onChange(RECOMMENDED[next].hex);
		refs.current[next]?.focus();
	};

	return (
		<div
			role="radiogroup"
			aria-label={`${label}：推薦顏色`}
			className="grid grid-cols-[repeat(4,2.75rem)] @min-[22rem]:grid-cols-[repeat(8,2.75rem)]"
		>
			{RECOMMENDED.map((c, i) => {
				const tone = toneOf(c.hex);
				const users = usedBy.get(c.hex);
				const on = i === checked;
				return (
					<button
						key={c.hex}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="radio"
						aria-checked={on}
						aria-label={users ? `${c.name}，已用於${quote(users)}` : c.name}
						title={users ? `${c.name}，已用於${quote(users)}` : c.name}
						tabIndex={i === tabStop ? 0 : -1}
						onClick={() => onChange(c.hex)}
						onKeyDown={(e) => onKeyDown(e, i)}
						className="grid size-11 place-items-center rounded-full"
					>
						<span
							className={cn('relative grid size-8 place-items-center rounded-full', on && 'ring-2 ring-ink ring-offset-2 ring-offset-card')}
							style={{ background: tone.mark }}
						>
							{on && <Check className="size-4" strokeWidth={3} style={{ color: tone.onMark }} aria-hidden />}
							{users && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-ink" />}
						</span>
					</button>
				);
			})}
		</div>
	);
}

/** 更多顏色：4 列（色調）× 10 欄（色相）的 radiogroup；左右在同一列移動、上下換列、Home／End 到列頭列尾 */
function PaletteGrid({ value, onChange, usedBy, label }: SwatchGroupProps) {
	const toneOf = useSubjectTone();
	const gridRef = useRef<HTMLDivElement>(null);
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const at = paletteIndex(value);
	const checked = at ? at.tone * COLS + at.hue : -1;
	const tabStop = Math.max(0, checked);

	const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tone: number, hue: number) => {
		// 排版由 CSS 決定（容器查詢＋pointer 媒體查詢），這裡讀同一組查詢設定的 --grid-blocks，方向鍵跟著畫面走
		const grid = gridRef.current;
		const blocks = grid && getComputedStyle(grid).getPropertyValue('--grid-blocks').trim() === '1' ? 1 : 2;
		const next = moveInGrid(tone, hue, e.key, blocks);
		if (!next) return;
		e.preventDefault();
		if (next.tone === tone && next.hue === hue) return;
		onChange(PALETTE[next.tone][next.hue]);
		refs.current[next.tone * COLS + next.hue]?.focus();
	};

	return (
		<div
			ref={gridRef}
			role="radiogroup"
			aria-label={`${label}：更多顏色`}
			className={cn(
				// 預設（觸控裝置或容器不夠寬）：兩塊 5 色相 × 4 色調上下排列、每格 44px，中間多 4px 的空行分隔
				'grid grid-cols-[repeat(5,var(--cell))] grid-rows-[repeat(4,var(--cell))_0.25rem_repeat(4,var(--cell))] gap-1 [--cell:2.75rem] [--grid-blocks:2]',
				// 滑鼠等精確指標：一律 10 × 4 一整塊，格子依容器寬度介於 32–44px（扣掉 9 個 4px 間距後平分）；
				// 容器放不下 10 格 × 32px（含間距 356px）時才維持兩塊
				'@min-[22.25rem]:pointer-fine:grid-cols-[repeat(10,var(--cell))] @min-[22.25rem]:pointer-fine:grid-rows-[repeat(4,var(--cell))] @min-[22.25rem]:pointer-fine:[--grid-blocks:1]',
				'@min-[22.25rem]:pointer-fine:[--cell:clamp(2rem,calc((100cqw_-_2.25rem)_/_10),2.75rem)]',
			)}
		>
			{GRID_CELLS.map(({ hex, tone: t, hue: h }) => {
				const i = t * COLS + h;
				const tone = toneOf(hex);
				const users = usedBy.get(hex);
				const colorTitle = colorName(hex) ?? hex;
				const on = i === checked;
				const block = Math.floor(h / BLOCK_HUES);
				// 兩種排版各自的格線位置；class 依查詢結果選用其中一組
				const place = {
					'--r1': String(t + 1),
					'--c1': String(h + 1),
					'--r2': String(block * (PALETTE.length + 1) + t + 1),
					'--c2': String((h % BLOCK_HUES) + 1),
				};
				return (
					<button
						key={hex}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="radio"
						aria-checked={on}
						aria-label={users ? `${colorTitle}，已用於${quote(users)}` : colorTitle}
						title={users ? `${colorTitle}，已用於${quote(users)}` : colorTitle}
						tabIndex={i === tabStop ? 0 : -1}
						onClick={() => onChange(hex)}
						onKeyDown={(e) => onKeyDown(e, t, h)}
						className={cn(
							'relative grid size-(--cell) place-items-center rounded-sm',
							'[grid-column:var(--c2)] [grid-row:var(--r2)] @min-[22.25rem]:pointer-fine:[grid-column:var(--c1)] @min-[22.25rem]:pointer-fine:[grid-row:var(--r1)]',
							on && 'ring-2 ring-ink ring-offset-1 ring-offset-card',
						)}
						style={{ background: tone.mark, ...place } as CSSProperties}
					>
						{on && <Check className="size-5" strokeWidth={3} style={{ color: tone.onMark }} aria-hidden />}
						{users && <span aria-hidden className="absolute top-1 right-1 size-2 rounded-full" style={{ background: tone.onMark }} />}
					</button>
				);
			})}
		</div>
	);
}

/** 兩塊排版時每一塊的色相數：第一塊紅到綠、第二塊青到桃紅 */
const BLOCK_HUES = 5;

/** DOM 順序跟著兩塊排版（觸控裝置與窄容器），手機上用瀏覽模式讀到的順序和畫面一致；一整塊時方向鍵另外依畫面移動 */
const GRID_CELLS = [0, 1].flatMap((block) =>
	PALETTE.flatMap((row, tone) =>
		row.slice(block * BLOCK_HUES, (block + 1) * BLOCK_HUES).map((hex, i) => ({ hex, tone, hue: block * BLOCK_HUES + i })),
	),
);

/**
 * 色格的方向鍵，依畫面上的排列移動：
 * - 一整塊（10 × 4）：左右在同一列、上下換列，Home／End 到列頭列尾。
 * - 兩塊（上下兩塊 5 × 4）：左右在同一塊的同一列；上下逐列移動，會從第一塊的最後一列跨到第二塊的第一列；
 *   Home／End 到該塊該列的頭尾。
 * 不是方向鍵時回傳 null。
 */
function moveInGrid(tone: number, hue: number, key: string, blocks: 1 | 2): { tone: number; hue: number } | null {
	const rows = PALETTE.length;
	const width = blocks === 1 ? COLS : BLOCK_HUES;
	const block = blocks === 1 ? 0 : Math.floor(hue / BLOCK_HUES);
	const col = hue - block * width;
	let row = block * rows + tone; // 畫面上的第幾列（兩塊時 0–7）
	let c = col;
	if (key === 'ArrowLeft') c = Math.max(0, col - 1);
	else if (key === 'ArrowRight') c = Math.min(width - 1, col + 1);
	else if (key === 'ArrowUp') row = Math.max(0, row - 1);
	else if (key === 'ArrowDown') row = Math.min(blocks * rows - 1, row + 1);
	else if (key === 'Home') c = 0;
	else if (key === 'End') c = width - 1;
	else return null;
	return { tone: row % rows, hue: Math.floor(row / rows) * width + c };
}

const toPercent = (x: number) => Math.round(x * 100);
const HUE_TRACK = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h} 100% 50%)`).join(', ')})`;
// 原生 range：軌道畫色相漸層，20px 圓形把手；觸控範圍是整個 44px 高的 input。
// 把手的 border-white 是 DESIGN.md §7「跨頁慣例」允許的例外：把手疊在任何顏色上都要看得見，不能跟著主題換色（外圈再加一圈半透明黑）
const HUE_RANGE = cn(
	'h-11 w-full max-w-[22.25rem] cursor-pointer appearance-none bg-transparent',
	'[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:[background:var(--hue-track)]',
	'[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:[background:var(--hue-track)]',
	'[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:[background:var(--hue-thumb)] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(0_0_0/0.4)]',
	'[&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:[background:var(--hue-thumb)] [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgb(0_0_0/0.4)]',
);

/** 自訂顏色：飽和度／亮度方塊＋色相滑桿＋hex 輸入 */
function CustomColor({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
	const hexId = useId();
	const errorId = useId();
	const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
	const [synced, setSynced] = useState(value);
	const [draft, setDraft] = useState(() => value.slice(1).toUpperCase());
	const [invalid, setInvalid] = useState(false);

	// 顏色從外面改變（例如點了色票）時同步方塊、滑桿與 hex 欄位。灰色沒有色相，保留原本的色相
	if (value !== synced) {
		const next = hexToHsv(value);
		setSynced(value);
		setHsv(next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next);
		setDraft(value.slice(1).toUpperCase());
		setInvalid(false);
	}

	const emit = (next: Hsv) => {
		const hex = hsvToHex(next);
		setHsv(next);
		setSynced(hex);
		setDraft(hex.slice(1).toUpperCase());
		setInvalid(false);
		if (hex !== value) onChange(hex);
	};

	// 在 blur 或 Enter 時驗證；清空欄位就還原成目前的顏色
	const commitDraft = () => {
		if (!draft.trim()) {
			setDraft(value.slice(1).toUpperCase());
			setInvalid(false);
			return;
		}
		const hex = parseHex(draft);
		if (!hex) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		setDraft(hex.slice(1).toUpperCase());
		if (hex === value) return;
		const next = hexToHsv(hex);
		setHsv(next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next);
		setSynced(hex);
		onChange(hex);
	};

	return (
		<div className="space-y-2">
			<SatValSquare hsv={hsv} onChange={emit} />
			<input
				type="range"
				min={0}
				max={359}
				step={1}
				value={Math.round(hsv.h) % 360}
				onChange={(e) => emit({ ...hsv, h: Number(e.target.value) })}
				aria-label="色相"
				aria-valuetext={`色相 ${Math.round(hsv.h) % 360} 度`}
				className={HUE_RANGE}
				style={{ '--hue-track': HUE_TRACK, '--hue-thumb': `hsl(${hsv.h} 100% 50%)` } as CSSProperties}
			/>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				<label htmlFor={hexId} className="text-sm font-semibold text-ink-2">
					色碼
				</label>
				<div className="relative w-36">
					<span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">
						#
					</span>
					<Input
						id={hexId}
						value={draft}
						onChange={(e) => setDraft(e.target.value.replace(/^\s*[#＃]/, ''))}
						onBlur={commitDraft}
						onKeyDown={(e) => {
							// 注音輸入法選字時的 Enter 不算送出；Enter 也不能送出外層的新增科目表單
							if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
							e.preventDefault();
							commitDraft();
						}}
						spellCheck={false}
						autoComplete="off"
						autoCapitalize="characters"
						aria-invalid={invalid || undefined}
						aria-describedby={invalid ? errorId : undefined}
						className="pl-7 font-mono uppercase aria-invalid:border-danger"
					/>
				</div>
				{invalid && (
					<p id={errorId} role="alert" className="flex items-center gap-1 text-[0.8125rem] text-danger">
						<CircleAlert className="size-4 shrink-0" aria-hidden />
						顏色格式錯誤，請輸入 6 位數色碼，例如 #396ED6
					</p>
				)}
			</div>
		</div>
	);
}

/** 飽和度（橫軸）／亮度（縱軸）方塊：role="slider"，方向鍵 ±1%、Shift ±10%，拖曳用 pointer capture */
function SatValSquare({ hsv, onChange }: { hsv: Hsv; onChange: (next: Hsv) => void }) {
	const s = toPercent(hsv.s);
	const v = toPercent(hsv.v);

	const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
		const r = e.currentTarget.getBoundingClientRect();
		const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
		const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
		onChange({ h: hsv.h, s: x, v: 1 - y });
	};

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		const step = e.shiftKey ? 10 : 1;
		let ns = s;
		let nv = v;
		if (e.key === 'ArrowLeft') ns -= step;
		else if (e.key === 'ArrowRight') ns += step;
		else if (e.key === 'ArrowUp') nv += step;
		else if (e.key === 'ArrowDown') nv -= step;
		else return;
		e.preventDefault();
		const clampPct = (x: number) => Math.min(100, Math.max(0, x)) / 100;
		onChange({ h: hsv.h, s: clampPct(ns), v: clampPct(nv) });
	};

	return (
		<div
			role="slider"
			tabIndex={0}
			aria-label="飽和度與亮度"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={s}
			aria-valuetext={`飽和度 ${s}%，亮度 ${v}%`}
			onPointerDown={(e) => {
				if (e.button !== 0) return;
				e.currentTarget.setPointerCapture(e.pointerId);
				fromPointer(e);
			}}
			onPointerMove={(e) => {
				if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
			}}
			onKeyDown={onKeyDown}
			className="relative h-36 w-full max-w-[22.25rem] cursor-crosshair touch-none rounded-lg select-none"
			style={{ background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, hsl(${hsv.h} 100% 50%))` }}
		>
			{/* 把手的 border-white 是跨頁慣例允許的例外（選色器把手在任何顏色上都要看得見） */}
			<span
				aria-hidden
				className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4),0_1px_4px_rgb(0_0_0/0.3)]"
				style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }}
			/>
		</div>
	);
}

/**
 * 預覽：目前所選顏色的名稱（色盤顏色用「藍（明）」，自訂色用「自訂 #RRGGBB」），
 * 以及固定用淺色與深色各算一次 tone（不受目前主題影響）的 chip 和與相鄰科目疊在一起的迷你長條
 */
function Preview({
	hex,
	name,
	icon,
	before,
	after,
}: {
	hex: string;
	name: string;
	icon?: string | null;
	before?: PickerSubject;
	after?: PickerSubject;
}) {
	const around = [before, after].filter((s): s is PickerSubject => s !== undefined).map((s) => s.name);
	const description = `預覽：「${name}」在淺色與深色模式的標籤${around.length ? `，以及和${quote(around)}並排的長條` : ''}`;
	return (
		<div className="max-w-[22.25rem] space-y-1.5">
			<p className="text-sm text-ink-2">
				目前的顏色：<span className="font-semibold text-ink">{colorLabel(hex)}</span>
			</p>
			<div role="img" aria-label={description} className="grid grid-cols-2 gap-2">
				{MODES.map((mode) => {
					const dark = mode === 'dark';
					const surface = TONE_SURFACES[mode];
					const segments = [
						before && { key: 'before', weight: 3, mark: subjectTone(before.color, dark).mark },
						{ key: 'self', weight: 4, mark: subjectTone(hex, dark).mark },
						after && { key: 'after', weight: 3, mark: subjectTone(after.color, dark).mark },
					].filter((x) => !!x);
					return (
						<div key={mode} className="min-w-0">
							<p className="mb-1 flex items-center gap-1 text-xs text-ink-2">
								{dark ? <Moon className="size-3.5" aria-hidden /> : <Sun className="size-3.5" aria-hidden />}
								{dark ? '深色' : '淺色'}
							</p>
							<div className="space-y-2.5 rounded-lg border border-line p-2.5" style={{ background: surface.card }}>
								<SubjectChip name={name} icon={icon} tone={subjectTone(hex, dark, surface.card)} style={{ color: surface.ink }} />
								<div className="flex h-2.5 gap-0.5 overflow-hidden rounded-sm">
									{segments.map((seg) => (
										<span key={seg.key} style={{ flex: seg.weight, background: seg.mark }} />
									))}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
