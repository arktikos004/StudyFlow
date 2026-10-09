import { CUSTOM_CHOICE, MASTERED_REVIEW_PRESETS, type IntervalChoice } from '../lib/mastered-review';
import { Field, Input, Select } from './ui';

/**
 * 已掌握題目的複習間隔：特別選項（由呼叫端給，例如「不提醒」「跟隨設定」）、常用天數、自訂天數。
 * 選「自訂天數」時旁邊出現天數的輸入框；驗證交給呼叫端的 schema（error）。設定頁與筆記編輯共用。
 */
export function MasteredReviewField({
	label,
	hint,
	specialOptions,
	value,
	onChange,
	error,
}: {
	label: string;
	hint?: string;
	specialOptions: readonly { key: string; label: string }[];
	value: IntervalChoice;
	onChange: (value: IntervalChoice) => void;
	error?: string;
}) {
	return (
		<Field label={label} hint={hint} error={error}>
			{(id, aria) => (
				<div className="flex flex-wrap items-center gap-2">
					<Select
						id={id}
						{...aria}
						value={value.choice}
						onChange={(e) => onChange({ ...value, choice: e.target.value })}
						className="min-w-44"
					>
						{specialOptions.map((o) => (
							<option key={o.key} value={o.key}>
								{o.label}
							</option>
						))}
						{MASTERED_REVIEW_PRESETS.map((days) => (
							<option key={days} value={String(days)}>
								每 {days} 天
							</option>
						))}
						<option value={CUSTOM_CHOICE}>自訂天數</option>
					</Select>
					{value.choice === CUSTOM_CHOICE && (
						<span className="flex items-center gap-2 text-sm text-ink-2">
							每
							<Input
								{...aria}
								aria-label="自訂的天數"
								inputMode="numeric"
								autoComplete="off"
								value={value.custom}
								onChange={(e) => onChange({ ...value, custom: e.target.value })}
								className="w-20 tabular-nums"
							/>
							天
						</span>
					)}
				</div>
			)}
		</Field>
	);
}
