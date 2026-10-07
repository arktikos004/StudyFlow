import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { safeNextPath } from '../lib/next-path';
import { useMe } from '../lib/account-queries';
import { ErrorNote, PageLoader } from './ui';

export function RequireAuth({ children }: { children: ReactNode }) {
	const { data: user, isPending, error, refetch, isRefetching } = useMe();
	const location = useLocation();
	if (isPending) return <PageLoader />;
	// 只有一開始就取不到才顯示錯誤；手上已經有資料時（例如切回分頁時重新取得失敗），繼續顯示原本的畫面
	if (error && user === undefined)
		return (
			<div className="mx-auto max-w-md p-6">
				<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />
			</div>
		);
	if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
	return children;
}

/**
 * 已登入就不需要看到登入／註冊頁：回到原本要去的頁面（?next=，RequireAuth 組的），沒有就回總覽。
 * 登入、註冊成功時 hook 會寫入使用者，這裡就會導過去，頁面本身不必另外導頁。
 */
export function GuestOnly({ children }: { children: ReactNode }) {
	const { data: user, isPending } = useMe();
	const [params] = useSearchParams();
	if (isPending) return <PageLoader />;
	if (user) return <Navigate to={safeNextPath(params.get('next'), window.location.origin)} replace />;
	return children;
}
