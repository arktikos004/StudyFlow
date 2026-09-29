import { Archive, ArchiveRestore, Check, Download, Monitor, Moon, Pencil, Plus, Sun, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Subject } from '../../shared/api-types';
import { changePasswordSchema, SUBJECT_COLORS } from '../../shared/schemas';
import { nextSubjectColor, useSubjectColor } from '../components/charts';
import { SubjectDot } from '../components/subjects';
import { Button, Card, CardHeader, cn, Field, Input, PageHeader, Segmented, Select, useConfirm } from '../components/ui';
import { api } from '../lib/api';
import { useCreateSubject, useDeleteSubject, useSubjects, useUpdateProfile, useUpdateSubject, useUser } from '../lib/queries';
import { setThemeMode, useThemeMode, type ThemeMode } from '../lib/theme';

const TIMEZONES = [
	'Asia/Taipei',
	'Asia/Tokyo',
	'Asia/Hong_Kong',
	'Asia/Shanghai',
	'Asia/Singapore',
	'Europe/London',
	'America/New_York',
	'America/Los_Angeles',
	'Australia/Sydney',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
	const colorOf = useSubjectColor();
	return (
		<div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="科目顏色">
			{SUBJECT_COLORS.map((c, i) => (
				<button
					key={c}
					type="button"
					role="radio"
					aria-checked={value === c}
					aria-label={`顏色 ${i + 1}`}
					onClick={() => onChange(c)}
					className={cn('grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-card', value === c && 'ring-2 ring-ink')}
					style={{ background: colorOf(c) }}
				>
					{value === c && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
				</button>
			))}
		</div>
	);
}

function SubjectRow({ subject }: { subject: Subject }) {
	const update = useUpdateSubject();
	const remove = useDeleteSubject();
	const colorOf = useSubjectColor();
	const [confirm, confirmDialog] = useConfirm();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(subject.name);
	const [color, setColor] = useState(subject.color);

	const save = async () => {
		await update.mutateAsync({ id: subject.id, name: name.trim(), color }).catch(() => {});
		setEditing(false);
	};

	if (editing)
		return (
			<li className="space-y-3 px-4 py-3 sm:px-5">
				<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="科目名稱" autoFocus />
				<ColorPicker value={color} onChange={setColor} />
				<div className="flex justify-end gap-2">
					<Button size="sm" onClick={() => setEditing(false)}>
						取消
					</Button>
					<Button size="sm" variant="primary" onClick={save} loading={update.isPending} disabled={!name.trim()}>
						儲存
					</Button>
				</div>
			</li>
		);

	return (
		<li className={cn('flex items-center gap-3 px-4 py-2.5 sm:px-5', subject.archived && 'opacity-60')}>
			<SubjectDot color={colorOf(subject.color)} className="size-3" />
			<span className="min-w-0 flex-1 truncate">
				{subject.name}
				{subject.archived && <span className="ml-2 text-xs text-ink-3">已封存</span>}
			</span>
			<Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`編輯 ${subject.name}`}>
				<Pencil className="size-4" />
			</Button>
			<Button
				size="icon"
				variant="ghost"
				onClick={() => update.mutate({ id: subject.id, archived: !subject.archived })}
				aria-label={subject.archived ? `取消封存 ${subject.name}` : `封存 ${subject.name}`}
				title={subject.archived ? '取消封存' : '封存（上完的課程，不再出現在選單中）'}
			>
				{subject.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
			</Button>
			<Button
				size="icon"
				variant="ghost"
				aria-label={`刪除 ${subject.name}`}
				onClick={async () => {
					if (
						await confirm({
							title: `刪除科目「${subject.name}」？`,
							message: '相關的考試、任務、筆記與學習紀錄都會保留，只是不再屬於任何科目。若只是課程結束，建議改用封存。',
						})
					)
						remove.mutate(subject.id);
				}}
			>
				<Trash2 className="size-4" />
			</Button>
			{confirmDialog}
		</li>
	);
}

function SubjectsCard() {
	const { data: subjects = [] } = useSubjects();
	const create = useCreateSubject();
	const [name, setName] = useState('');
	// 使用者沒選顏色時，自動用下一個還沒用過的顏色
	const [picked, setPicked] = useState<string | null>(null);
	const color = picked ?? nextSubjectColor(subjects.map((s) => s.color));

	const add = async (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		await create
			.mutateAsync({ name: name.trim(), color })
			.then(() => {
				setName('');
				setPicked(null);
			})
			.catch(() => {});
	};

	return (
		<Card>
			<CardHeader title="科目" />
			<p className="px-4 pb-3 text-sm text-ink-2 sm:px-5">科目用來分類考試、任務、筆記，也是學習統計的依據。</p>
			{subjects.length > 0 && (
				<ul className="divide-y divide-line border-y border-line">
					{subjects.map((s) => (
						<SubjectRow key={s.id} subject={s} />
					))}
				</ul>
			)}
			<form onSubmit={add} className="space-y-3 p-4 sm:px-5">
				<div className="flex gap-2">
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="新增科目，例如：計算機網路"
						maxLength={30}
						aria-label="新科目名稱"
					/>
					<Button type="submit" variant="primary" loading={create.isPending} disabled={!name.trim()}>
						<Plus className="size-4" aria-hidden />
						新增
					</Button>
				</div>
				<ColorPicker value={color} onChange={setPicked} />
			</form>
		</Card>
	);
}

function ProfileCard() {
	const user = useUser();
	const update = useUpdateProfile();
	const [displayName, setDisplayName] = useState(user.displayName);
	const [timezone, setTimezone] = useState(user.timezone);
	const zones = TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES];

	return (
		<Card>
			<CardHeader title="個人資料" />
			<form
				className="space-y-4 px-4 pb-5 sm:px-5"
				onSubmit={(e) => {
					e.preventDefault();
					update.mutate({ displayName: displayName.trim(), timezone });
				}}
			>
				<Field label="Email">{(id) => <Input id={id} value={user.email} disabled />}</Field>
				<Field label="暱稱">
					{(id) => <Input id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} />}
				</Field>
				<Field label="時區" hint="用來判斷「今天」與統計每天的學習時間">
					{(id) => (
						<Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
							{zones.map((z) => (
								<option key={z} value={z}>
									{z}
								</option>
							))}
						</Select>
					)}
				</Field>
				<div className="flex justify-end">
					<Button
						type="submit"
						variant="primary"
						loading={update.isPending}
						disabled={displayName.trim() === user.displayName && timezone === user.timezone}
					>
						儲存
					</Button>
				</div>
			</form>
		</Card>
	);
}

function PasswordCard() {
	const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(false);

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(undefined);
		const parsed = changePasswordSchema.safeParse(form);
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		if (form.newPassword !== form.confirm) return setError('兩次輸入的新密碼不一致');
		setLoading(true);
		try {
			await api.post('/auth/password', parsed.data);
			setForm({ currentPassword: '', newPassword: '', confirm: '' });
			toast.success('密碼已更新，其他裝置已登出');
		} catch (err) {
			setError(err instanceof Error ? err.message : '更新失敗');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card>
			<CardHeader title="變更密碼" />
			<form onSubmit={onSubmit} className="space-y-4 px-4 pb-5 sm:px-5" noValidate>
				<Field label="目前密碼">
					{(id) => (
						<Input
							id={id}
							type="password"
							autoComplete="current-password"
							value={form.currentPassword}
							onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
						/>
					)}
				</Field>
				<Field label="新密碼" hint="至少 8 個字元">
					{(id) => (
						<Input
							id={id}
							type="password"
							autoComplete="new-password"
							value={form.newPassword}
							onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
						/>
					)}
				</Field>
				<Field label="確認新密碼">
					{(id) => (
						<Input
							id={id}
							type="password"
							autoComplete="new-password"
							value={form.confirm}
							onChange={(e) => setForm({ ...form, confirm: e.target.value })}
						/>
					)}
				</Field>
				{error && (
					<p className="text-sm text-danger" role="alert">
						{error}
					</p>
				)}
				<div className="flex justify-end">
					<Button type="submit" loading={loading}>
						更新密碼
					</Button>
				</div>
			</form>
		</Card>
	);
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function InstallCard() {
	const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
	const standalone = window.matchMedia('(display-mode: standalone)').matches;
	const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

	useEffect(() => {
		const handler = (e: Event) => {
			e.preventDefault();
			setPrompt(e as InstallPrompt);
		};
		window.addEventListener('beforeinstallprompt', handler);
		return () => window.removeEventListener('beforeinstallprompt', handler);
	}, []);

	return (
		<Card>
			<CardHeader title="安裝到手機或電腦" />
			<div className="px-4 pb-5 text-sm text-ink-2 sm:px-5">
				{standalone ? (
					<p>✅ 你正在使用已安裝的 StudyFlow App。</p>
				) : prompt ? (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p>安裝後可以從主畫面直接開啟，使用起來就像一般 App。</p>
						<Button
							variant="primary"
							onClick={async () => {
								await prompt.prompt();
								setPrompt(null);
							}}
						>
							<Download className="size-4" aria-hidden />
							安裝 App
						</Button>
					</div>
				) : ios ? (
					<p>
						在 Safari 點下方的<strong className="text-ink">「分享」</strong>按鈕，再選<strong className="text-ink">「加入主畫面」</strong>
						，就能像 App 一樣使用。
					</p>
				) : (
					<p>在 Chrome 或 Edge 的網址列右側點「安裝」圖示，或從瀏覽器選單選擇「安裝 StudyFlow」。</p>
				)}
			</div>
		</Card>
	);
}

export function SettingsPage() {
	const mode = useThemeMode();
	return (
		<div>
			<PageHeader title="設定" />
			<div className="grid gap-5 lg:grid-cols-2">
				<div className="space-y-5">
					<SubjectsCard />
					<Card>
						<CardHeader title="外觀" />
						<div className="px-4 pb-5 sm:px-5">
							<Segmented<ThemeMode>
								label="佈景主題"
								value={mode}
								onChange={setThemeMode}
								options={[
									{
										value: 'system',
										label: (
											<span className="inline-flex items-center gap-1.5">
												<Monitor className="size-4" aria-hidden />
												跟隨系統
											</span>
										),
									},
									{
										value: 'light',
										label: (
											<span className="inline-flex items-center gap-1.5">
												<Sun className="size-4" aria-hidden />
												淺色
											</span>
										),
									},
									{
										value: 'dark',
										label: (
											<span className="inline-flex items-center gap-1.5">
												<Moon className="size-4" aria-hidden />
												深色
											</span>
										),
									},
								]}
							/>
						</div>
					</Card>
					<InstallCard />
				</div>
				<div className="space-y-5">
					<ProfileCard />
					<PasswordCard />
				</div>
			</div>
		</div>
	);
}
