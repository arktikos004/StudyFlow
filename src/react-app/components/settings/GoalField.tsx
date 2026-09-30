import type { Ref } from 'react';
import { formatMinutes } from '../../lib/format';
import { parseGoalInput } from '../../lib/subjects-format';
import { Field, Input } from '../ui';

/**
 * 目標分鐘數欄位（GOAL-1、GOAL-2）：文字輸入框（手機跳出數字鍵盤）＋「分鐘」，
 * 提示顯示範圍與換算（例如「約 2 小時」），留空代表不設定。驗證交給呼叫端的 zod schema。
 */
export function GoalField({
	label,
	value,
	onChange,
	error,
	limits,
	inputRef,
	className,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
	limits: { readonly min: number; readonly max: number };
	inputRef?: Ref<HTMLInputElement>;
	className?: string;
}) {
	const parsed = parseGoalInput(value);
	const minutes = typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	return (
		<Field
			label={label}
			error={error}
			hint={`${minutes ? `約 ${formatMinutes(minutes)}；` : ''}${limits.min}–${limits.max} 分鐘，留空代表不設定`}
			className={className}
		>
			{(id, aria) => (
				<div className="flex items-center gap-2">
					<Input
						ref={inputRef}
						id={id}
						{...aria}
						inputMode="numeric"
						autoComplete="off"
						value={value}
						onChange={(e) => onChange(e.target.value)}
						placeholder="不設定"
						className="w-32 tabular-nums"
					/>
					<span className="text-sm text-ink-2">分鐘</span>
				</div>
			)}
		</Field>
	);
}
