import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { GOAL_LIMITS, updateProfileSchema } from '../../../shared/schemas';
import { useSubjects, useUpdateProfile, useUser } from '../../lib/queries';
import { fieldErrors, useFieldErrors } from '../../lib/form-errors';
import { goalToInput, parseGoalInput, sumSubjectGoals } from '../../lib/goals';
import { Button, Card, CardHeader } from '../ui';
import { GoalField } from './GoalField';
import { GoalSumWarning } from './GoalSumWarning';

const goalsSchema = updateProfileSchema.pick({ dailyGoalMinutes: true, weeklyGoalMinutes: true });
const GOAL_FIELDS = ['dailyGoalMinutes', 'weeklyGoalMinutes'] as const;
type GoalKey = (typeof GOAL_FIELDS)[number];

/** 設定頁的錨點：總覽、統計頁的「設定目標」連到 /settings#goals */
const ANCHOR = 'goals';

/**
 * 讀書目標（GOAL-1）：每日與每週目標（分鐘），範圍與錯誤訊息照 GOAL_LIMITS／共用 schema，留空代表不設定（存成 null）。
 * 各科目標加總超過每週目標時提醒（GOAL-2，不阻擋）。
 */
export function GoalsCard() {
	const user = useUser();
	const update = useUpdateProfile('已更新讀書目標');
	const { data: subjects = [], isPending: subjectsPending } = useSubjects();

	// 帶著 #goals 進來：捲到這張卡片，焦點移到標題（鍵盤與螢幕報讀器從這裡接著往下）。
	// - 等上面的科目卡載入完再捲，位置才不會被後來長出來的科目列表推走。
	// - 用 requestAnimationFrame 排到這次畫面更新之後：Layout 換頁時會捲回頂端（它的 effect 比這裡晚跑），不這樣會被蓋掉。
	// - 上一頁／下一頁回到這裡時不捲，交給瀏覽器還原位置（和 Layout 的規則一致）；重新整理（第一筆紀錄）照樣捲。
	const { hash, key } = useLocation();
	const navType = useNavigationType();
	const anchorRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLSpanElement>(null);
	const linked = hash === `#${ANCHOR}` && !(navType === 'POP' && key !== 'default');
	useEffect(() => {
		if (!linked || subjectsPending) return;
		const frame = requestAnimationFrame(() => {
			anchorRef.current?.scrollIntoView({ block: 'start' });
			titleRef.current?.focus({ preventScroll: true });
		});
		return () => cancelAnimationFrame(frame);
	}, [linked, key, subjectsPending]);
	const [daily, setDaily] = useState(goalToInput(user.dailyGoalMinutes));
	const [weekly, setWeekly] = useState(goalToInput(user.weeklyGoalMinutes));
	const fields = useFieldErrors(GOAL_FIELDS);

	const values = { dailyGoalMinutes: parseGoalInput(daily), weeklyGoalMinutes: parseGoalInput(weekly) };
	const changed = values.dailyGoalMinutes !== user.dailyGoalMinutes || values.weeklyGoalMinutes !== user.weeklyGoalMinutes;
	const weeklyMinutes = typeof values.weeklyGoalMinutes === 'number' ? values.weeklyGoalMinutes : null;

	const edit = (key: GoalKey, set: (v: string) => void) => (v: string) => {
		set(v);
		fields.clear(key);
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const parsed = goalsSchema.safeParse(values);
		if (!parsed.success) return fields.show(fieldErrors(parsed.error.issues, GOAL_FIELDS));
		fields.show({});
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
		// scroll-mt：頁首是 sticky（56px＋safe-area），再留 16px，卡片才不會貼在頁首下面
		<div id={ANCHOR} ref={anchorRef} className="scroll-mt-[calc(4.5rem+env(safe-area-inset-top))]">
			<Card>
				<CardHeader
					title={
						<span ref={titleRef} tabIndex={-1} className="rounded-sm">
							讀書目標
						</span>
					}
				/>
				<form onSubmit={onSubmit} className="space-y-4 px-4 pb-5 sm:px-5" noValidate>
					<p className="text-sm text-ink-2">總覽會顯示今天與本週的進度，本週從週一起算。各科的每週目標在編輯科目時設定。</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<GoalField
							label="每日目標"
							value={daily}
							onChange={edit('dailyGoalMinutes', setDaily)}
							error={fields.errors.dailyGoalMinutes}
							limits={GOAL_LIMITS.daily}
							inputRef={fields.bind('dailyGoalMinutes')}
						/>
						<GoalField
							label="每週目標"
							value={weekly}
							onChange={edit('weeklyGoalMinutes', setWeekly)}
							error={fields.errors.weeklyGoalMinutes}
							limits={GOAL_LIMITS.weekly}
							inputRef={fields.bind('weeklyGoalMinutes')}
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
		</div>
	);
}
