import { useState } from 'react';
import { toast } from 'sonner';
import type { StudySession } from '../../shared/api-types';
import { today as todayOf } from '../../shared/dates';
import { SessionDialog } from '../components/SessionDialog';
import { SubjectSelect } from '../components/subjects';
import { NoiseControls } from '../components/timer/NoiseControls';
import { PomodoroSettings } from '../components/timer/PomodoroSettings';
import { RoundDots } from '../components/timer/RoundDots';
import { SessionLog } from '../components/timer/SessionLog';
import { TimerControls } from '../components/timer/TimerControls';
import { TimerDial } from '../components/timer/TimerDial';
import { cn, ErrorNote, Field, PageHeader, Segmented, Select, useConfirm } from '../components/ui';
import { isDateParam, useDeepLink, useOpenDeepLink } from '../lib/deep-link';
import { useStudySessions, useSubjectMap, useTasks, useUser } from '../lib/queries';
import { useSubjectTone } from '../lib/subject-color';
import { elapsedMs, MIN_RECORD_MS, roundInfo, timer, useNow, useTimerState, type TimerMode } from '../lib/timer';
import { todaySummary } from '../lib/timer-display';

export function TimerPage() {
	const user = useUser();
	const s = useTimerState();
	const now = useNow(s.running);
	const today = todayOf(user.timezone);
	const subjectMap = useSubjectMap();
	const toneOf = useSubjectTone();
	const tasksQuery = useTasks();
	const todayQuery = useStudySessions({ from: today, to: today });
	const tasks = tasksQuery.data ?? [];
	const todaySessions = todayQuery.data ?? [];
	// 今天的紀錄或任務載入失敗：頁首摘要不能說「今天還沒有學習紀錄」，任務選單也會是空的，所以在上方說明並提供重新載入
	const failed = [todayQuery, tasksQuery].filter((q) => q.error);
	const [confirm, confirmDialog] = useConfirm();
	const [logDate, setLogDate] = useState(today);
	const [dialog, setDialog] = useState<{ session?: StudySession } | null>(null);

	// 深連結：?new=1 開啟補登、?date=YYYY-MM-DD 切換紀錄日期、?open=<id> 開啟那天的某筆紀錄
	const [openId, setOpenId] = useState<string | null>(null);
	useDeepLink(['new', 'open', 'date'], ({ new: isNew, open, date }) => {
		if (isDateParam(date) && date <= today) setLogDate(date);
		if (isNew === '1') setDialog({});
		if (open) setOpenId(open);
	});
	const { data: logSessions, isFetching: logFetching } = useStudySessions({ from: logDate, to: logDate });
	useOpenDeepLink(openId, {
		items: logSessions,
		isFetching: logFetching,
		onFound: (session) => setDialog({ session }),
		onMissing: () => toast.error('找不到這筆紀錄', { description: '可能已經刪除，或不在這一天的紀錄裡' }),
		onSettled: () => setOpenId(null),
	});

	const pomodoro = s.mode === 'pomodoro';
	const active = s.phase !== 'idle';
	const showSettings = pomodoro && !active;
	const subject = s.subjectId ? subjectMap.get(s.subjectId) : undefined;
	const todayMinutes = todaySessions.reduce((sum, x) => sum + x.durationSec, 0) / 60;
	const openTasks = tasks.filter((t) => t.id === s.taskId || (t.status !== 'done' && (!s.subjectId || t.subjectId === s.subjectId)));

	const finish = () => {
		if (!timer.finish()) toast('不到 1 分鐘，這次就不記錄了');
	};
	const discard = async () => {
		// 不到 1 分鐘的計時本來就不會記錄，直接放棄
		const recordable = elapsedMs(s, now) > MIN_RECORD_MS;
		if (recordable && !(await confirm({ title: '放棄這次計時？', message: '已經計時的時間不會被記錄。', confirmText: '放棄' }))) return;
		timer.discard();
	};

	return (
		<div>
			<PageHeader title="學習計時" description={todayQuery.error ? undefined : todaySummary(todayMinutes, roundInfo(s, today).done)} />
			{failed.length > 0 && (
				<div className="mb-section">
					<ErrorNote
						error={failed[0].error}
						onRetry={() => failed.forEach((q) => void q.refetch())}
						retrying={failed.some((q) => q.isRefetching)}
					/>
				</div>
			)}
			{/*
			 * 桌面：左欄是計時器與番茄鐘設定，右欄是學習紀錄（跨兩列）。
			 * - 第一列 auto、第二列 1fr：學習紀錄比左欄高時，多出來的高度只給第二列，計時器與設定之間不會被撐出空白（review A2）。
			 * - DOM 順序就是手機上的順序：計時器 → 學習紀錄 → 番茄鐘設定（紀錄比調整設定常用），不用 order 重排，
			 *   螢幕報讀器與 Tab 的順序和畫面一致；桌面上是由左而右、由上而下（計時器 → 右邊的紀錄 → 左下的設定）。
			 */}
			<div className={cn('grid grid-cols-1 gap-section lg:grid-cols-[minmax(0,1fr)_22rem]', showSettings && 'lg:grid-rows-[auto_1fr]')}>
				{/* 專注空間：沒有卡片外框，只有計時環與操作 */}
				<section aria-label="計時器" className="flex min-w-0 flex-col items-center gap-6 lg:col-start-1 lg:row-start-1">
					<Segmented<TimerMode>
						label="計時模式"
						value={s.mode}
						onChange={(mode) => timer.configure({ mode })}
						options={[
							{ value: 'pomodoro', label: '番茄鐘', disabled: active && !pomodoro },
							{ value: 'stopwatch', label: '碼錶', disabled: active && pomodoro },
						]}
					/>

					<TimerDial s={s} now={now} today={today} subjectColor={subject && toneOf(subject.color).mark} />

					{pomodoro && <RoundDots s={s} today={today} />}

					<TimerControls s={s} onFinish={finish} onDiscard={discard} />

					<div className="grid w-full max-w-xl gap-4 sm:grid-cols-2">
						<Field label="科目">
							{(id) => <SubjectSelect id={id} value={s.subjectId} onChange={(subjectId) => timer.configure({ subjectId, taskId: null })} />}
						</Field>
						<Field label="任務（選填）">
							{(id, aria) => (
								<Select id={id} {...aria} value={s.taskId ?? ''} onChange={(e) => timer.configure({ taskId: e.target.value || null })}>
									<option value="">不指定</option>
									{openTasks.map((t) => (
										<option key={t.id} value={t.id}>
											{t.title}
										</option>
									))}
								</Select>
							)}
						</Field>
					</div>

					<NoiseControls focusRunning={s.phase === 'focus' && s.running} />
				</section>

				<SessionLog
					date={logDate}
					today={today}
					onDateChange={setLogDate}
					onEdit={(session) => setDialog({ session })}
					onCreate={() => setDialog({})}
					errorShownAbove={!!todayQuery.error}
					className={cn('lg:col-start-2 lg:row-start-1', showSettings && 'lg:row-span-2')}
				/>

				{showSettings && <PomodoroSettings s={s} className="self-start justify-self-center lg:col-start-1 lg:row-start-2" />}
			</div>
			<SessionDialog open={!!dialog} session={dialog?.session} defaultDate={logDate} onClose={() => setDialog(null)} />
			{confirmDialog}
		</div>
	);
}
