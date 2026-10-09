import { useState, type FormEvent } from 'react';
import { REVIEW_INTERVALS, updateProfileSchema } from '../../../shared/schemas';
import { useUpdateProfile, useUser } from '../../lib/account-queries';
import { fromIntervalChoice, toIntervalChoice } from '../../lib/mastered-review';
import { MasteredReviewField } from '../MasteredReviewField';
import { Button, Card, CardHeader } from '../ui';

const schema = updateProfileSchema.pick({ masteredReviewDays: true });
/** 設定頁的預設：不提醒（null）或每 N 天 */
const SPECIAL = { none: null };
const SPECIAL_OPTIONS = [{ key: 'none', label: '不提醒' }] as const;

/** 錯題複習：已掌握的題目預設要不要繼續定期複習、幾天一次（個別題目可以在編輯時另外設定） */
export function MasteredReviewCard() {
	const user = useUser();
	const update = useUpdateProfile('已更新錯題複習的設定');
	const [choice, setChoice] = useState(() => toIntervalChoice(user.masteredReviewDays, SPECIAL));
	const [error, setError] = useState<string>();
	const value = fromIntervalChoice(choice, SPECIAL);

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const parsed = schema.safeParse({ masteredReviewDays: value });
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		setError(undefined);
		update.mutate({ masteredReviewDays: parsed.data.masteredReviewDays ?? null });
	};

	return (
		<Card>
			<CardHeader title="錯題複習" />
			<form onSubmit={onSubmit} className="space-y-4 px-4 pb-5 sm:px-5" noValidate>
				<p className="text-sm text-ink-2">
					錯題會在第 {REVIEW_INTERVALS.join('、')}{' '}
					天提醒複習，都記得就算已掌握、不再提醒。想要久久再複習一次，可以在這裡設定；個別題目也能在編輯時另外設定。
				</p>
				<MasteredReviewField
					label="已掌握的錯題"
					specialOptions={SPECIAL_OPTIONS}
					value={choice}
					onChange={(next) => {
						setChoice(next);
						setError(undefined);
					}}
					error={error}
				/>
				<div className="flex justify-end">
					<Button type="submit" variant="primary" loading={update.isPending} disabled={value === user.masteredReviewDays}>
						儲存
					</Button>
				</div>
			</form>
		</Card>
	);
}
