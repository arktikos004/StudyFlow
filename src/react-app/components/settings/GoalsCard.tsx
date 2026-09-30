import { useRef, useState, type FormEvent } from 'react';
import { GOAL_LIMITS, updateProfileSchema } from '../../../shared/schemas';
import { useSubjects, useUpdateProfile, useUser } from '../../lib/queries';
import { goalToInput, parseGoalInput, sumSubjectGoals } from '../../lib/subjects-format';
import { Button, Card, CardHeader } from '../ui';
import { GoalField } from './GoalField';
import { GoalSumWarning } from './GoalSumWarning';

const goalsSchema = updateProfileSchema.pick({ dailyGoalMinutes: true, weeklyGoalMinutes: true });
type GoalKey = 'dailyGoalMinutes' | 'weeklyGoalMinutes';
type Errors = Partial<Record<GoalKey, string>>;

/**
 * 讀書目標（GOAL-1）：每日與每週目標（分鐘），範圍與錯誤訊息照 GOAL_LIMITS／共用 schema，留空代表不設定（存成 null）。
 * 各科目標加總超過每週目標時提醒（GOAL-2，不阻擋）。
 */
export function GoalsCard() {
	const user = useUser();
	const update = useUpdateProfile();
	const { data: subjects = [] } = useSubjects();
	const dailyRef = useRef<HTMLInputElement>(null);
	const weeklyRef = useRef<HTMLInputElement>(null);
	const [daily, setDaily] = useState(goalToInput(user.dailyGoalMinutes));
	const [weekly, setWeekly] = useState(goalToInput(user.weeklyGoalMinutes));
	const [errors, setErrors] = useState<Errors>({});

	const values = { dailyGoalMinutes: parseGoalInput(daily), weeklyGoalMinutes: parseGoalInput(weekly) };
	const changed = values.dailyGoalMinutes !== user.dailyGoalMinutes || values.weeklyGoalMinutes !== user.weeklyGoalMinutes;
	const weeklyMinutes = typeof values.weeklyGoalMinutes === 'number' ? values.weeklyGoalMinutes : null;

	const edit = (key: GoalKey, set: (v: string) => void) => (v: string) => {
		set(v);
		setErrors((prev) => ({ ...prev, [key]: undefined }));
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const parsed = goalsSchema.safeParse(values);
		if (!parsed.success) {
			const next: Errors = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path[0];
				if (key === 'dailyGoalMinutes' || key === 'weeklyGoalMinutes') next[key] ??= issue.message;
			}
			setErrors(next);
			(next.dailyGoalMinutes ? dailyRef : weeklyRef).current?.focus();
			return;
		}
		setErrors({});
		update.mutate(
			{ dailyGoalMinutes: parsed.data.dailyGoalMinutes ?? null, weeklyGoalMinutes: parsed.data.weeklyGoalMinutes ?? null },
			{
				// 輸入框換成儲存後的標準寫法（例如全形數字、前面的 0）
				onSuccess: ({ user: saved }) => {
					setDaily(goalToInput(saved.dailyGoalMinutes));
					setWeekly(goalToInput(saved.weeklyGoalMinutes));
				},
			},
		);
	};

	return (
		<Card>
			<CardHeader title="讀書目標" />
			<form onSubmit={onSubmit} className="space-y-4 px-4 pb-5 sm:px-5" noValidate>
				<p className="text-sm text-ink-2">總覽會顯示今天與本週的進度，本週從週一起算。各科的每週目標在編輯科目時設定。</p>
				<div className="grid gap-4 sm:grid-cols-2">
					<GoalField
						label="每日目標"
						value={daily}
						onChange={edit('dailyGoalMinutes', setDaily)}
						error={errors.dailyGoalMinutes}
						limits={GOAL_LIMITS.daily}
						inputRef={dailyRef}
					/>
					<GoalField
						label="每週目標"
						value={weekly}
						onChange={edit('weeklyGoalMinutes', setWeekly)}
						error={errors.weeklyGoalMinutes}
						limits={GOAL_LIMITS.weekly}
						inputRef={weeklyRef}
					/>
				</div>
				<GoalSumWarning total={sumSubjectGoals(subjects)} weekly={weeklyMinutes} />
				<div className="flex justify-end">
					<Button type="submit" variant="primary" loading={update.isPending} disabled={!changed}>
						儲存
					</Button>
				</div>
			</form>
		</Card>
	);
}
