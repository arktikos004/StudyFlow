import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useId } from 'react';
import { NOISE_LABEL, setNoisePrefs, useNoisePrefs, type NoiseKind, type NoisePrefs } from '../../lib/noise';
import { Segmented } from '../ui';

const NOISE_OPTIONS: { value: NoisePrefs['kind']; label: string }[] = [
	{ value: 'off', label: '關閉' },
	...(['white', 'pink', 'brown'] as NoiseKind[]).map((k) => ({ value: k, label: NOISE_LABEL[k] })),
];

/** 白噪音（TMR-3）：選種類與音量；專注中才播放，暫停或休息時停止（聲音由計時引擎控制，換頁也會繼續） */
export function NoiseControls({ focusRunning }: { focusRunning: boolean }) {
	const { kind, volume } = useNoisePrefs();
	const id = useId();
	const on = kind !== 'off';
	return (
		<section aria-labelledby={`${id}-title`} className="w-full max-w-xl border-t border-line pt-5">
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<h2 id={`${id}-title`} className="text-h2 font-semibold">
					白噪音
				</h2>
				{on && (
					<p className="flex items-center gap-1.5 text-meta text-ink-2">
						{focusRunning ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
						{focusRunning ? `正在播放${NOISE_LABEL[kind]}` : '專注時才會播放'}
					</p>
				)}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
				<Segmented label="白噪音種類" value={kind} onChange={(k) => setNoisePrefs({ kind: k })} options={NOISE_OPTIONS} />
				<div className="flex min-w-52 flex-1 items-center gap-2">
					<label htmlFor={`${id}-volume`} className="flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
						<Volume1 className="size-4" aria-hidden />
						音量
					</label>
					<input
						id={`${id}-volume`}
						type="range"
						min={0}
						max={100}
						step={5}
						value={volume}
						disabled={!on}
						aria-valuetext={`${volume}%`}
						onChange={(e) => setNoisePrefs({ volume: Number(e.target.value) })}
						className="h-11 min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
					/>
					<output htmlFor={`${id}-volume`} className="w-10 shrink-0 text-right font-num text-sm text-ink-2 tabular-nums">
						{volume}%
					</output>
				</div>
			</div>
		</section>
	);
}
