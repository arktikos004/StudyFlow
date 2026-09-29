import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Ellipsis, LogOut, WifiOff } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useUser } from '../lib/queries';
import { useTimerEngine } from '../lib/timer';
import { Logo } from './Logo';
import { MOBILE_MAIN, NAV, NAV_GROUPS, type NavItem } from './nav';
import { TimerNavIcon, TimerPill } from './TimerPill';
import { Button, cn, Dialog } from './ui';

function useOnline() {
	return useSyncExternalStore(
		(cb) => {
			window.addEventListener('online', cb);
			window.addEventListener('offline', cb);
			return () => {
				window.removeEventListener('online', cb);
				window.removeEventListener('offline', cb);
			};
		},
		() => navigator.onLine,
	);
}

function useLogout() {
	const qc = useQueryClient();
	const navigate = useNavigate();
	return async () => {
		await api.post('/auth/logout').catch(() => {});
		qc.clear();
		qc.setQueryData(['me'], null);
		navigate('/login', { replace: true });
	};
}

/** 側欄的一項：目前頁面用 accent-soft 底、字重 600、較粗的圖示 */
function SideLink({ item }: { item: NavItem }) {
	return (
		<NavLink
			to={item.to}
			end={item.end}
			className={({ isActive }) =>
				cn(
					'flex h-10 items-center gap-3 rounded-lg px-3 text-dense transition-colors duration-120 ease-out pointer-coarse:h-11',
					isActive ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-ink-2 hover:bg-subtle hover:text-ink',
				)
			}
		>
			{({ isActive }) => (
				<>
					<item.icon className="size-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
					{item.label}
				</>
			)}
		</NavLink>
	);
}

/** 手機底部導覽的一格：實心底，目前頁面在圖示後面加上膠囊底 */
function TabItem({ icon: Icon, label, active, timer }: { icon: NavItem['icon']; label: string; active: boolean; timer?: boolean }) {
	return (
		<>
			<span
				className={cn(
					'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-180 ease-out',
					active && 'bg-accent-soft text-accent-ink',
				)}
			>
				{timer ? <TimerNavIcon icon={Icon} active={active} /> : <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden />}
			</span>
			{label}
		</>
	);
}

const tabClass = (active: boolean) =>
	cn('flex h-16 w-full flex-col items-center justify-center gap-1 text-xs', active ? 'font-semibold text-ink' : 'text-ink-2');

export function Layout() {
	useTimerEngine();
	const user = useUser();
	const logout = useLogout();
	const online = useOnline();
	const location = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);

	const moreItems = NAV.filter((n) => !MOBILE_MAIN.includes(n.to));
	const moreActive = moreItems.some((n) => location.pathname.startsWith(n.to));

	return (
		<div className="min-h-dvh md:flex">
			{/* 第一個可聚焦的元素：跳過導覽 */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-accent-ink focus:shadow-lg"
			>
				跳到主要內容
			</a>

			{/* 桌面版側邊欄：page 色底，靠空白分組 */}
			<aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-page md:flex">
				<div className="px-5 pt-5 pb-6">
					<Logo />
				</div>
				<nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="主選單">
					{NAV_GROUPS.map((group, i) => (
						<ul key={i} className={cn('space-y-0.5', i > 0 && 'mt-5')}>
							{group.map((n) => (
								<li key={n.to}>
									<SideLink item={n} />
								</li>
							))}
						</ul>
					))}
				</nav>
				<div className="px-3 pt-2 pb-4">
					<div className="px-3 pb-2">
						<div className="truncate text-sm font-semibold">{user.displayName}</div>
						<div className="truncate text-meta text-ink-3">{user.email}</div>
					</div>
					<button
						type="button"
						onClick={logout}
						className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-dense text-ink-2 transition-colors duration-120 ease-out hover:bg-subtle hover:text-ink pointer-coarse:h-11"
					>
						<LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden />
						登出
					</button>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				{/* 頁首：手機顯示 Logo；離線提示；計時中顯示剩餘時間 */}
				<header className="sticky top-0 z-20 box-content flex h-14 items-center justify-between gap-3 border-b border-line bg-page px-4 pt-[env(safe-area-inset-top)] md:border-none md:px-8">
					<div className="md:hidden">
						<Logo />
					</div>
					<div className="ml-auto flex items-center gap-2">
						{!online && (
							<span role="status" className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
								<WifiOff className="size-3.5" aria-hidden />
								離線中
							</span>
						)}
						<TimerPill />
					</div>
				</header>

				<main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 outline-none md:px-8 md:pb-10">
					<Outlet />
				</main>
			</div>

			{/* 手機版底部導覽：實心底，目前頁面加上膠囊底 */}
			<nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="主選單">
				<ul className="grid grid-cols-5">
					{NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
						<li key={n.to}>
							<NavLink to={n.to} end={n.end} className={({ isActive }) => tabClass(isActive)}>
								{({ isActive }) => <TabItem icon={n.icon} label={n.short ?? n.label} active={isActive} timer={n.to === '/timer'} />}
							</NavLink>
						</li>
					))}
					<li>
						<button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={tabClass(moreActive)}>
							<TabItem icon={Ellipsis} label="更多" active={moreActive} />
						</button>
					</li>
				</ul>
			</nav>

			<Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="更多功能">
				<ul className="-mx-2 space-y-0.5">
					{moreItems.map((n) => (
						<li key={n.to}>
							<NavLink
								to={n.to}
								end={n.end}
								onClick={() => setMoreOpen(false)}
								className={({ isActive }) =>
									cn(
										'flex h-12 items-center gap-3 rounded-lg px-3 text-dense',
										isActive ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-ink hover:bg-subtle',
									)
								}
							>
								{({ isActive }) => (
									<>
										<n.icon className="size-5 shrink-0" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
										<span className="flex-1">{n.label}</span>
										<ChevronRight className="size-4 text-ink-3" aria-hidden />
									</>
								)}
							</NavLink>
						</li>
					))}
				</ul>
				<div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
					<div className="min-w-0">
						<div className="truncate text-sm font-semibold">{user.displayName}</div>
						<div className="truncate text-meta text-ink-3">{user.email}</div>
					</div>
					<Button variant="ghost" onClick={logout}>
						<LogOut className="size-4" aria-hidden />
						登出
					</Button>
				</div>
			</Dialog>
		</div>
	);
}
