import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Command, Ellipsis, LogOut, Search, Trophy, WifiOff } from 'lucide-react';
import { createElement, lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAchievements, useSummary, useUser } from '../lib/queries';
import { diffUnlocked, parseSeen, seenKey } from '../lib/shell-achievements';
import { achievementIcon } from '../lib/shell-icons';
import { badgeLabel, navBadges, type NavBadge } from '../lib/shell-nav';
import { isApplePlatform, isPaletteShortcut } from '../lib/shell-palette';
import { useTimerEngine } from '../lib/timer';
import { Logo } from './Logo';
import { MOBILE_MAIN, NAV, NAV_GROUPS, type NavItem } from './nav';
import { TimerNavIcon, TimerPill } from './TimerPill';
import { Button, cn, Dialog, Kbd } from './ui';

// 指令面板會用到科目元件與 zod（搜尋字數上限），分開打包：第一次打開時才下載，閒置時先預載
const loadPalette = () => import('./CommandPalette');
const CommandPalette = lazy(() => loadPalette().then((m) => ({ default: m.CommandPalette })));

const APPLE = typeof navigator !== 'undefined' && isApplePlatform(navigator.platform || navigator.userAgent);
const SHORTCUT_ARIA = APPLE ? 'Meta+K' : 'Control+K';

const isEditable = (t: EventTarget | null) =>
	t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

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

/** 換頁（路徑改變）時回到頁面頂端；上一頁／下一頁（POP）交給瀏覽器還原；只改網址參數（篩選、?open=）不捲動 */
function useScrollTopOnNavigate() {
	const { pathname } = useLocation();
	const navType = useNavigationType();
	const prev = useRef(pathname);
	useEffect(() => {
		if (prev.current !== pathname && navType !== 'POP') window.scrollTo(0, 0);
		prev.current = pathname;
	}, [pathname, navType]);
}

/**
 * 新解鎖的成就由全站層級跳一次 toast（APP-2）。已看過的成就記在 localStorage（依使用者分開）：
 * - 第一次使用（還沒有紀錄）：靜默記下目前已解鎖的，不跳。
 * - 已看過的只增不減：徽章被收回後再解鎖不會再跳。
 * localStorage 讀寫失敗（無痕模式等）時改記在記憶體，同一次使用不會重複跳。
 */
function useAchievementToasts() {
	const user = useUser();
	const navigate = useNavigate();
	const { data, isSuccess } = useAchievements();
	const memory = useRef(new Map<string, string[]>());

	useEffect(() => {
		if (!isSuccess || !data) return;
		const key = seenKey(user.id);
		let stored: string[] | null = null;
		try {
			stored = parseSeen(localStorage.getItem(key));
		} catch {
			// 讀不到就只用記憶體裡的紀錄
		}
		const mem = memory.current.get(key) ?? null;
		const seen = stored === null && mem === null ? null : [...new Set([...(stored ?? []), ...(mem ?? [])])];
		const { announce, next } = diffUnlocked(
			seen,
			data.filter((a) => a.unlocked).map((a) => a.id),
		);
		memory.current.set(key, next);
		if (seen === null || announce.length) {
			try {
				localStorage.setItem(key, JSON.stringify(next));
			} catch {
				// 忽略：這次使用期間由記憶體避免重複
			}
		}
		if (!announce.length) return;

		const items = data.filter((a) => announce.includes(a.id));
		const single = items.length === 1 ? items[0] : null;
		toast(single ? `解鎖成就「${single.title}」` : `解鎖 ${items.length} 個成就`, {
			description: single ? single.description : items.map((a) => a.title).join('、'),
			icon: createElement(single ? achievementIcon(single.icon) : Trophy, {
				className: 'size-[18px] text-accent-ink',
				'aria-hidden': true,
			}),
			action: { label: '查看', onClick: () => navigate('/achievements') },
			duration: 8000,
		});
	}, [data, isSuccess, user.id, navigate]);
}

/**
 * 導覽的數量標籤（只有外觀，aria-hidden）。報讀用的說明（「，3 項待處理」）由呼叫端用 BadgeText 接在項目名稱後面，
 * 無障礙名稱才會是「學習任務，3 項待處理」而不是數字在前。
 */
function CountBadge({ badge, solid }: { badge: NavBadge; solid?: boolean }) {
	return (
		<span
			// 數字改變時重新掛載，播一次 pop-in（reduced motion 時只淡入），讓「完成一項，數字減一」看得到
			key={badge.count}
			aria-hidden
			className={cn(
				'inline-flex h-5 min-w-5 animate-pop-in items-center justify-center rounded-full px-1.5 font-num text-caption leading-none font-semibold tabular-nums',
				solid
					? cn('text-on-accent ring-2 ring-card', badge.tone === 'danger' ? 'bg-danger' : 'bg-warning')
					: badge.tone === 'danger'
						? 'bg-danger-soft text-danger'
						: 'bg-warning-soft text-warning',
			)}
		>
			{badgeLabel(badge.count)}
		</span>
	);
}

const BadgeText = ({ badge }: { badge?: NavBadge }) => (badge ? <span className="sr-only">{badge.srText}</span> : null);

/** 側欄的一項：目前頁面用 accent-soft 底、字重 600、較粗的圖示；右側是數量標籤 */
function SideLink({ item, badge }: { item: NavItem; badge?: NavBadge }) {
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
					<span className="min-w-0 flex-1 truncate">
						{item.label}
						<BadgeText badge={badge} />
					</span>
					{badge && <CountBadge badge={badge} />}
				</>
			)}
		</NavLink>
	);
}

/** 手機底部導覽的一格：實心底，目前頁面在圖示後面加上膠囊底（由中間展開）；數量標籤在圖示右上角 */
function TabItem({
	icon: Icon,
	label,
	active,
	timer,
	badge,
}: {
	icon: NavItem['icon'];
	label: string;
	active: boolean;
	timer?: boolean;
	badge?: NavBadge;
}) {
	return (
		<>
			<span
				data-active={active || undefined}
				className={cn('sf-tab-pill flex h-8 w-14 items-center justify-center', active && 'text-accent-ink')}
			>
				{timer ? (
					<TimerNavIcon icon={Icon} active={active} />
				) : (
					<Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
				)}
				{badge && (
					<span className="absolute -top-1.5 left-[calc(50%+3px)]">
						<CountBadge badge={badge} solid />
					</span>
				)}
			</span>
			<span>
				{label}
				<BadgeText badge={badge} />
			</span>
		</>
	);
}

const tabClass = (active: boolean) =>
	cn(
		'flex h-16 w-full flex-col items-center justify-center gap-1 text-xs transition-colors duration-180 ease-out',
		active ? 'font-semibold text-ink' : 'text-ink-2',
	);

export function Layout() {
	useTimerEngine();
	useScrollTopOnNavigate();
	useAchievementToasts();
	const user = useUser();
	const logout = useLogout();
	const online = useOnline();
	const location = useLocation();
	const [moreOpen, setMoreOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const badges = navBadges(useSummary().data);

	const moreItems = NAV.filter((n) => !MOBILE_MAIN.includes(n.to));
	const moreActive = moreItems.some((n) => location.pathname.startsWith(n.to));

	const openPalette = useCallback(() => setPaletteOpen(true), []);
	const closePalette = useCallback(() => setPaletteOpen(false), []);

	// Ctrl/⌘K：任何頁面都能開關指令面板。其他對話框開著時不開（離開頁面會遺失表單內容）。
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.repeat || e.isComposing || !isPaletteShortcut(e, APPLE, isEditable(e.target))) return;
			e.preventDefault();
			if (paletteOpen) setPaletteOpen(false);
			else if (!document.querySelector('dialog[open]')) setPaletteOpen(true);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [paletteOpen]);

	// 閒置時先下載指令面板，第一次按 Ctrl/⌘K 就不必等
	useEffect(() => {
		const t = setTimeout(() => void loadPalette().catch(() => {}), 3000);
		return () => clearTimeout(t);
	}, []);
	const preload = () => void loadPalette().catch(() => {});

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
				<div className="px-5 pt-5 pb-4">
					<Logo />
				</div>
				<div className="px-3 pb-4">
					<button
						type="button"
						onClick={openPalette}
						onPointerEnter={preload}
						onFocus={preload}
						aria-haspopup="dialog"
						aria-keyshortcuts={SHORTCUT_ARIA}
						className="flex h-9 w-full items-center gap-2.5 rounded-lg border border-line bg-card px-3 text-sm text-ink-3 shadow-sm transition-colors duration-120 ease-out hover:border-line-strong hover:text-ink-2 pointer-coarse:h-11"
					>
						<Search className="size-4 shrink-0" aria-hidden />
						<span className="flex-1 text-left">搜尋</span>
						<span className="inline-flex gap-0.5" aria-hidden>
							<Kbd>{APPLE ? <Command className="size-3" /> : 'Ctrl'}</Kbd>
							<Kbd>K</Kbd>
						</span>
					</button>
				</div>
				<nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="主選單">
					{NAV_GROUPS.map((group, i) => (
						<ul key={i} className={cn('space-y-0.5', i > 0 && 'mt-5')}>
							{group.map((n) => (
								<li key={n.to}>
									<SideLink item={n} badge={badges[n.to]} />
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
				{/* 頁首：手機顯示 Logo 與搜尋按鈕；離線提示；計時中顯示剩餘時間 */}
				<header className="sticky top-0 z-20 box-content flex h-14 items-center justify-between gap-3 border-b border-line bg-page px-4 pt-[env(safe-area-inset-top)] md:border-none md:px-8">
					<div className="md:hidden">
						<Logo />
					</div>
					<div className="ml-auto flex items-center gap-2">
						{!online && (
							<span
								role="status"
								className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning"
							>
								<WifiOff className="size-3.5" aria-hidden />
								離線中
							</span>
						)}
						<TimerPill />
						<Button
							variant="ghost"
							size="icon"
							onClick={openPalette}
							onPointerEnter={preload}
							aria-label="搜尋"
							aria-haspopup="dialog"
							aria-keyshortcuts={SHORTCUT_ARIA}
							className="-mr-2 md:hidden"
						>
							<Search className="size-5" aria-hidden />
						</Button>
					</div>
				</header>

				<main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 outline-none md:px-8 md:pb-10">
					<Outlet />
				</main>
			</div>

			{/* 手機版底部導覽：實心底，目前頁面加上膠囊底 */}
			<nav
				className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
				aria-label="主選單"
			>
				<ul className="grid grid-cols-5">
					{NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
						<li key={n.to}>
							<NavLink to={n.to} end={n.end} className={({ isActive }) => tabClass(isActive)}>
								{({ isActive }) => (
									<TabItem icon={n.icon} label={n.short ?? n.label} active={isActive} timer={n.to === '/timer'} badge={badges[n.to]} />
								)}
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
										<span className="flex-1">
											{n.label}
											<BadgeText badge={badges[n.to]} />
										</span>
										{badges[n.to] && <CountBadge badge={badges[n.to]} />}
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

			{paletteOpen && (
				<Suspense fallback={null}>
					<CommandPalette onClose={closePalette} />
				</Suspense>
			)}
		</div>
	);
}
