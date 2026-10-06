import { Check, Monitor, Moon, Play, Sun } from 'lucide-react';
import { useId, useRef, type KeyboardEvent } from 'react';
import { ACCENTS, setAccent, setThemeMode, useAccent, useThemeMode, type AccentId, type ThemeMode } from '../../lib/theme';
import { Card, CardHeader, cn, gridKeyTarget, Segmented } from '../ui';

/**
 * 主題色（SUB-4）：6 組預先驗證的色組，WAI-ARIA radiogroup（roving tabindex，方向鍵依畫面排列移動並選取）。
 * 選了就立刻套用到整個 App（setAccent 存在 localStorage，theme-init.js 下次在第一次繪製前套用）。
 * 色票左半是淺色、右半是深色：同一個元素同時給 data-theme 與 data-accent（DESIGN.md §2 的局部預覽）。
 */
function AccentPicker({ value, labelledBy }: { value: AccentId; labelledBy: string }) {
	const gridRef = useRef<HTMLDivElement>(null);
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const checked = Math.max(
		0,
		ACCENTS.findIndex((a) => a.id === value),
	);

	const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
		const next = gridKeyTarget(e, i, ACCENTS.length, gridRef.current);
		if (next === null) return;
		e.preventDefault();
		if (next === i) return;
		setAccent(ACCENTS[next].id);
		refs.current[next]?.focus();
	};

	return (
		<div ref={gridRef} role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
			{ACCENTS.map((a, i) => {
				const on = i === checked;
				return (
					<button
						key={a.id}
						ref={(el) => {
							refs.current[i] = el;
						}}
						type="button"
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						onClick={() => setAccent(a.id)}
						onKeyDown={(e) => onKeyDown(e, i)}
						className={cn(
							'flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-dense transition-colors duration-120 ease-out',
							on ? 'border-accent bg-accent-soft font-semibold text-accent-ink' : 'border-line text-ink hover:bg-subtle',
						)}
					>
						<span aria-hidden className="flex size-6 shrink-0 overflow-hidden rounded-full ring-1 ring-line">
							<span data-theme="light" data-accent={a.id} className="h-full w-1/2 bg-accent" />
							<span data-theme="dark" data-accent={a.id} className="h-full w-1/2 bg-accent" />
						</span>
						<span className="min-w-0 flex-1 truncate">{a.name}</span>
						{on && <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />}
					</button>
				);
			})}
		</div>
	);
}

/** 目前色組在淺色與深色模式的樣子：主要按鈕、連結、進度條、強調標籤 */
function AccentPreview({ accent }: { accent: AccentId }) {
	const name = ACCENTS.find((a) => a.id === accent)?.name ?? '';
	return (
		<div role="img" aria-label={`預覽：「${name}」在淺色與深色模式的按鈕、連結、進度條與標籤`} className="grid grid-cols-2 gap-2">
			{(['light', 'dark'] as const).map((mode) => (
				<div key={mode} data-theme={mode} data-accent={accent} className="min-w-0 space-y-2.5 rounded-lg border border-line bg-page p-3 text-ink">
					<p className="flex items-center gap-1 text-xs text-ink-2">
						{mode === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
						{mode === 'dark' ? '深色' : '淺色'}
					</p>
					<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
						<span className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-semibold text-on-accent">
							<Play className="size-3" />
							開始專注
						</span>
						<span className="text-xs text-accent-ink underline underline-offset-2">查看全部</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-accent-soft">
						<div className="h-full w-3/5 rounded-full bg-accent" />
					</div>
					<span className="inline-flex h-5 items-center rounded-sm bg-accent-soft px-1.5 text-xs font-semibold text-accent-ink">進行中</span>
				</div>
			))}
		</div>
	);
}

/** 外觀：深淺色切換（不變）＋主題色（SUB-4） */
export function AppearanceCard() {
	const mode = useThemeMode();
	const accent = useAccent();
	const modeLabelId = useId();
	const accentLabelId = useId();
	return (
		<Card>
			<CardHeader title="外觀" />
			<div className="space-y-5 px-4 pb-5 sm:px-5">
				<div className="space-y-2">
					<p id={modeLabelId} className="text-sm font-semibold text-ink-2">
						深淺色
					</p>
					<Segmented<ThemeMode>
						label="深淺色"
						value={mode}
						onChange={setThemeMode}
						options={[
							{
								value: 'system',
								label: (
									<span className="inline-flex items-center gap-1.5">
										<Monitor className="size-4" aria-hidden />
										跟隨系統
									</span>
								),
							},
							{
								value: 'light',
								label: (
									<span className="inline-flex items-center gap-1.5">
										<Sun className="size-4" aria-hidden />
										淺色
									</span>
								),
							},
							{
								value: 'dark',
								label: (
									<span className="inline-flex items-center gap-1.5">
										<Moon className="size-4" aria-hidden />
										深色
									</span>
								),
							},
						]}
					/>
				</div>
				<div className="space-y-2">
					<p id={accentLabelId} className="text-sm font-semibold text-ink-2">
						主題色
					</p>
					<AccentPicker value={accent} labelledBy={accentLabelId} />
					<AccentPreview accent={accent} />
				</div>
			</div>
		</Card>
	);
}
