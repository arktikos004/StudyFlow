import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { PublicUser } from '../../shared/api-types';
import { subjectTone } from '../../shared/color';
import { RECOMMENDED } from '../../shared/palette';
import { loginSchema, registerSchema } from '../../shared/schemas';
import { LogoMark } from '../components/Logo';
import { SubjectChip } from '../components/subjects';
import { Button, cn, Field, Input } from '../components/ui';
import { api } from '../lib/api';
import { ME_KEY } from '../lib/queries';
import { useIsDark } from '../lib/theme';

/** 品牌欄的筆記頁預覽（裝飾）：三列筆記，科目用推薦色的螢光筆 chip 標出 */
const PREVIEW = [
	{ subject: '微積分', color: RECOMMENDED[0].hex, title: '期中考', meta: '5 天後' },
	{ subject: '英文', color: RECOMMENDED[1].hex, title: '單字 Unit 5', meta: '今天' },
	{ subject: '物理', color: RECOMMENDED[2].hex, title: '實驗報告專注中', meta: '24:13' },
] as const;

/**
 * 桌面（lg 以上）左側的品牌欄。用 data-theme 局部換成「相反」的深淺色：
 * 白天整頁是紙，這一欄是夜色；晚上整頁是夜色，這一欄是紙（藍筆與螢光筆：晚上反過來）。
 */
function BrandPanel() {
	const dark = !useIsDark();
	return (
		<aside
			data-theme={dark ? 'dark' : 'light'}
			className="sticky top-0 hidden h-dvh flex-col justify-between overflow-hidden bg-page px-12 py-10 text-ink lg:flex xl:px-16"
		>
			<div className="flex items-center gap-2.5">
				<LogoMark />
				<span className="text-[17px] font-bold tracking-tight" translate="no">
					StudyFlow
				</span>
			</div>

			<div className="max-w-md">
				<p className="text-[2rem] leading-[1.35] font-bold text-balance">每一科，都有自己的螢光筆。</p>
				<p className="mt-3 text-dense text-ink-2">考試倒數、學習任務、番茄鐘與錯題複習，整理在同一本筆記裡。</p>

				<div aria-hidden className="mt-10 rounded-2xl border border-line bg-card px-5 pt-3 pb-1 shadow-lg">
					{PREVIEW.map((row) => (
						<div key={row.subject} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
							<SubjectChip name={row.subject} tone={subjectTone(row.color, dark)} />
							<span className="min-w-0 flex-1 truncate text-dense">{row.title}</span>
							<span className="font-num text-sm font-semibold text-ink-2 tabular-nums">{row.meta}</span>
						</div>
					))}
				</div>
			</div>

			<p className="text-meta text-ink-3">你的紀錄只有你看得到。</p>
		</aside>
	);
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
	return (
		<div className="min-h-dvh lg:grid lg:grid-cols-2">
			<BrandPanel />
			<main className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:items-center lg:px-12">
				<div className="w-full sm:max-w-sm">
					<div className="mb-8 flex items-center gap-2.5 lg:hidden">
						<LogoMark />
						<span className="text-[17px] font-bold tracking-tight" translate="no">
							StudyFlow
						</span>
					</div>
					<h1 className="text-[1.375rem] leading-[1.3] font-bold text-balance sm:text-h1">{title}</h1>
					<p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>
					<div className="mt-8">{children}</div>
				</div>
			</main>
		</div>
	);
}

/** 密碼欄：右側的切換鈕（44px、aria-pressed，名稱固定為「顯示密碼」）切換明碼 */
const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function PasswordInput(
	{ className, id, ...props },
	ref,
) {
	const [shown, setShown] = useState(false);
	return (
		<div className="relative">
			<Input ref={ref} id={id} type={shown ? 'text' : 'password'} className={cn('pr-12', className)} {...props} />
			<button
				type="button"
				aria-label="顯示密碼"
				aria-pressed={shown}
				aria-controls={id}
				onClick={() => setShown((v) => !v)}
				className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-3 transition-colors duration-120 ease-out hover:text-ink"
			>
				{shown ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
			</button>
		</div>
	);
});

/** 只允許站內路徑，避免 ?next= 被拿來導到外部網站 */
function safeNext(next: string | null) {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** zod 的錯誤 → 每個欄位第一則訊息 */
function fieldErrors<K extends string>(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Partial<Record<K, string>> {
	const out: Partial<Record<K, string>> = {};
	for (const issue of issues) {
		const key = issue.path[0] as K | undefined;
		if (key && !out[key]) out[key] = issue.message;
	}
	return out;
}

function useAuthSubmit(path: '/auth/login' | '/auth/register') {
	const qc = useQueryClient();
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(false);

	const submit = async (body: unknown) => {
		setLoading(true);
		setError(undefined);
		try {
			const { user } = await api.post<{ user: PublicUser }>(path, body);
			qc.setQueryData(ME_KEY, user);
			navigate(safeNext(params.get('next')), { replace: true });
		} catch (e) {
			setError(e instanceof Error ? e.message : '發生錯誤');
		} finally {
			setLoading(false);
		}
	};
	return { submit, error, setError, loading };
}

/** 表單層級的錯誤（例如帳號密碼錯誤）：圖示加文字 */
function FormError({ children }: { children: ReactNode }) {
	return (
		<p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
			<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
			<span>{children}</span>
		</p>
	);
}

/**
 * 欄位錯誤的共用狀態：送出時一次標出所有錯誤並把焦點移到第一個錯的欄位；修改欄位時清掉該欄的錯誤。
 * order 是畫面上的欄位順序。
 */
function useFieldErrors<K extends string>(order: readonly K[]) {
	const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
	const refs = useRef<Partial<Record<K, HTMLInputElement | null>>>({});
	const bind = (k: K) => (el: HTMLInputElement | null) => {
		refs.current[k] = el;
	};
	const show = (next: Partial<Record<K, string>>) => {
		setErrors(next);
		const first = order.find((k) => next[k]);
		if (first) refs.current[first]?.focus();
	};
	const clear = (k: K) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
	return { errors, bind, show, clear };
}

export function LoginPage() {
	const [form, setForm] = useState({ email: '', password: '' });
	const { submit, error, setError, loading } = useAuthSubmit('/auth/login');
	const fields = useFieldErrors(['email', 'password'] as const);
	const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm((f) => ({ ...f, [k]: e.target.value }));
		fields.clear(k);
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setError(undefined);
		const parsed = loginSchema.safeParse(form);
		if (!parsed.success) return fields.show(fieldErrors(parsed.error.issues));
		fields.show({});
		submit(parsed.data);
	};

	return (
		<AuthShell title="歡迎回來" subtitle="登入 StudyFlow，繼續你的學習進度">
			<form onSubmit={onSubmit} className="space-y-4" noValidate>
				<Field label="Email" error={fields.errors.email}>
					{(id, aria) => (
						<Input
							ref={fields.bind('email')}
							name="email"
							id={id}
							{...aria}
							type="email"
							autoComplete="username"
							inputMode="email"
							spellCheck={false}
							value={form.email}
							onChange={set('email')}
							required
						/>
					)}
				</Field>
				<Field label="密碼" error={fields.errors.password}>
					{(id, aria) => (
						<PasswordInput
							ref={fields.bind('password')}
							name="password"
							id={id}
							{...aria}
							autoComplete="current-password"
							value={form.password}
							onChange={set('password')}
							required
						/>
					)}
				</Field>
				{error && <FormError>{error}</FormError>}
				<Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
					登入
				</Button>
			</form>
			<p className="mt-6 text-sm text-ink-2">
				還沒有帳號？
				<Link to="/register" className="inline-flex min-h-11 items-center font-semibold text-accent-ink hover:underline">
					免費註冊
				</Link>
			</p>
		</AuthShell>
	);
}

export function RegisterPage() {
	const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
	const { submit, error, setError, loading } = useAuthSubmit('/auth/register');
	const fields = useFieldErrors(['displayName', 'email', 'password', 'confirm'] as const);
	const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm((f) => ({ ...f, [k]: e.target.value }));
		fields.clear(k);
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setError(undefined);
		const parsed = registerSchema.safeParse(form);
		const errs = parsed.success ? {} : fieldErrors<keyof typeof form>(parsed.error.issues);
		if (!errs.confirm && form.confirm !== form.password) errs.confirm = '兩次輸入的密碼不一致';
		fields.show(errs);
		if (!parsed.success || errs.confirm) return;
		submit(parsed.data);
	};

	return (
		<AuthShell title="建立帳號" subtitle="把考試、任務、讀書時間和錯題集中在一個地方">
			<form onSubmit={onSubmit} className="space-y-4" noValidate>
				<Field label="暱稱" error={fields.errors.displayName}>
					{(id, aria) => (
						<Input
							ref={fields.bind('displayName')}
							name="nickname"
							id={id}
							{...aria}
							autoComplete="nickname"
							value={form.displayName}
							onChange={set('displayName')}
							maxLength={30}
						/>
					)}
				</Field>
				<Field label="Email" error={fields.errors.email}>
					{(id, aria) => (
						<Input
							ref={fields.bind('email')}
							name="email"
							id={id}
							{...aria}
							type="email"
							autoComplete="username"
							inputMode="email"
							spellCheck={false}
							value={form.email}
							onChange={set('email')}
						/>
					)}
				</Field>
				<Field label="密碼" hint="至少 8 個字元" error={fields.errors.password}>
					{(id, aria) => (
						<PasswordInput
							ref={fields.bind('password')}
							name="password"
							id={id}
							{...aria}
							autoComplete="new-password"
							value={form.password}
							onChange={set('password')}
						/>
					)}
				</Field>
				<Field label="確認密碼" error={fields.errors.confirm}>
					{(id, aria) => (
						<PasswordInput
							ref={fields.bind('confirm')}
							name="password-confirm"
							id={id}
							{...aria}
							autoComplete="new-password"
							value={form.confirm}
							onChange={set('confirm')}
						/>
					)}
				</Field>
				{error && <FormError>{error}</FormError>}
				<Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
					註冊並開始使用
				</Button>
			</form>
			<p className="mt-6 text-sm text-ink-2">
				已經有帳號了？
				<Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-accent-ink hover:underline">
					登入
				</Link>
			</p>
		</AuthShell>
	);
}
