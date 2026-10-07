import { ChevronRight, Flame, Hourglass, ListChecks, Trophy, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { ProfileSummary } from '../../../shared/api-types';
import { badgeRowCapacity, formatCount, masteredNote, sessionsNote, streakNote, studyTotal } from '../../lib/profile-format';
import { AchievementIcon } from '../../lib/shell-icons';
import { cn, MoreLink, Unit } from '../ui';

/** 一格數字：dt（圖示＋標籤）、dd 數值（font-num 28px／600）、dd 副標。第二格起的左框與第二列的上框都是分隔線 */
function Cell({
	icon: Icon,
	label,
	children,
	note,
	className,
}: {
	icon: LucideIcon;
	label: ReactNode;
	children: ReactNode;
	note: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn('flex min-w-0 flex-col border-t border-l border-line px-4 py-3.5 sm:px-5 sm:py-4', className)}>
			<dt className="flex min-w-0 items-center gap-1.5 text-sm text-ink-2">
				<Icon className="size-4 shrink-0" aria-hidden />
				{label}
			</dt>
			<dd className="mt-1 font-num text-num-lg font-semibold tabular-nums">{children}</dd>
			<dd className="mt-1 text-meta text-ink-3">{note}</dd>
		</div>
	);
}

/** 載入中的占位：和數值、副標同高，載入完不會跳動 */
const ValueSkeleton = () => (
	<>
		<span aria-hidden className="block h-[1.925rem] py-1">
			<span className="block h-full w-16 rounded-md bg-subtle" />
		</span>
		<span className="sr-only">載入中</span>
	</>
);
const NoteSkeleton = () => (
	<span aria-hidden className="block h-[1.21875rem] py-1">
		<span className="block h-full w-24 rounded-sm bg-subtle" />
	</span>
);

type RowSpace = { width: number; rootFontSize: number };

/**
 * 量出徽章列實際的寬度與 <html> 的字級（徽章的尺寸是 rem）。
 * - 在 layout effect 裡先同步量一次：React 會在畫面繪製前用量到的值重新 render，第一個畫面就是對的
 *   （ResizeObserver 回呼裡的 setState 要到下一輪才 render，第一個畫面會是估計值，窄手機上會多放一顆而溢出）。
 * - 之後跟著 ResizeObserver 更新；值沒變就沿用同一個物件，不多 render。
 */
function useRowSpace<T extends HTMLElement>(enabled: boolean) {
	const ref = useRef<T>(null);
	const [space, setSpace] = useState<RowSpace | null>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!enabled || !el) return;
		const measure = () => {
			const width = el.clientWidth;
			const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
			setSpace((prev) => (prev && prev.width === width && prev.rootFontSize === rootFontSize ? prev : { width, rootFontSize }));
		};
		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [enabled]);
	return [ref, space] as const;
}

/**
 * 已解鎖的徽章：和成就頁一樣是藍筆塗滿的章（accent 底、on-accent 圖示、外圈 accent-soft），縮小成 28px。
 * 照 API 的順序：最近解鎖的在前（PRO-2）。一列放不下時最後一格是「+N」，收起的是最舊的那幾個。
 * 徽章名稱給螢幕報讀器（sr-only），看得到的人點整格到成就頁看名稱。
 */
function BadgeRow({ badges }: { badges: ProfileSummary['achievements']['badges'] }) {
	const [ref, space] = useRowSpace<HTMLUListElement>(badges.length > 0);
	// 沒有徽章時的文字和徽章列同高（28px），載入完、解鎖第一個時都不會跳動
	if (!badges.length) return <p className="flex min-h-7 items-center text-meta text-ink-3">還沒有解鎖的徽章</p>;
	// 第一次 render 還沒量到：先用最窄的估計（只會存在於繪製前的那一次 render，畫面上看不到）
	const shown = badges.slice(0, badgeRowCapacity(space?.width ?? 0, badges.length, space?.rootFontSize ?? 16));
	const rest = badges.length - shown.length;
	return (
		<ul ref={ref} aria-label="已解鎖的徽章，最近解鎖的在前" className="flex items-center gap-2">
			{shown.map((b) => (
				<li key={b.id} className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-on-accent ring-2 ring-accent-soft">
					<AchievementIcon name={b.icon} className="size-3.5" strokeWidth={2.25} aria-hidden />
					<span className="sr-only">{b.title}</span>
				</li>
			))}
			{rest > 0 && (
				<li className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-card px-1.5 font-num text-caption leading-none font-semibold text-ink-2 tabular-nums ring-1 ring-line-strong ring-inset">
					<span aria-hidden>+{rest}</span>
					<span className="sr-only">還有 {rest} 個</span>
				</li>
			)}
		</ul>
	);
}

/**
 * 成就那一格：整格是連到成就頁的連結（標籤的 ::after 蓋滿這一格，焦點框畫在 ::after、內縮 2px，卡片的 overflow-hidden 不會裁掉）。
 * 數值念成「已解鎖 3 個，共 12 個」，畫面上是「3／12 個」。
 */
function AchievementsCell({ achievements }: { achievements: ProfileSummary['achievements'] | undefined }) {
	return (
		<div className="relative flex min-w-0 flex-col border-t border-l border-line px-4 py-3.5 transition-colors duration-120 ease-out hover:bg-subtle sm:px-5 sm:py-4">
			<dt className="flex min-w-0 items-center gap-1.5 text-sm text-ink-2">
				<Trophy className="size-4 shrink-0" aria-hidden />
				<Link
					to="/achievements"
					// 這一格永遠在卡片的右下角（2×2 與一列 4 格都是）：::after 的右下角跟著卡片的內圓角（xl − 1px 邊框），焦點框才不會被裁掉
					className="min-w-0 truncate after:absolute after:inset-0 after:rounded-br-[calc(var(--radius-xl)-1px)] focus-visible:outline-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
				>
					成就<span className="sr-only">，查看全部成就</span>
				</Link>
				<ChevronRight className="ml-auto size-4 shrink-0 text-ink-3" aria-hidden />
			</dt>
			<dd className="mt-1 font-num text-num-lg font-semibold tabular-nums">
				{achievements ? (
					<>
						<span aria-hidden>
							{formatCount(achievements.unlocked)}
							<span className="ml-0.5 text-h3 font-normal text-ink-3">／{formatCount(achievements.total)}</span>
							<Unit>個</Unit>
						</span>
						<span className="sr-only">
							已解鎖 {achievements.unlocked} 個，共 {achievements.total} 個
						</span>
					</>
				) : (
					<ValueSkeleton />
				)}
			</dd>
			<dd className="mt-2">
				{achievements ? <BadgeRow badges={achievements.badges} /> : <span aria-hidden className="block h-7 w-24 rounded-full bg-subtle" />}
			</dd>
		</div>
	);
}

/**
 * 個人檔案的累積數字（純展示）：學習累積、連續天數、完成量、成就。
 * 放在個人檔案卡片裡、用分隔線分格（卡片裡不放卡片）：手機 2×2，lg 以上一列 4 格。外層卡片要 overflow-hidden（藏起最左邊多出來的框）。
 * summary 是 undefined 時顯示占位（載入中），格子與標籤不變，載入完不會跳動。
 * 還沒有學習紀錄時，「學習累積」的副標換成下一步：開始第一次專注。
 */
export function ProfileStats({ summary }: { summary: ProfileSummary | undefined }) {
	const total = summary && studyTotal(summary.totalMinutes);
	return (
		<dl aria-busy={!summary || undefined} className="-ml-px grid grid-cols-2 lg:grid-cols-4">
			<Cell
				icon={Hourglass}
				label="學習累積"
				note={
					!summary ? (
						<NoteSkeleton />
					) : summary.totalSessions > 0 ? (
						sessionsNote(summary.totalSessions)
					) : (
						<MoreLink to="/timer">開始第一次專注</MoreLink>
					)
				}
			>
				{total ? (
					<>
						{total.value}
						<Unit>{total.unit}</Unit>
					</>
				) : (
					<ValueSkeleton />
				)}
			</Cell>
			<Cell icon={Flame} label="連續天數" note={summary ? streakNote(summary.currentStreak, summary.longestStreak) : <NoteSkeleton />}>
				{summary ? (
					<>
						{formatCount(summary.currentStreak)}
						<Unit>天</Unit>
					</>
				) : (
					<ValueSkeleton />
				)}
			</Cell>
			<Cell icon={ListChecks} label="完成量" note={summary ? masteredNote(summary.mistakesMastered) : <NoteSkeleton />}>
				{summary ? (
					<>
						{formatCount(summary.tasksDone)}
						<Unit>個任務</Unit>
					</>
				) : (
					<ValueSkeleton />
				)}
			</Cell>
			<AchievementsCell achievements={summary?.achievements} />
		</dl>
	);
}
