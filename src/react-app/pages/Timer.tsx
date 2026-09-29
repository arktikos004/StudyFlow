import { Coffee, Pause, Play, Plus, RotateCcw, SkipForward, Square, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { startOfLocalDay, today as todayOf } from '../../shared/dates';
import { SubjectSelect, SubjectTag } from '../components/subjects';
import { Button, Card, CardHeader, cn, Dialog, EmptyState, Field, Input, Segmented, Select, useConfirm } from '../components/ui';
import { formatDuration, formatMinutes, formatTime, MODE_LABEL } from '../lib/format';
import { useCreateSession, useDeleteSession, useStudySessions, useTasks, useUser } from '../lib/queries';
import { elapsedMs, targetMs, timer, useNow, useTimerState, type TimerMode } from '../lib/timer';

const FOCUS_PRESETS = [15, 25, 45, 50];
const BREAK_PRESETS = [5, 10, 15];

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

function ManualForm({ onDone }: { onDone: () => void }) {
	const user = useUser();
	const create = useCreateSession();
	const { data: tasks = [] } = useTasks();
	const [form, setForm] = useState(() => {
		// 預設：今天、一小時前開始、讀 60 分鐘
		const start = new Date(Date.now() - 60 * 60_000);
		const hhmm = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
		return { date: todayOf(user.timezone), start: hhmm, minutes: '60', subjectId: null as string | null, taskId: '', note: '' };
	});
	const [error, setError] = useState<string>();

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		const minutes = Number(form.minutes);
		if (!form.date || !form.start) return setError('請輸入日期與開始時間');
		if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720) return setError('時間長度請輸入 1–720 分鐘');
		const [h, m] = form.start.split(':').map(Number);
		const startedAt = startOfLocalDay(form.date, user.timezone) + (h * 60 + m) * 60_000;
		const endedAt = startedAt + minutes * 60_000;
		if (endedAt > Date.now()) return setError('結束時間不能晚於現在');
		try {
			await create.mutateAsync({
				mode: 'manual',
				startedAt,
				endedAt,
				subjectId: form.subjectId,
				taskId: form.taskId || null,
				note: form.note.trim() || null,
			});
			onDone();
		} catch {
			// toast 已顯示錯誤
		}
	};

	return (
		<form id="manual-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4" noValidate>
			<Field label="日期">
				{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
			</Field>
			<Field label="開始時間">
				{(id) => <Input id={id} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}
			</Field>
			<Field label="讀了幾分鐘">
				{(id) => (
					<Input
						id={id}
						type="number"
						inputMode="numeric"
						min={1}
						max={720}
						value={form.minutes}
						onChange={(e) => setForm({ ...form, minutes: e.target.value })}
					/>
				)}
			</Field>
			<Field label="科目">
				{(id) => <SubjectSelect id={id} value={form.subjectId} onChange={(subjectId) => setForm({ ...form, subjectId })} />}
			</Field>
			<Field label="相關任務（選填）" className="col-span-2">
				{(id) => (
					<Select id={id} value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })}>
						<option value="">不指定</option>
						{tasks
							.filter((t) => t.status !== 'done' && (!form.subjectId || t.subjectId === form.subjectId))
							.map((t) => (
								<option key={t.id} value={t.id}>
									{t.title}
								</option>
							))}
					</Select>
				)}
			</Field>
			<Field label="備註（選填）" className="col-span-2">
				{(id) => (
					<Input
						id={id}
						value={form.note}
						onChange={(e) => setForm({ ...form, note: e.target.value })}
						maxLength={500}
						placeholder="例如：在圖書館讀第 5 章"
					/>
				)}
			</Field>
			{error && (
				<p className="col-span-2 text-sm text-danger" role="alert">
					{error}
				</p>
			)}
		</form>
	);
}

function ManualDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="手動補登學習時間"
			footer={
				<>
					<Button onClick={onClose}>取消</Button>
					<Button variant="primary" type="submit" form="manual-form">
						儲存
					</Button>
				</>
			}
		>
			<ManualForm onDone={onClose} />
		</Dialog>
	);
}

export function TimerPage() {
	const user = useUser();
	const s = useTimerState();
	const now = useNow(s.running);
	const today = todayOf(user.timezone);
	const { data: sessions = [] } = useStudySessions({ from: today, to: today });
	const { data: tasks = [] } = useTasks();
	const deleteSession = useDeleteSession();
	const [manualOpen, setManualOpen] = useState(false);
	const [confirm, confirmDialog] = useConfirm();

	const active = s.phase !== 'idle';
	const target = targetMs(s);
	const el = active ? elapsedMs(s, now) : 0;
	const display = s.mode === 'pomodoro' ? Math.max(0, (target ?? 0) - el) : el;
	const progress = s.mode === 'pomodoro' && target ? el / target : (el % 3_600_000) / 3_600_000;
	const todayTotal = sessions.reduce((sum, x) => sum + x.durationSec, 0) / 60;
	const cycles = s.cyclesDate === new Date().toDateString() ? s.cycles : 0;
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
						{s.mode === 'pomodoro' && <span className="text-sm text-ink-2">今天完成 {cycles} 個番茄 🍅</span>}
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
								: s.phase === 'break'
									? '休息時間'
									: s.running
										? '專注中'
										: '已暫停'}
						</span>
						<span className="mt-1 text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl" aria-live="off">
							{formatDuration((active ? display : s.mode === 'pomodoro' ? s.focusMin * 60_000 : 0) / 1000)}
						</span>
						{s.mode === 'pomodoro' && s.phase !== 'idle' && (
							<span className="mt-1 text-xs text-ink-3">{s.phase === 'focus' ? `共 ${s.focusMin} 分鐘` : `休息 ${s.breakMin} 分鐘`}</span>
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
						{s.phase === 'break' && (
							<Button className="h-12 text-base" onClick={timer.skipBreak}>
								<SkipForward className="size-5" aria-hidden />
								跳過休息
							</Button>
						)}
					</div>

					{s.mode === 'pomodoro' && !active && (
						<div className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
							<div>
								<p className="mb-2 text-sm font-medium text-ink-2">專注時間</p>
								<Segmented
									label="專注分鐘數"
									value={String(s.focusMin)}
									onChange={(v) => timer.configure({ focusMin: Number(v) })}
									options={FOCUS_PRESETS.map((m) => ({ value: String(m), label: `${m}分` }))}
								/>
							</div>
							<div>
								<p className="mb-2 text-sm font-medium text-ink-2">休息時間</p>
								<Segmented
									label="休息分鐘數"
									value={String(s.breakMin)}
									onChange={(v) => timer.configure({ breakMin: Number(v) })}
									options={BREAK_PRESETS.map((m) => ({ value: String(m), label: `${m}分` }))}
								/>
							</div>
						</div>
					)}
					{s.phase === 'break' && (
						<p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-2">
							<Coffee className="size-4" aria-hidden />
							站起來走走、喝杯水，讓眼睛休息一下
						</p>
					)}
				</Card>

				<Card className="self-start">
					<CardHeader
						title="今天的學習紀錄"
						action={
							<Button size="sm" variant="ghost" onClick={() => setManualOpen(true)}>
								<Plus className="size-4" aria-hidden />
								補登
							</Button>
						}
					/>
					<div className="px-4 pb-2 sm:px-5">
						<p className="text-3xl font-semibold tracking-tight">{formatMinutes(todayTotal)}</p>
						<p className="text-sm text-ink-3">{sessions.length} 段學習</p>
					</div>
					{sessions.length === 0 ? (
						<EmptyState title="今天還沒有紀錄" description="按下開始，完成的專注時間會自動記錄在這裡。" />
					) : (
						<ul className="divide-y divide-line border-t border-line">
							{sessions.map((x) => (
								<li key={x.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 text-sm">
											<span className="font-medium tabular-nums">
												{formatTime(x.startedAt)}–{formatTime(x.endedAt)}
											</span>
											<span className="text-ink-3">{MODE_LABEL[x.mode]}</span>
										</div>
										<div className="mt-0.5 flex items-center gap-2">
											<SubjectTag subjectId={x.subjectId} />
											{x.note && <span className="truncate text-xs text-ink-3">{x.note}</span>}
										</div>
									</div>
									<span className="text-sm text-ink-2 tabular-nums">{formatMinutes(x.durationSec / 60)}</span>
									<Button
										size="icon"
										variant="ghost"
										aria-label="刪除這筆紀錄"
										onClick={async () => {
											if (await confirm({ title: '刪除這筆學習紀錄？' })) deleteSession.mutate(x.id);
										}}
									>
										<Trash2 className="size-4" />
									</Button>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>
			<ManualDialog open={manualOpen} onClose={() => setManualOpen(false)} />
			{confirmDialog}
		</div>
	);
}
