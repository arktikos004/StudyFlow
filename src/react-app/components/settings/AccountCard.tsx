import { onlineManager } from '@tanstack/react-query';
import { ChevronDown, CircleAlert } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { PublicUser } from '../../../shared/api-types';
import { changePasswordSchema } from '../../../shared/schemas';
import { api, ApiError } from '../../lib/api';
import { timezoneLabel, timezoneOptions } from '../../lib/profile-format';
import { useUpdateProfile, useUser } from '../../lib/queries';
import { Button, Card, CardHeader, cn, Field, Input, Select } from '../ui';
import { EmailText } from './ProfileEmail';

const isFinePointer = () => window.matchMedia('(pointer: fine)').matches;

/**
 * 時區：常用清單＋目前的時區，選項附上 GMT 偏移；改了才能按「儲存」（不在選單變動時自動儲存：鍵盤上下鍵會直接改值）。
 * 離線時不送出、直接提示（TanStack Query 離線時會把 mutation 暫停，連線後才補送）。
 */
function TimezoneForm({ user }: { user: PublicUser }) {
	const update = useUpdateProfile();
	const [timezone, setTimezone] = useState(user.timezone);
	const changed = timezone !== user.timezone;
	return (
		<form
			className="px-4 py-4 sm:px-5"
			onSubmit={(e) => {
				e.preventDefault();
				if (!changed) return;
				if (!onlineManager.isOnline()) toast.error('目前離線，連上網路後再儲存');
				else update.mutate({ timezone });
			}}
		>
			<Field label="時區" hint="用來判斷「今天」與統計每天的學習時間">
				{(id, aria) => (
					<div className="flex gap-2">
						<Select id={id} {...aria} name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="min-w-0 flex-1">
							{timezoneOptions(user.timezone).map((z) => (
								<option key={z} value={z}>
									{timezoneLabel(z)}
								</option>
							))}
						</Select>
						<Button type="submit" loading={update.isPending} disabled={!changed}>
							儲存
						</Button>
					</div>
				)}
			</Field>
		</form>
	);
}

type PasswordField = 'currentPassword' | 'newPassword' | 'confirm';
type PasswordErrors = Partial<Record<PasswordField | 'form', string>>;
const FIELD_ORDER: PasswordField[] = ['currentPassword', 'newPassword', 'confirm'];

/**
 * 變更密碼的表單（展開後才出現）。錯誤顯示在欄位旁邊，送出時焦點移到第一個錯誤；
 * 目前密碼不對（後端 400）標在「目前密碼」；其他失敗（離線、太多次）顯示在按鈕上方。
 * 有一個隱藏的 username 欄位（email），密碼管理工具才知道要更新哪一組帳號的密碼。
 */
function PasswordForm({ id, email, onDone }: { id: string; email: string; onDone: () => void }) {
	const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
	const [errors, setErrors] = useState<PasswordErrors>({});
	const [loading, setLoading] = useState(false);
	// 展開時焦點直接進「目前密碼」（只在滑鼠、觸控板：觸控裝置不自動 focus，同 Dialog）
	const [focusFirst] = useState(isFinePointer);
	const refs = useRef<Partial<Record<PasswordField, HTMLInputElement | null>>>({});

	const showErrors = (next: PasswordErrors) => {
		setErrors(next);
		const first = FIELD_ORDER.find((f) => next[f]);
		if (first) refs.current[first]?.focus();
	};

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (loading) return;
		const next: PasswordErrors = {};
		const parsed = changePasswordSchema.safeParse(form);
		if (!parsed.success)
			for (const issue of parsed.error.issues) {
				const key = issue.path[0];
				if (key === 'currentPassword' || key === 'newPassword') next[key] ??= issue.message;
			}
		if (!next.newPassword && form.newPassword !== form.confirm) next.confirm = '兩次輸入的新密碼不一致';
		if (!parsed.success || next.confirm) return showErrors(next);
		setErrors({});
		setLoading(true);
		try {
			await api.post('/auth/password', parsed.data);
			toast.success('密碼已更新，其他裝置已登出');
			onDone();
		} catch (err) {
			const message = err instanceof Error ? err.message : '更新失敗，請再試一次';
			showErrors(err instanceof ApiError && err.status === 400 ? { currentPassword: message } : { form: message });
		} finally {
			setLoading(false);
		}
	};

	const field = (key: PasswordField, label: string, autoComplete: string, hint?: string) => (
		<Field label={label} hint={hint} error={errors[key]}>
			{(fieldId, aria) => (
				<Input
					ref={(el) => {
						refs.current[key] = el;
					}}
					id={fieldId}
					{...aria}
					type="password"
					name={key}
					autoComplete={autoComplete}
					value={form[key]}
					onChange={(e) => {
						setForm({ ...form, [key]: e.target.value });
						setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
					}}
					autoFocus={key === 'currentPassword' && focusFirst}
				/>
			)}
		</Field>
	);

	return (
		<form id={id} onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4" noValidate>
			<input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
			{field('currentPassword', '目前密碼', 'current-password')}
			{field('newPassword', '新密碼', 'new-password', '至少 8 個字元')}
			{field('confirm', '確認新密碼', 'new-password')}
			{errors.form && (
				<p role="alert" className="flex items-start gap-1.5 text-meta text-danger">
					<CircleAlert className="mt-[3px] size-3.5 shrink-0" aria-hidden />
					<span>{errors.form}</span>
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button variant="ghost" onClick={onDone}>
					取消
				</Button>
				<Button type="submit" loading={loading}>
					更新密碼
				</Button>
			</div>
		</form>
	);
}

/** 密碼：平常只有一列說明與「變更密碼」（aria-expanded），按了才在下面展開表單；收起後焦點回到按鈕 */
function PasswordSection({ email }: { email: string }) {
	const [open, setOpen] = useState(false);
	const formId = useId();
	const noteId = useId();
	const toggleRef = useRef<HTMLButtonElement>(null);
	const collapse = () => {
		setOpen(false);
		toggleRef.current?.focus();
	};
	return (
		<div className="px-4 py-4 sm:px-5">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<h3 className="text-sm font-semibold text-ink-2">密碼</h3>
					<p id={noteId} className="text-meta text-ink-3">
						變更後，其他裝置會登出
					</p>
				</div>
				<Button
					ref={toggleRef}
					aria-expanded={open}
					aria-controls={open ? formId : undefined}
					aria-describedby={noteId}
					onClick={() => (open ? collapse() : setOpen(true))}
				>
					變更密碼
					<ChevronDown
						className={cn('size-4 text-ink-3 transition-transform duration-180 ease-out motion-reduce:transition-none', open && 'rotate-180')}
						aria-hidden
					/>
				</Button>
			</div>
			{open && <PasswordForm id={formId} email={email} onDone={collapse} />}
		</div>
	);
}

/**
 * 帳號與安全（PRO-1）：Email（唯讀文字，不用停用的輸入框）、時區、變更密碼。
 * 取代原本的「個人資料」與「變更密碼」兩張卡；暱稱與照片改在個人檔案的「編輯個人資料」。
 * 三段用分隔線分開（卡片裡不放卡片）；按鈕都是 secondary，設定頁只有一個 primary。
 */
export function AccountCard() {
	const user = useUser();
	return (
		<Card>
			<CardHeader title="帳號與安全" />
			<div className="divide-y divide-line">
				<dl className="px-4 pt-1 pb-4 sm:px-5">
					<dt className="text-sm font-semibold text-ink-2">Email</dt>
					<dd className="mt-1 text-dense text-ink [overflow-wrap:anywhere]">
						<EmailText email={user.email} />
					</dd>
					<dd className="mt-0.5 text-meta text-ink-3">登入時使用，目前無法變更</dd>
				</dl>
				<TimezoneForm user={user} />
				<PasswordSection email={user.email} />
			</div>
		</Card>
	);
}
