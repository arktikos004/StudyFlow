import { useNavigate } from 'react-router';
import type { Task } from '../../../shared/api-types';
import { useSubjectMap } from '../../lib/queries';
import { useSubjectColor } from '../../lib/subject-color';
import { timer, useTimerState } from '../../lib/timer';
import { useConfirm } from '../ui';

/** 回傳 (subjectId) => 科目色（subjectTone 的 mark）；沒有科目時回傳 undefined，進度條改用主題色 */
export function useSubjectMark() {
	const subjects = useSubjectMap();
	const colorOf = useSubjectColor();
	return (subjectId: string | null | undefined) => {
		const s = subjectId ? subjects.get(subjectId) : undefined;
		return s ? colorOf(s.color) : undefined;
	};
}

/**
 * 一鍵專注（DASH-1）：帶入任務與科目、開始番茄鐘並前往計時頁。
 * - 正在計時另一件事：先詢問，確認後才結束並儲存目前的計時（timer.finish），不會直接覆蓋。
 * - 正在計時的就是這個任務：直接回到計時頁，不重新開始。
 * 只使用 lib/timer.ts 凍結的 API：configure、start、finish、useTimerState。
 * 回傳 [開始的函式, 確認對話框（請渲染在頁面上）, 目前計時中的任務 id]。
 */
export function useFocusTask() {
	const navigate = useNavigate();
	const state = useTimerState();
	const [confirm, confirmDialog] = useConfirm();
	const active = state.phase !== 'idle';
	const activeTaskId = active ? state.taskId : null;

	const start = async (task: Pick<Task, 'id' | 'title' | 'subjectId'>) => {
		if (active && state.taskId === task.id) {
			navigate('/timer');
			return;
		}
		if (active) {
			const ok = await confirm({
				title: '要切換成這個任務嗎？',
				message:
					state.phase === 'break'
						? `目前的休息會結束，接著開始專注「${task.title}」。`
						: `目前的計時會結束並儲存，接著開始專注「${task.title}」。`,
				confirmText: '切換任務',
			});
			if (!ok) return;
			timer.finish();
		}
		timer.configure({ mode: 'pomodoro', subjectId: task.subjectId, taskId: task.id });
		timer.start();
		navigate('/timer');
	};

	return [start, confirmDialog, activeTaskId] as const;
}
