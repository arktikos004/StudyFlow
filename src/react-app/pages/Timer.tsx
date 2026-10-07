import {
	ChevronLeft,
	ChevronRight,
	Coffee,
	Pause,
	Pencil,
	Play,
	Plus,
	RotateCcw,
	SkipForward,
	SlidersHorizontal,
	Square,
	Timer as TimerIcon,
	Trash2,
	Volume1,
	Volume2,
	VolumeX,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
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
	PageHeader,
	PageLoader,
	ProgressRing,
	Segmented,
	Select,
	Switch,
	useConfirm,
} from '../components/ui';
import { formatDuration, formatMinutes } from '../lib/format';
import { STUDY_MODE_LABEL } from '../../shared/labels';
import { useDeleteSession, useStudySessions, useSubjectMap, useTasks, useUser } from '../lib/queries';
import { NOISE_LABEL, setNoisePrefs, useNoisePrefs, type NoiseKind, type NoisePrefs } from '../lib/noise';
import { useSubjectTone } from '../lib/subject-color';
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
import { formatClockRange, relativeDateLabel } from '../lib/timer-format';
import { useDeepLink } from '../lib/timer-queries';

/** 常用的分鐘數；也可以直接輸入 LIMITS 範圍內的任何整數 */
const PRESETS: Partial<Record<NumericOption, number[]>> = {
	focusMin: [15, 25, 45, 50],
	breakMin: [5, 10, 15],
	longBreakMin: [10, 15, 20, 30],
};

// ---- 番茄鐘設定（TMR-1） ----

/**
 * 一個數字設定：常用值（Segmented）加上自訂輸入。
 * 輸入合法時立即套用；超出範圍時顯示錯誤，計時器繼續用上一個合法的值。
 */
function OptionField({ option, value, hint }: { option: NumericOption; value: number; hint?: string }) {
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
		<Field
			label={label}
			error={error}
			hint={hint}
			className="sm:grid sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-4 sm:[&>p]:col-start-2"
		>
			{(id, aria) => (
				<div className="flex flex-wrap items-center gap-2">
					{presets && (
						<Segmented
							label={`${label}常用值（${unit}）`}
							value={String(value)}
							onChange={(v) => commit(Number(v))}
							options={presets.map((m) => ({ value: String(m), label: <span className="font-num tabular-nums">{m}</span> }))}
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

/** 番茄鐘設定：平常只顯示一行摘要，按「調整」展開（專注空間保持安靜） */
function PomodoroSettings({ s, className }: { s: TimerState; className?: string }) {
	const [open, setOpen] = useState(false);
	const id = useId();
	return (
		<section aria-labelledby={`${id}-title`} className={cn('w-full max-w-xl border-t border-line pt-5', className)}>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<h2 id={`${id}-title`} className="text-h2 font-semibold">
						番茄鐘設定
					</h2>
					<p className="text-meta text-pretty text-ink-3">
						專注 {s.focusMin} 分，短休息 {s.breakMin} 分，每 {s.longBreakEvery} 輪長休息 {s.longBreakMin} 分
					</p>
				</div>
				<Button variant="ghost" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}>
					<SlidersHorizontal className="size-4" aria-hidden />
					{open ? '收起' : '調整'}
				</Button>
			</div>
			<div id={`${id}-panel`} hidden={!open} className="mt-5">
				<div className="flex flex-col gap-5">
					<OptionField option="focusMin" value={s.focusMin} />
					<OptionField option="breakMin" value={s.breakMin} />
					<OptionField option="longBreakMin" value={s.longBreakMin} />
					<OptionField option="longBreakEvery" value={s.longBreakEvery} hint={`每完成 ${s.longBreakEvery} 個番茄，長休息一次`} />
				</div>
				<div className="mt-4 flex flex-col">
					<Switch
						checked={s.autoStartBreak}
						onChange={(autoStartBreak) => timer.setOptions({ autoStartBreak })}
						label="專注結束後自動開始休息"
					/>
					<Switch
						checked={s.autoStartFocus}
						onChange={(autoStartFocus) => timer.setOptions({ autoStartFocus })}
						label="休息結束後自動開始下一輪專注"
						description="離開超過 1 分鐘（例如電腦睡眠）時不會自動開始，也不會補記不在時的番茄"
					/>
				</div>
			</div>
		</section>
	);
}

/** 第 k／N 輪：這一組已完成的番茄是實心圓點，正在進行的那一輪是外框 */
function RoundDots({ s, today }: { s: TimerState; today: string }) {
	const { done, round, of, filled } = roundInfo(s, today);
	return (
		<div className="flex flex-col items-center gap-2">
			<span className="flex items-center gap-2" aria-hidden>
				{Array.from({ length: of }, (_, i) => (
					<span
						key={i}
						className={cn(
							'size-3 rounded-full transition-colors duration-180 ease-out',
							i < filled
								? 'bg-accent'
								: i === round - 1 && s.phase !== 'break'
									? 'ring-2 ring-accent ring-inset'
									: 'ring-[1.5px] ring-line-strong ring-inset',
						)}
					/>
				))}
			</span>
			<p className="text-sm text-ink-2">
				第 <span className="font-num tabular-nums">{round}</span>／<span className="font-num tabular-nums">{of}</span> 輪，今天完成{' '}
				<span className="font-num tabular-nums">{done}</span> 個番茄
			</p>
		</div>
	);
}

// ---- 白噪音（TMR-3） ----

const NOISE_OPTIONS: { value: NoisePrefs['kind']; label: string }[] = [
	{ value: 'off', label: '關閉' },
	...(['white', 'pink', 'brown'] as NoiseKind[]).map((k) => ({ value: k, label: NOISE_LABEL[k] })),
];

/** 白噪音：選種類與音量；專注中才播放，暫停或休息時停止（聲音由計時引擎控制，換頁也會繼續） */
function NoiseControls({ focusRunning }: { focusRunning: boolean }) {
	const { kind, volume } = useNoisePrefs();
	const id = useId();
	const on = kind !== 'off';
	return (
		<section aria-labelledby={`${id}-title`} className="w-full max-w-xl border-t border-line pt-5">
			<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<h2 id={`${id}-title`} className="text-h2 font-semibold">
					白噪音
				</h2>
				{on && (
					<p className="flex items-center gap-1.5 text-meta text-ink-2">
						{focusRunning ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
						{focusRunning ? `正在播放${NOISE_LABEL[kind]}` : '專注時才會播放'}
					</p>
				)}
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
				<Segmented label="白噪音種類" value={kind} onChange={(k) => setNoisePrefs({ kind: k })} options={NOISE_OPTIONS} />
				<div className="flex min-w-52 flex-1 items-center gap-2">
					<label htmlFor={`${id}-volume`} className="flex shrink-0 items-center gap-1.5 text-sm text-ink-2">
						<Volume1 className="size-4" aria-hidden />
						音量
					</label>
					<input
						id={`${id}-volume`}
						type="range"
						min={0}
						max={100}
						step={5}
						value={volume}
						disabled={!on}
						aria-valuetext={`${volume}%`}
						onChange={(e) => setNoisePrefs({ volume: Number(e.target.value) })}
						className="h-11 min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
					/>
					<output htmlFor={`${id}-volume`} className="w-10 shrink-0 text-right font-num text-sm text-ink-2 tabular-nums">
						{volume}%
					</output>
				</div>
			</div>
		</section>
	);
}

// ---- 學習紀錄（TMR-2） ----

/**
 * 學習紀錄列表：可以切換日期，每筆都能編輯（整列）與刪除。
 * 時間依 user.timezone 顯示。
 * errorShownAbove：今天的紀錄載入失敗時，頁面上方已經顯示錯誤與「重新載入」，這裡只說明，不重複一個錯誤橫幅。
 */
function SessionLog({
	date,
	today,
	onDateChange,
	onEdit,
	onCreate,
	errorShownAbove,
	className,
}: {
	date: string;
	today: string;
	onDateChange: (date: string) => void;
	onEdit: (session: StudySession) => void;
	onCreate: () => void;
	errorShownAbove: boolean;
	className?: string;
}) {
	const user = useUser();
	const tz = user.timezone;
	const subjectMap = useSubjectMap();
	const { data: sessions, isPending, error, refetch, isRefetching } = useStudySessions({ from: date, to: date });
	const remove = useDeleteSession();
	const [confirm, confirmDialog] = useConfirm();
	const list = sessions ?? [];
	const total = list.reduce((sum, x) => sum + x.durationSec, 0) / 60;
	const dateLabel = relativeDateLabel(date, today);

	const onDelete = async (x: StudySession) => {
		const range = formatClockRange(x.startedAt, x.endedAt, tz);
		if (
			await confirm({
				title: '刪除這筆學習紀錄？',
				message: `${dateLabel} ${range}，${formatMinutes(x.durationSec / 60)}。刪除後無法復原。`,
			})
		)
			remove.mutate(x.id);
	};

	return (
		<Card className={cn('self-start', className)}>
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
			{!error && (
				<div className="flex items-baseline gap-3 px-4 pb-3 sm:px-5">
					<span className="font-num text-num-lg font-semibold tabular-nums">{formatMinutes(total)}</span>
					<span className="text-meta text-ink-3">{list.length} 段學習</span>
				</div>
			)}
			{error && date === today && errorShownAbove ? (
				<p className="border-t border-line px-4 py-3 text-meta text-ink-3 sm:px-5">學習紀錄沒有載入，請按頁面上方的「重新載入」</p>
			) : error ? (
				<div className="px-4 pb-4 sm:px-5">
					<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />
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
									aria-label={`編輯紀錄：${range}，${STUDY_MODE_LABEL[x.mode]}，${subject ?? '未分類'}，${minutes}`}
									className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 pl-4 text-left transition-colors duration-120 ease-out hover:bg-subtle sm:pl-5"
								>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-baseline gap-x-2 text-sm">
											<span className="font-num font-semibold tabular-nums">{range}</span>
											<span className="text-meta text-ink-3">{STUDY_MODE_LABEL[x.mode]}</span>
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

// ---- 頁面 ----

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
	const digitsLabel = useId();

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
	const { data: logSessions, isFetching: logFetching } = useStudySessions({ from: logDate, to: logDate });
	const [missingOpen, setMissingOpen] = useState(0);
	if (pendingOpen && logSessions) {
		const found = logSessions.find((x) => x.id === pendingOpen);
		if (found) {
			setPendingOpen(null);
			setDialog({ session: found });
		} else if (!logFetching) {
			// 快取裡的舊資料找不到時，等這次查詢回來再判斷；最後還是找不到才告知
			setPendingOpen(null);
			setMissingOpen((n) => n + 1);
		}
	}
	useEffect(() => {
		if (missingOpen) toast.error('找不到這筆紀錄', { description: '可能已經刪除，或不在這一天的紀錄裡' });
	}, [missingOpen]);

	// 專注完成的那一刻（唯一刻意設計的動畫）：完成數改變時重播一次
	const completionKey = `${s.cyclesDate}|${s.cycles}`;
	const [seenCompletion, setSeenCompletion] = useState(completionKey);
	const [celebrations, setCelebrations] = useState(0);
	if (completionKey !== seenCompletion) {
		setSeenCompletion(completionKey);
		if (s.cycles > 0) setCelebrations((n) => n + 1);
	}

	const pomodoro = s.mode === 'pomodoro';
	const showSettings = pomodoro && s.phase === 'idle';
	const active = s.phase !== 'idle';
	const isBreak = s.phase === 'break';
	const waitingBreak = isBreak && !s.running;
	const paused = s.phase === 'focus' && !s.running;
	const breakName = s.breakKind === 'long' ? '長休息' : '短休息';
	const target = targetMs(s);
	const el = active ? elapsedMs(s, now) : 0;
	const shownMs = pomodoro ? Math.max(0, (target ?? 0) - el) : el;
	const progress = !active ? 0 : pomodoro && target ? el / target : (el % 3_600_000) / 3_600_000;
	const round = roundInfo(s, today);
	const subject = s.subjectId ? subjectMap.get(s.subjectId) : undefined;
	const todayMinutes = todaySessions.reduce((sum, x) => sum + x.durationSec, 0) / 60;
	const openTasks = tasks.filter((t) => t.id === s.taskId || (t.status !== 'done' && (!s.subjectId || t.subjectId === s.subjectId)));

	// 計時環：科目色疊在 tint 軌道；沒有科目用 accent；休息用 success；暫停用 ink-3
	const ring = isBreak
		? { tone: 'success' as const }
		: paused
			? { color: 'var(--ink-3)' }
			: subject
				? { color: toneOf(subject.color).mark }
				: { tone: 'accent' as const };

	const phase = isBreak
		? { Icon: Coffee, text: waitingBreak ? `準備${breakName}` : breakName, className: 'text-success' }
		: paused
			? { Icon: Pause, text: '已暫停', className: 'text-ink-2' }
			: { Icon: TimerIcon, text: active ? (pomodoro ? '專注中' : '計時中') : pomodoro ? '準備專注' : '碼錶', className: 'text-ink-2' };

	// 狀態區（polite）：階段改變時報讀；數字本身是 role="timer"，不會每秒報讀
	const status = isBreak
		? `專注完成，${waitingBreak ? '準備' : ''}${breakName} ${breakMinutes(s)} 分鐘`
		: paused
			? '已暫停'
			: s.phase === 'focus'
				? pomodoro
					? `專注中，第 ${round.round}／${round.of} 輪，共 ${s.focusMin} 分鐘`
					: '碼錶計時中'
				: pomodoro
					? `準備專注，${s.focusMin} 分鐘`
					: '碼錶已停止';

	const elapsedMin = Math.floor(el / 60_000);
	const valueText = !active
		? '尚未開始'
		: isBreak
			? `${breakName}剩 ${Math.ceil(shownMs / 60_000)} 分鐘`
			: pomodoro
				? `已專注 ${elapsedMin} 分鐘，共 ${s.focusMin} 分鐘`
				: `已計時 ${elapsedMin} 分鐘`;

	const finish = () => {
		if (!timer.finish()) toast('不到 1 分鐘，這次就不記錄了');
	};
	const discard = async () => {
		if (el > 60_000 && !(await confirm({ title: '放棄這次計時？', message: '已經計時的時間不會被記錄。', confirmText: '放棄' }))) return;
		timer.discard();
	};

	return (
		<div>
			<PageHeader
				title="學習計時"
				description={
					todayQuery.error
						? undefined
						: todayMinutes > 0 || round.done > 0
							? `今天已讀 ${formatMinutes(todayMinutes)}，完成 ${round.done} 個番茄`
							: '今天還沒有學習紀錄'
				}
			/>
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

					<div key={celebrations} className={cn('relative aspect-square w-[min(78vw,20rem)]', celebrations > 0 && 'animate-complete')}>
						<ProgressRing
							value={progress * 100}
							label="本輪進度"
							valueText={valueText}
							size={320}
							stroke={12}
							className="size-full!"
							{...ring}
						/>
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
							<span id={digitsLabel} className={cn('flex items-center gap-1.5 text-sm font-semibold', phase.className)}>
								<phase.Icon className="size-4" aria-hidden />
								{phase.text}
							</span>
							<span
								role="timer"
								aria-labelledby={digitsLabel}
								className={cn(
									'font-num leading-none font-semibold tracking-[-0.02em] tabular-nums lining-nums [font-stretch:semi-condensed]',
									shownMs >= 3_600_000 ? 'text-[clamp(2.5rem,11vw,4rem)]' : 'text-num-xl',
								)}
							>
								{formatDuration(shownMs / 1000)}
							</span>
							<span className="text-meta text-ink-3">
								{pomodoro ? (isBreak ? `${breakName} ${breakMinutes(s)} 分鐘` : `專注 ${s.focusMin} 分鐘`) : '每小時繞一圈'}
							</span>
						</div>
					</div>
					<p role="status" className="sr-only">
						{status}
					</p>

					{pomodoro && <RoundDots s={s} today={today} />}

					<div className="flex flex-wrap justify-center gap-3">
						{!active && (
							<Button variant="primary" size="lg" className="min-w-44" onClick={timer.start}>
								<Play className="size-5" aria-hidden />
								開始{pomodoro ? '專注' : '計時'}
							</Button>
						)}
						{s.phase === 'focus' && (
							<>
								{s.running ? (
									<Button size="lg" className="min-w-28" onClick={timer.pause}>
										<Pause className="size-5" aria-hidden />
										暫停
									</Button>
								) : (
									<Button variant="primary" size="lg" className="min-w-28" onClick={timer.resume}>
										<Play className="size-5" aria-hidden />
										繼續
									</Button>
								)}
								<Button size="lg" onClick={finish}>
									<Square className="size-4" aria-hidden />
									結束並儲存
								</Button>
								<Button variant="ghost" size="lg" onClick={discard}>
									<RotateCcw className="size-4" aria-hidden />
									放棄
								</Button>
							</>
						)}
						{waitingBreak && (
							<Button variant="primary" size="lg" className="min-w-44" onClick={timer.resume}>
								<Play className="size-5" aria-hidden />
								開始{breakName}
							</Button>
						)}
						{isBreak && (
							<Button size="lg" onClick={timer.skipBreak}>
								<SkipForward className="size-5" aria-hidden />
								跳過休息
							</Button>
						)}
					</div>
					{isBreak && (
						<p className="flex items-center gap-2 text-sm text-ink-2">
							<Coffee className="size-4" aria-hidden />
							站起來走走、喝杯水，讓眼睛休息一下
						</p>
					)}

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
