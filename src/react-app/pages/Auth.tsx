import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { PublicUser } from '../../shared/api-types';
import { loginSchema, registerSchema } from '../../shared/schemas';
import { LogoMark } from '../components/Logo';
import { Button, Field, Input } from '../components/ui';
import { api } from '../lib/api';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					<LogoMark className="mb-4 size-12" />
					<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
					<p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>
				</div>
				<div className="rounded-2xl border border-line bg-card p-6 shadow-card">{children}</div>
			</div>
		</div>
	);
}

/** 只允許站內路徑，避免 ?next= 被拿來導到外部網站 */
function safeNext(next: string | null) {
	return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
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
			qc.setQueryData(['me'], user);
			navigate(safeNext(params.get('next')), { replace: true });
		} catch (e) {
			setError(e instanceof Error ? e.message : '發生錯誤');
		} finally {
			setLoading(false);
		}
	};
	return { submit, error, setError, loading };
}

export function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const { submit, error, setError, loading } = useAuthSubmit('/auth/login');

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const parsed = loginSchema.safeParse({ email, password });
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		submit(parsed.data);
	};

	return (
		<AuthShell title="歡迎回來" subtitle="登入 StudyFlow，繼續你的學習進度">
			<form onSubmit={onSubmit} className="space-y-4" noValidate>
				<Field label="Email">
					{(id) => (
						<Input
							id={id}
							type="email"
							autoComplete="email"
							inputMode="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					)}
				</Field>
				<Field label="密碼">
					{(id) => (
						<Input
							id={id}
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					)}
				</Field>
				{error && (
					<p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
						{error}
					</p>
				)}
				<Button type="submit" variant="primary" className="w-full" loading={loading}>
					登入
				</Button>
			</form>
			<p className="mt-5 text-center text-sm text-ink-2">
				還沒有帳號？
				<Link to="/register" className="font-medium text-accent-ink hover:underline">
					免費註冊
				</Link>
			</p>
		</AuthShell>
	);
}

export function RegisterPage() {
	const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
	const { submit, error, setError, loading } = useAuthSubmit('/auth/register');
	const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		const parsed = registerSchema.safeParse(form);
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		if (form.password !== form.confirm) return setError('兩次輸入的密碼不一致');
		submit(parsed.data);
	};

	return (
		<AuthShell title="建立帳號" subtitle="把考試、任務、讀書時間和錯題集中在一個地方">
			<form onSubmit={onSubmit} className="space-y-4" noValidate>
				<Field label="暱稱">
					{(id) => <Input id={id} autoComplete="nickname" value={form.displayName} onChange={set('displayName')} maxLength={30} />}
				</Field>
				<Field label="Email">
					{(id) => <Input id={id} type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} />}
				</Field>
				<Field label="密碼" hint="至少 8 個字元">
					{(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}
				</Field>
				<Field label="確認密碼">
					{(id) => <Input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />}
				</Field>
				{error && (
					<p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
						{error}
					</p>
				)}
				<Button type="submit" variant="primary" className="w-full" loading={loading}>
					註冊並開始使用
				</Button>
			</form>
			<p className="mt-5 text-center text-sm text-ink-2">
				已經有帳號了？
				<Link to="/login" className="font-medium text-accent-ink hover:underline">
					登入
				</Link>
			</p>
		</AuthShell>
	);
}
