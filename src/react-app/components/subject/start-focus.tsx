import { Play, Timer } from 'lucide-react';
import { useNavigate } from 'react-router';
import { timer, useTimerState } from '../../lib/timer';
import { Button, ButtonLink } from '../ui';

/**
 * 開始專注：沒有計時的時候，帶入這一科開始番茄鐘並前往計時頁；
 * 已經在計時（含暫停、休息）就只前往計時頁，不會覆蓋目前的計時。
 */
export function StartFocusButton({ subjectId }: { subjectId: string }) {
	const state = useTimerState();
	const navigate = useNavigate();
	if (state.phase !== 'idle')
		return (
			<ButtonLink to="/timer" variant="primary">
				<Timer className="size-4" aria-hidden />
				前往計時
			</ButtonLink>
		);
	return (
		<Button
			variant="primary"
			onClick={() => {
				timer.configure({ mode: 'pomodoro', subjectId, taskId: null });
				timer.start();
				navigate('/timer');
			}}
		>
			<Play className="size-4" aria-hidden />
			開始專注
		</Button>
	);
}
