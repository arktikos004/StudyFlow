import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { changePasswordSchema } from '../../../shared/schemas';
import { api } from '../../lib/api';
import { Button, Card, CardHeader, Field, Input } from '../ui';

export function PasswordCard() {
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
			<form onSubmit={onSubmit} className="space-y-4 px-4 pt-2 pb-5 sm:px-5" noValidate>
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
