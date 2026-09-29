import { useQueryClient } from '@tanstack/react-query';
import {
	CalendarDays,
	ChartColumn,
	Ellipsis,
	GraduationCap,
	LayoutDashboard,
	ListChecks,
	LogOut,
	NotebookPen,
	Settings,
	Timer as TimerIcon,
	WifiOff,
	type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { formatDuration } from '../lib/format';
import { useUser } from '../lib/queries';
import { elapsedMs, targetMs, useNow, useTimerEngine, useTimerState } from '../lib/timer';
import { Logo } from './Logo';
import { cn, Dialog } from './ui';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const NAV: NavItem[] = [
	{ to: '/', label: '總覽', icon: LayoutDashboard, end: true },
	{ to: '/calendar', label: '月曆', icon: CalendarDays },
	{ to: '/events', label: '考試與截止', icon: GraduationCap },
	{ to: '/tasks', label: '學習任務', icon: ListChecks },
	{ to: '/timer', label: '學習計時', icon: TimerIcon },
	{ to: '/notes', label: '筆記與錯題', icon: NotebookPen },
	{ to: '/stats', label: '學習統計', icon: ChartColumn },
	{ to: '/settings', label: '設定', icon: Settings },
];

// 手機底部只放最常用的四個，其餘收進「更多」
const MOBILE_MAIN = ['/', '/tasks', '/timer', '/notes'];

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

/** 計時中時在頁首顯示剩餘時間，點一下回到計時頁 */
function TimerPill() {
	const s = useTimerState();
	const now = useNow(s.running);
	const navigate = useNavigate();
	const active = s.phase !== 'idle';

	const target = targetMs(s);
	const el = elapsedMs(s, now);
	const shown = target ? Math.max(0, target - el) : el;
	const label = s.phase === 'break' ? '休息' : '專注';

	useEffect(() => {
		document.title = active ? `${formatDuration(shown / 1000)} ${label}中 · StudyFlow` : 'StudyFlow 學習管理';
	}, [active, shown, label]);

	if (!active) return null;
	return (
		<button
			onClick={() => navigate('/timer')}
			className={cn(
				'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium tabular-nums',
				s.phase === 'break' ? 'bg-success-soft text-success' : 'bg-accent-soft text-accent-ink',
			)}
		>
			<TimerIcon className="size-4" aria-hidden />
			{label} {formatDuration(shown / 1000)}
			{!s.running && <span className="text-xs opacity-80">（暫停）</span>}
		</button>
	);
}

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
			{/* 桌面版側邊欄 */}
			<aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-card md:flex">
				<div className="px-5 pt-5 pb-4">
					<Logo />
				</div>
				<nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="主選單">
					{NAV.map((n) => (
						<NavLink
							key={n.to}
							to={n.to}
							end={n.end}
							className={({ isActive }) =>
								cn(
									'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
									isActive ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-subtle hover:text-ink',
								)
							}
						>
							<n.icon className="size-[18px]" aria-hidden />
							{n.label}
						</NavLink>
					))}
				</nav>
				<div className="border-t border-line p-3">
					<div className="mb-1 truncate px-3 text-sm font-medium">{user.displayName}</div>
					<div className="mb-2 truncate px-3 text-xs text-ink-3">{user.email}</div>
					<button
						onClick={logout}
						className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-ink-2 hover:bg-subtle hover:text-ink"
					>
						<LogOut className="size-4" aria-hidden />
						登出
					</button>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				{/* 頁首：手機顯示 Logo；計時中顯示剩餘時間 */}
				<header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-page/90 px-4 backdrop-blur pt-[env(safe-area-inset-top)] box-content md:border-none md:bg-transparent md:backdrop-blur-none md:px-8">
					<div className="md:hidden">
						<Logo />
					</div>
					<div className="ml-auto flex items-center gap-2">
						{!online && (
							<span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
								<WifiOff className="size-3.5" aria-hidden />
								離線中
							</span>
						)}
						<TimerPill />
					</div>
				</header>

				<main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pb-10">
					<Outlet />
				</main>
			</div>

			{/* 手機版底部導覽 */}
			<nav
				className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
				aria-label="主選單"
			>
				{NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
					<NavLink
						key={n.to}
						to={n.to}
						end={n.end}
						className={({ isActive }) =>
							cn(
								'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
								isActive ? 'text-accent-ink' : 'text-ink-3',
							)
						}
					>
						<n.icon className="size-[22px]" aria-hidden />
						{n.label.replace('學習', '').replace('與錯題', '')}
					</NavLink>
				))}
				<button
					onClick={() => setMoreOpen(true)}
					className={cn(
						'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
						moreActive ? 'text-accent-ink' : 'text-ink-3',
					)}
				>
					<Ellipsis className="size-[22px]" aria-hidden />
					更多
				</button>
			</nav>

			<Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="更多功能">
				<div className="grid grid-cols-2 gap-2">
					{moreItems.map((n) => (
						<NavLink
							key={n.to}
							to={n.to}
							onClick={() => setMoreOpen(false)}
							className={({ isActive }) =>
								cn(
									'flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm font-medium',
									isActive ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink-2',
								)
							}
						>
							<n.icon className="size-6" aria-hidden />
							{n.label}
						</NavLink>
					))}
				</div>
				<div className="mt-4 flex items-center justify-between border-t border-line pt-4">
					<div className="min-w-0">
						<div className="truncate text-sm font-medium">{user.displayName}</div>
						<div className="truncate text-xs text-ink-3">{user.email}</div>
					</div>
					<button onClick={logout} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-danger hover:bg-danger-soft">
						<LogOut className="size-4" aria-hidden />
						登出
					</button>
				</div>
			</Dialog>
		</div>
	);
}
