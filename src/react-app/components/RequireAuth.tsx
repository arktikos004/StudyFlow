import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '../lib/queries';
import { ErrorNote, PageLoader } from './ui';

export function RequireAuth({ children }: { children: ReactNode }) {
	const { data: user, isPending, error, refetch, isRefetching } = useMe();
	const location = useLocation();
	if (isPending) return <PageLoader />;
	if (error)
		return (
			<div className="mx-auto max-w-md p-6">
				<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />
			</div>
		);
	if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
	return children;
}

/** 已登入就不需要看到登入/註冊頁 */
export function GuestOnly({ children }: { children: ReactNode }) {
	const { data: user, isPending } = useMe();
	if (isPending) return <PageLoader />;
	if (user) return <Navigate to="/" replace />;
	return children;
}
