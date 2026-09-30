import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Subject } from '../../../shared/api-types';
import { GOAL_LIMITS, subjectSchema, type SubjectIcon } from '../../../shared/schemas';
import { ApiError } from '../../lib/api';
import { useCreateSubject, useDeleteSubject, useUpdateSubject, useUser, type SubjectInput } from '../../lib/queries';
import { nextSubjectColor, useSubjectTone } from '../../lib/subject-color';
import { isSubjectIcon, subjectIcon } from '../../lib/subject-icons';
import { goalToInput, parseGoalInput, sumSubjectGoals } from '../../lib/subjects-format';
import { ColorPicker } from '../ColorPicker';
import { DialogFooter } from '../forms/shared';
import { Dialog, Field, Input, Switch, useConfirm } from '../ui';
import { GoalField } from './GoalField';
import { GoalSumWarning } from './GoalSumWarning';
import { IconPicker } from './IconPicker';

type FormErrors = { name?: string; weeklyGoalMinutes?: string };

/** 驗證錯誤依欄位分開，每個欄位只顯示第一則 */
function fieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FormErrors {
	const out: FormErrors = {};
	for (const issue of issues) {
		const key = issue.path[0];
		if (key === 'name') out.name ??= issue.message;
		if (key === 'weeklyGoalMinutes') out.weeklyGoalMinutes ??= issue.message;
	}
	return out;
}

function SubjectForm({
	formId,
	subject,
	subjects,
	onSave,
}: {
	formId: string;
	subject?: Subject;
	subjects: readonly Subject[];
	/** 失敗時 reject（錯誤已由 toast 顯示；同名科目另外顯示在名稱欄位） */
	onSave: (input: SubjectInput, archived?: boolean) => Promise<void>;
}) {
	const user = useUser();
	const toneOf = useSubjectTone();
	const nameRef = useRef<HTMLInputElement>(null);
	const goalRef = useRef<HTMLInputElement>(null);
	const iconLabelId = useId();
	const colorLabelId = useId();
	const archiveHintId = useId();
	const [name, setName] = useState(subject?.name ?? '');
	const [icon, setIcon] = useState<SubjectIcon | null>(subject && isSubjectIcon(subject.icon) ? subject.icon : null);
	// 新科目沒選顏色時，自動用下一個還沒用過的推薦色
	const [picked, setPicked] = useState<string | null>(subject?.color ?? null);
	const color = picked ?? nextSubjectColor(subjects.map((s) => s.color));
	const [archived, setArchived] = useState(subject?.archived ?? false);
	// 每週目標（GOAL-2）：留空代表不設定
	const [goal, setGoal] = useState(goalToInput(subject?.weeklyGoalMinutes));
	const [errors, setErrors] = useState<FormErrors>({});

	const goalValue = parseGoalInput(goal);
	const goalMinutes = typeof goalValue === 'number' && Number.isInteger(goalValue) && goalValue > 0 ? goalValue : null;
	// 加總只在這一科有目標、而且沒有封存時才提醒（封存的科目不列入各科目標）
	const goalTotal = goalMinutes && !archived ? sumSubjectGoals(subjects, subject?.id) + goalMinutes : 0;

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		const parsed = subjectSchema.safeParse({ name, color, icon, weeklyGoalMinutes: goalValue });
		if (!parsed.success) {
			const next = fieldErrors(parsed.error.issues);
			setErrors(next);
			if (next.name) nameRef.current?.focus();
			else if (next.weeklyGoalMinutes) goalRef.current?.focus();
			return;
		}
		setErrors({});
		try {
			await onSave(parsed.data, subject ? archived : undefined);
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				setErrors({ name: err.message });
				nameRef.current?.focus();
			}
		}
	};

	return (
		<form id={formId} onSubmit={onSubmit} className="space-y-5" noValidate>
			<Field label="名稱" error={errors.name}>
				{(id, aria) => (
					<Input
						ref={nameRef}
						id={id}
						{...aria}
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							setErrors((prev) => ({ ...prev, name: undefined }));
						}}
						maxLength={30}
						placeholder="例如：計算機網路"
						autoComplete="off"
						autoFocus
					/>
				)}
			</Field>

			<div className="space-y-2">
				<GoalField
					label="每週目標"
					value={goal}
					onChange={(v) => {
						setGoal(v);
						setErrors((prev) => ({ ...prev, weeklyGoalMinutes: undefined }));
					}}
					error={errors.weeklyGoalMinutes}
					limits={GOAL_LIMITS.subjectWeekly}
					inputRef={goalRef}
				/>
				<GoalSumWarning total={goalTotal} weekly={user.weeklyGoalMinutes} />
			</div>

			<div className="space-y-2">
				<div className="flex items-baseline gap-2">
					<p id={iconLabelId} className="text-sm font-semibold text-ink-2">
						圖示
					</p>
					<span className="text-meta text-ink-3">{subjectIcon(icon)?.label ?? '不使用'}</span>
				</div>
				<IconPicker value={icon} onChange={setIcon} tone={toneOf(color)} labelledBy={iconLabelId} />
			</div>

			<div role="group" aria-labelledby={colorLabelId} className="space-y-2">
				<p id={colorLabelId} className="text-sm font-semibold text-ink-2">
					顏色
				</p>
				<ColorPicker value={color} onChange={setPicked} subjects={subjects} selfId={subject?.id} name={name} icon={icon} />
			</div>

			{subject && (
				<div className="space-y-1 border-t border-line pt-4">
					<Switch checked={archived} onChange={setArchived} label="封存這個科目" aria-describedby={archiveHintId} />
					<p id={archiveHintId} className="text-meta text-ink-3">
						上完的課程可以封存：不會出現在選單中，考試、任務、筆記與學習紀錄都會保留。
					</p>
				</div>
			)}
		</form>
	);
}

/**
 * 新增或編輯科目（SUB-2）：名稱、圖示、顏色；編輯時可以封存或刪除。
 * 設定頁的科目卡與單科總覽頁共用。內容在關閉時卸載，每次打開都從目前儲存的值開始。
 */
export function SubjectDialog({
	open,
	onClose,
	subject,
	subjects,
	onDeleted,
}: {
	open: boolean;
	onClose: () => void;
	/** 省略代表新增 */
	subject?: Subject;
	/** 本人全部的科目，依列表順序（選色器的提醒、相鄰科目與預設色都要用） */
	subjects: readonly Subject[];
	/** 刪除成功後呼叫（例如單科總覽頁要離開這一頁） */
	onDeleted?: () => void;
}) {
	const create = useCreateSubject();
	const update = useUpdateSubject();
	const remove = useDeleteSubject();
	const [confirm, confirmDialog] = useConfirm();
	const formId = useId();

	const onSave = async (input: SubjectInput, archived?: boolean) => {
		if (subject) {
			await update.mutateAsync({ id: subject.id, ...input, ...(archived !== undefined && { archived }) });
			toast.success('已更新科目');
		} else {
			await create.mutateAsync(input);
		}
		onClose();
	};

	const onDelete = async () => {
		if (!subject) return;
		const ok = await confirm({
			title: `刪除科目「${subject.name}」？`,
			message: '相關的考試、任務、筆記與學習紀錄都會保留，只是不再屬於任何科目。若只是課程結束，建議改用封存。',
		});
		if (!ok) return;
		try {
			await remove.mutateAsync(subject.id);
		} catch {
			return; // 錯誤訊息已由 toast 顯示
		}
		onClose();
		onDeleted?.();
	};

	return (
		<>
			<Dialog
				open={open}
				onClose={onClose}
				title={subject ? '編輯科目' : '新增科目'}
				footer={
					<DialogFooter formId={formId} onClose={onClose} onDelete={subject && onDelete} saving={create.isPending || update.isPending} />
				}
			>
				<SubjectForm key={subject?.id ?? 'new'} formId={formId} subject={subject} subjects={subjects} onSave={onSave} />
			</Dialog>
			{confirmDialog}
		</>
	);
}
