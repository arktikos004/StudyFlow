import { SlidersHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import { LIMITS, optionError, timer, type NumericOption, type TimerState } from '../../lib/timer';
import { Button, cn, Field, Input, Segmented, Switch } from '../ui';

/** 常用的分鐘數；也可以直接輸入 LIMITS 範圍內的任何整數 */
const PRESETS: Partial<Record<NumericOption, number[]>> = {
	focusMin: [15, 25, 45, 50],
	breakMin: [5, 10, 15],
	longBreakMin: [10, 15, 20, 30],
};

/**
 * 一個數字設定：常用值（Segmented）加上自訂輸入。
 * 輸入合法時立即套用；超出範圍時顯示錯誤，計時器繼續用上一個合法的值。
 */
function OptionField({ option, value, hint }: { option: NumericOption; value: number; hint?: string }) {
	const { label, unit, min, max } = LIMITS[option];
	const presets = PRESETS[option];
	const [draft, setDraft] = useState(String(value));
	// 用常用值或其他分頁改了設定：輸入框跟著更新
	const [synced, setSynced] = useState(value);
	if (synced !== value) {
		setSynced(value);
		setDraft(String(value));
	}
	const error = optionError(option, draft);
	const commit = (v: number) => timer.setOptions({ [option]: v });

	return (
		<Field
			label={label}
			error={error}
			hint={hint}
			className="sm:grid sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-4 sm:[&>p]:col-start-2"
		>
			{(id, aria) => (
				<div className="flex flex-wrap items-center gap-2">
					{presets && (
						<Segmented
							label={`${label}常用值（${unit}）`}
							value={String(value)}
							onChange={(v) => commit(Number(v))}
							options={presets.map((m) => ({ value: String(m), label: <span className="font-num tabular-nums">{m}</span> }))}
						/>
					)}
					<div className="relative w-28">
						<Input
							id={id}
							{...aria}
							type="number"
							inputMode="numeric"
							min={min}
							max={max}
							step={1}
							value={draft}
							onChange={(e) => {
								setDraft(e.target.value);
								if (!optionError(option, e.target.value)) commit(Number(e.target.value));
							}}
							className="pr-12"
						/>
						<span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-meta text-ink-3" aria-hidden>
							{unit}
						</span>
					</div>
				</div>
			)}
		</Field>
	);
}

/** 番茄鐘設定（TMR-1）：平常只顯示一行摘要，按「調整」展開（專注空間保持安靜） */
export function PomodoroSettings({ s, className }: { s: TimerState; className?: string }) {
	const [open, setOpen] = useState(false);
	const id = useId();
	return (
		<section aria-labelledby={`${id}-title`} className={cn('w-full max-w-xl border-t border-line pt-5', className)}>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<h2 id={`${id}-title`} className="text-h2 font-semibold">
						番茄鐘設定
					</h2>
					<p className="text-meta text-pretty text-ink-3">
						專注 {s.focusMin} 分，短休息 {s.breakMin} 分，每 {s.longBreakEvery} 輪長休息 {s.longBreakMin} 分
					</p>
				</div>
				<Button variant="ghost" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}>
					<SlidersHorizontal className="size-4" aria-hidden />
					{open ? '收起' : '調整'}
				</Button>
			</div>
			<div id={`${id}-panel`} hidden={!open} className="mt-5">
				<div className="flex flex-col gap-5">
					<OptionField option="focusMin" value={s.focusMin} />
					<OptionField option="breakMin" value={s.breakMin} />
					<OptionField option="longBreakMin" value={s.longBreakMin} />
					<OptionField option="longBreakEvery" value={s.longBreakEvery} hint={`每完成 ${s.longBreakEvery} 個番茄，長休息一次`} />
				</div>
				<div className="mt-4 flex flex-col">
					<Switch
						checked={s.autoStartBreak}
						onChange={(autoStartBreak) => timer.setOptions({ autoStartBreak })}
						label="專注結束後自動開始休息"
					/>
					<Switch
						checked={s.autoStartFocus}
						onChange={(autoStartFocus) => timer.setOptions({ autoStartFocus })}
						label="休息結束後自動開始下一輪專注"
						description="離開超過 1 分鐘（例如電腦睡眠）時不會自動開始，也不會補記不在時的番茄"
					/>
				</div>
			</div>
		</section>
	);
}
