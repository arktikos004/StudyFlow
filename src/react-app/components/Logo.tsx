import { Link } from 'react-router';

/** S 的筆畫（藍筆一筆寫成），LogoMark 與 public/logo.svg 共用同一條路徑 */
const S_PATH =
	'M43 18.5c-2.8-2.6-6.6-3.9-10.7-3.9-6.6 0-11 3.5-11 8.4 0 11.2 22.4 7 22.4 18 0 5.3-4.9 9.2-11.6 9.2-4.6 0-8.6-1.6-11.3-4.5';

/**
 * 品牌標誌：一筆寫成的 S 加上一道螢光筆。顏色用 index.css 的 --logo-* token：
 * - 淺色：主題色的底、紙色的 S（白天在紙上，標誌是一塊藍筆色）。
 * - 深色：紙色的底、深藍（accent-soft）的 S，晚上反過來，像紙上的藍筆字。
 * 螢光筆是固定的黃色，只在標誌裡出現。S 外圈描一圈底色，壓在螢光筆上時邊緣仍然清楚。
 * public/logo.svg（PWA 圖示、favicon）是淺色版的固定色。
 */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 64" className={className} aria-hidden>
			<rect width="64" height="64" rx="16" fill="var(--logo-tile)" />
			<path d="M11 35.5 51 29.5 53 40.5 13 46.5Z" fill="var(--logo-mark)" />
			<path d={S_PATH} fill="none" stroke="var(--logo-tile)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
			<path d={S_PATH} fill="none" stroke="var(--logo-ink)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function Logo() {
	return (
		<Link to="/" className="inline-flex items-center gap-2.5 rounded-lg" aria-label="StudyFlow 首頁">
			<LogoMark />
			<span className="text-[17px] font-bold tracking-tight">StudyFlow</span>
		</Link>
	);
}
