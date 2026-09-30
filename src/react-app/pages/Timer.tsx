import { ChevronLeft, ChevronRight, Coffee, Pause, Pencil, Play, Plus, RotateCcw, SkipForward, Square, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { StudySession } from '../../shared/api-types';
import { addDays, today as todayOf } from '../../shared/dates';
import { SessionDialog } from '../components/SessionDialog';
import { SubjectSelect, SubjectTag } from '../components/subjects';
import {
	Button,
	Card,
	CardHeader,
	cn,
	EmptyState,
	ErrorNote,
	Field,
	Input,
	PageLoader,
	Segmented,
	Select,
	Switch,
	useConfirm,
} from '../components/ui';
import { formatDuration, formatMinutes, MODE_LABEL } from '../lib/format';
import { useDeleteSession, useStudySessions, useSubjectMap, useTasks, useUser } from '../lib/queries';
import { formatClockRange, relativeDateLabel } from '../lib/timer-format';
import { useDeepLink } from '../lib/timer-queries';
import {
	breakMinutes,
	elapsedMs,
	LIMITS,
	optionError,
	roundInfo,
	targetMs,
	timer,
	useNow,
	useTimerState,
	type NumericOption,
	type TimerMode,
	type TimerState,
} from '../lib/timer';

/** 常用的分鐘數；也可以直接輸入 LIMITS 範圍內的任何整數 */
const PRESETS: Partial<Record<NumericOption, number[]>> = {
	focusMin: [15, 25, 45, 50],
	breakMin: [5, 10, 15],
	longBreakMin: [10, 15, 20, 30],
};

/**
 * 一個數字設定：常用值（Segmented）加上自訂輸入。
 * 輸入合法時立即套用；超出範圍時顯示錯誤，計時器繼續用上一個合法的值。
 */
function OptionField({ option, value }: { option: NumericOption; value: number }) {
	const { label, unit, min, max } = LIMITS[option];
	const presets = PRESETS[option];
	const [draft, setDraft] = useState(String(value));
	// 用常用值或其他分頁改了設定：輸入框跟著更新
	const [synced, setSynced] = useState(value);
	if (synced !== value) {
		setSynced(value);
		setDraft(String(value));
	}
	const error = optionError(option, draft);
	const commit = (v: number) => timer.setOptions({ [option]: v });

	return (
		<Field label={label} error={error}>
			{(id, aria) => (
				<div className="flex flex-wrap items-center gap-2">
					{presets && (
						<Segmented
							label={`${label}常用值`}
							value={String(value)}
							onChange={(v) => commit(Number(v))}
							options={presets.map((m) => ({ value: String(m), label: `${m}` }))}
						/>
					)}
					<div className="relative w-28">
						<Input
							id={id}
							{...aria}
							type="number"
							inputMode="numeric"
							min={min}
							max={max}
							step={1}
							value={draft}
							onChange={(e) => {
								setDraft(e.target.value);
								if (!optionError(option, e.target.value)) commit(Number(e.target.value));
							}}
							className="pr-12"
						/>
						<span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-meta text-ink-3" aria-hidden>
							{unit}
						</span>
					</div>
				</div>
			)}
		</Field>
	);
}

/** 番茄鐘設定：專注、短休息、長休息、長休息間隔、自動開始（TMR-1） */
function PomodoroSettings({ s }: { s: TimerState }) {
	const focusHint = useId();
	return (
		<section aria-labelledby="pomodoro-settings" className="mt-8 border-t border-line pt-6">
			<h2 id="pomodoro-settings" className="mb-4 text-h3 font-semibold">
				番茄鐘設定
			</h2>
			<div className="grid gap-5 sm:grid-cols-2">
				<OptionField option="focusMin" value={s.focusMin} />
				<OptionField option="breakMin" value={s.breakMin} />
				<OptionField option="longBreakMin" value={s.longBreakMin} />
				<OptionField option="longBreakEvery" value={s.longBreakEvery} />
			</div>
			<div className="mt-4 flex flex-col gap-1">
				<Switch checked={s.autoStartBreak} onChange={(autoStartBreak) => timer.setOptions({ autoStartBreak })} label="專注結束後自動開始休息" />
				<Switch
					checked={s.autoStartFocus}
					onChange={(autoStartFocus) => timer.setOptions({ autoStartFocus })}
					label="休息結束後自動開始下一輪專注"
					aria-describedby={focusHint}
				/>
				<p id={focusHint} className="text-meta text-ink-3">
					離開超過 1 分鐘（例如電腦睡眠）時不會自動開始，也不會補記不在時的番茄
				</p>
			</div>
		</section>
	);
}

/** 第 k／N 輪：這一組已完成的番茄用實心圓點，正在進行的那一輪用外框 */
function RoundDots({ s, today }: { s: TimerState; today: string }) {
	const { done, round, of, filled } = roundInfo(s, today);
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
			<span className="flex items-center gap-1.5" aria-hidden>
				{Array.from({ length: of }, (_, i) => (
					<span
						key={i}
						className={cn(
							'size-2.5 rounded-full',
							i < filled ? 'bg-accent' : i === round - 1 && s.phase !== 'break' ? 'ring-2 ring-accent ring-inset' : 'ring-1 ring-line-strong ring-inset',
						)}
					/>
				))}
			</span>
			<span>
				第 <span className="font-num tabular-nums">{round}</span>／<span className="font-num tabular-nums">{of}</span> 輪
			</span>
			<span className="text-ink-3">
				今天完成 <span className="font-num tabular-nums">{done}</span> 個番茄
			</span>
		</div>
	);
}

function Ring({ progress, phase, children }: { progress: number; phase: 'idle' | 'focus' | 'break'; children: React.ReactNode }) {
	const r = 120;
	const c = 2 * Math.PI * r;
	return (
		<div className="relative mx-auto aspect-square w-full max-w-[280px]">
			<svg viewBox="0 0 280 280" className="size-full -rotate-90" aria-hidden>
				<circle cx="140" cy="140" r={r} fill="none" stroke="var(--subtle)" strokeWidth="12" />
				<circle
					cx="140"
					cy="140"
					r={r}
					fill="none"
					stroke={phase === 'break' ? 'var(--success)' : 'var(--accent)'}
					strokeWidth="12"
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={c * (1 - Math.min(1, progress))}
					style={{ transition: 'stroke-dashoffset 0.3s linear' }}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
		</div>
	);
}

/**
 * 學習紀錄列表（TMR-2）：可以切換日期，每筆都能編輯（整列）與刪除。
 * 時間依 user.timezone 顯示。
 */
function SessionLog({
	date,
	today,
	onDateChange,
	onEdit,
	onCreate,
}: {
	date: string;
	today: string;
	onDateChange: (date: string) => void;
	onEdit: (session: StudySession) => void;
	onCreate: () => void;
}) {
	const user = useUser();
	const tz = user.timezone;
	const subjectMap = useSubjectMap();
	const { data: sessions, isPending, error } = useStudySessions({ from: date, to: date });
	const remove = useDeleteSession();
	const [confirm, confirmDialog] = useConfirm();
	const list = sessions ?? [];
	const total = list.reduce((sum, x) => sum + x.durationSec, 0) / 60;
	const dateLabel = relativeDateLabel(date, today);

	const onDelete = async (x: StudySession) => {
		const range = formatClockRange(x.startedAt, x.endedAt, tz);
		if (await confirm({ title: '刪除這筆學習紀錄？', message: `${dateLabel} ${range}，${formatMinutes(x.durationSec / 60)}。刪除後無法復原。` }))
			remove.mutate(x.id);
	};

	return (
		<Card className="self-start">
			<CardHeader
				title="學習紀錄"
				action={
					<Button size="sm" variant="ghost" onClick={onCreate}>
						<Plus className="size-4" aria-hidden />
						補登
					</Button>
				}
			/>
			<div className="flex items-center justify-between gap-2 px-4 pb-3 sm:px-5">
				<div className="flex items-center gap-0.5">
					<Button size="icon" variant="ghost" aria-label="前一天" onClick={() => onDateChange(addDays(date, -1))}>
						<ChevronLeft className="size-5" />
					</Button>
					<p className="min-w-24 text-center text-dense font-semibold" aria-live="polite">
						{dateLabel}
					</p>
					<Button size="icon" variant="ghost" aria-label="後一天" disabled={date >= today} onClick={() => onDateChange(addDays(date, 1))}>
						<ChevronRight className="size-5" />
					</Button>
				</div>
				{date !== today && (
					<Button size="sm" variant="ghost" onClick={() => onDateChange(today)}>
						回到今天
					</Button>
				)}
			</div>
			<div className="flex items-baseline gap-3 px-4 pb-3 sm:px-5">
				<span className="font-num text-num-lg font-semibold tabular-nums">{formatMinutes(total)}</span>
				<span className="text-meta text-ink-3">{list.length} 段學習</span>
			</div>
			{error ? (
				<div className="px-4 pb-4 sm:px-5">
					<ErrorNote error={error} />
				</div>
			) : isPending ? (
				<PageLoader />
			) : list.length === 0 ? (
				<EmptyState
					variant="inline"
					className="border-t border-line"
					title={date === today ? '今天還沒有紀錄' : '這天沒有學習紀錄'}
					description={date === today ? '完成的專注時間會自動記錄在這裡' : '忘了計時可以補登'}
					action={
						date !== today && (
							<Button size="sm" variant="ghost" onClick={onCreate}>
								補登
							</Button>
						)
					}
				/>
			) : (
				<ul className="divide-y divide-line border-t border-line">
					{list.map((x) => {
						const range = formatClockRange(x.startedAt, x.endedAt, tz);
						const subject = x.subjectId ? subjectMap.get(x.subjectId)?.name : undefined;
						const minutes = formatMinutes(x.durationSec / 60);
						return (
							<li key={x.id} className="flex items-center pr-2 sm:pr-3">
								<button
									type="button"
									onClick={() => onEdit(x)}
									aria-label={`編輯紀錄：${range}，${MODE_LABEL[x.mode]}，${subject ?? '未分類'}，${minutes}`}
									className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 pl-4 text-left transition-colors duration-120 ease-out hover:bg-subtle sm:pl-5"
								>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-baseline gap-x-2 text-sm">
											<span className="font-num font-semibold tabular-nums">{range}</span>
											<span className="text-meta text-ink-3">{MODE_LABEL[x.mode]}</span>
										</span>
										<span className="mt-1 flex min-w-0 items-center gap-2">
											{subject ? <SubjectTag subjectId={x.subjectId} /> : <span className="text-meta text-ink-3">未分類</span>}
											{x.note && <span className="truncate text-meta text-ink-3">{x.note}</span>}
										</span>
									</span>
									<span className="shrink-0 font-num text-sm text-ink-2 tabular-nums">{minutes}</span>
									<Pencil className="size-4 shrink-0 text-ink-3" aria-hidden />
								</button>
								<Button size="icon" variant="ghost" aria-label={`刪除 ${range} 的紀錄`} onClick={() => onDelete(x)}>
									<Trash2 className="size-4" />
								</Button>
							</li>
						);
					})}
				</ul>
			)}
			{confirmDialog}
		</Card>
	);
}

export function TimerPage() {
	const user = useUser();
	const s = useTimerState();
	const now = useNow(s.running);
	const today = todayOf(user.timezone);
	const { data: tasks = [] } = useTasks();
	const [confirm, confirmDialog] = useConfirm();
	const [logDate, setLogDate] = useState(today);
	const [dialog, setDialog] = useState<{ session?: StudySession } | null>(null);

	// 深連結：?new=1 開啟補登、?date=YYYY-MM-DD 切換紀錄日期、?open=<id> 開啟那天的某筆紀錄
	const link = useDeepLink(['new', 'open', 'date']);
	const [seenLink, setSeenLink] = useState(0);
	const [pendingOpen, setPendingOpen] = useState<string | null>(null);
	if (link.seq !== seenLink) {
		setSeenLink(link.seq);
		const d = link.values.date;
		if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today) setLogDate(d);
		if (link.values.new === '1') setDialog({});
		if (link.values.open) setPendingOpen(link.values.open);
	}
	const { data: logSessions } = useStudySessions({ from: logDate, to: logDate });
	if (pendingOpen && logSessions) {
		setPendingOpen(null);
		const found = logSessions.find((x) => x.id === pendingOpen);
		if (found) setDialog({ session: found });
	}

	const active = s.phase !== 'idle';
	const target = targetMs(s);
	const el = active ? elapsedMs(s, now) : 0;
	const display = s.mode === 'pomodoro' ? Math.max(0, (target ?? 0) - el) : el;
	const progress = s.mode === 'pomodoro' && target ? el / target : (el % 3_600_000) / 3_600_000;
	const isBreak = s.phase === 'break';
	const breakName = s.breakKind === 'long' ? '長休息' : '短休息';
	const waitingBreak = isBreak && !s.running;
	const openTasks = tasks.filter((t) => t.status !== 'done' && (!s.subjectId || t.subjectId === s.subjectId));

	const finish = () => {
		if (!timer.finish()) toast('不到 1 分鐘，這次就不記錄了');
	};
	const discard = async () => {
		if (el > 60_000 && !(await confirm({ title: '放棄這次計時？', message: '已經計時的時間不會被記錄。', confirmText: '放棄' }))) return;
		timer.discard();
	};

	return (
		<div>
			<div className="grid gap-5 lg:grid-cols-[1fr_360px]">
				<Card className="p-5 sm:p-8">
					<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
						<Segmented<TimerMode>
							label="計時模式"
							value={s.mode}
							onChange={(mode) => !active && timer.configure({ mode })}
							options={[
								{ value: 'pomodoro', label: '番茄鐘' },
								{ value: 'stopwatch', label: '碼錶' },
							]}
						/>
						{s.mode === 'pomodoro' && <RoundDots s={s} today={today} />}
					</div>

					<div className="mb-6 grid gap-3 sm:grid-cols-2">
						<Field label="科目">
							{(id) => <SubjectSelect id={id} value={s.subjectId} onChange={(subjectId) => timer.configure({ subjectId, taskId: null })} />}
						</Field>
						<Field label="正在進行的任務">
							{(id) => (
								<Select id={id} value={s.taskId ?? ''} onChange={(e) => timer.configure({ taskId: e.target.value || null })}>
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

					<Ring progress={active ? progress : 0} phase={s.phase}>
						<span className={cn('text-sm font-medium', s.phase === 'break' ? 'text-success' : 'text-ink-2')}>
							{s.phase === 'idle'
								? s.mode === 'pomodoro'
									? '準備專注'
									: '碼錶'
								: isBreak
									? waitingBreak
										? `準備${breakName}`
										: breakName
									: s.running
										? '專注中'
										: '已暫停'}
						</span>
						<span className="mt-1 text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl" aria-live="off">
							{formatDuration((active ? display : s.mode === 'pomodoro' ? s.focusMin * 60_000 : 0) / 1000)}
						</span>
						{s.mode === 'pomodoro' && s.phase !== 'idle' && (
							<span className="mt-1 text-xs text-ink-3">
								{s.phase === 'focus' ? `共 ${s.focusMin} 分鐘` : `${breakName} ${breakMinutes(s)} 分鐘`}
							</span>
						)}
					</Ring>

					<div className="mt-8 flex flex-wrap justify-center gap-3">
						{!active && (
							<Button variant="primary" className="h-12 min-w-40 text-base" onClick={timer.start}>
								<Play className="size-5" aria-hidden />
								開始{s.mode === 'pomodoro' ? '專注' : '計時'}
							</Button>
						)}
						{s.phase === 'focus' && (
							<>
								{s.running ? (
									<Button className="h-12 min-w-28 text-base" onClick={timer.pause}>
										<Pause className="size-5" aria-hidden />
										暫停
									</Button>
								) : (
									<Button variant="primary" className="h-12 min-w-28 text-base" onClick={timer.resume}>
										<Play className="size-5" aria-hidden />
										繼續
									</Button>
								)}
								<Button className="h-12 text-base" onClick={finish}>
									<Square className="size-4" aria-hidden />
									結束並儲存
								</Button>
								<Button variant="ghost" className="h-12" onClick={discard}>
									<RotateCcw className="size-4" aria-hidden />
									放棄
								</Button>
							</>
						)}
						{waitingBreak && (
							<Button variant="primary" className="h-12 min-w-40 text-base" onClick={timer.resume}>
								<Play className="size-5" aria-hidden />
								開始{breakName}
							</Button>
						)}
						{isBreak && (
							<Button className="h-12 text-base" onClick={timer.skipBreak}>
								<SkipForward className="size-5" aria-hidden />
								跳過休息
							</Button>
						)}
					</div>

					{s.mode === 'pomodoro' && !active && <PomodoroSettings s={s} />}
					{isBreak && (
						<p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-2">
							<Coffee className="size-4" aria-hidden />
							站起來走走、喝杯水，讓眼睛休息一下
						</p>
					)}
				</Card>

				<SessionLog
					date={logDate}
					today={today}
					onDateChange={setLogDate}
					onEdit={(session) => setDialog({ session })}
					onCreate={() => setDialog({})}
				/>
			</div>
			<SessionDialog open={!!dialog} session={dialog?.session} defaultDate={logDate} onClose={() => setDialog(null)} />
			{confirmDialog}
		</div>
	);
}
