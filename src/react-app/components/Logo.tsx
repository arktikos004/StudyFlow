import { Link } from 'react-router';

export function LogoMark({ className = 'size-8' }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 64" className={className} aria-hidden>
			<rect width="64" height="64" rx="16" fill="#2a78d6" />
			<path d="M18 22c0-2.2 1.8-4 4-4h9v28h-9a4 4 0 0 1-4-4V22Z" fill="#fff" opacity=".95" />
			<path d="M33 18h9c2.2 0 4 1.8 4 4v20a4 4 0 0 1-4 4h-9V18Z" fill="#fff" opacity=".7" />
			<path d="M23 27h4M23 32h4M37 27h4" stroke="#2a78d6" strokeWidth="2.5" strokeLinecap="round" />
		</svg>
	);
}

export function Logo() {
	return (
		<Link to="/" className="inline-flex items-center gap-2.5" aria-label="StudyFlow 首頁">
			<LogoMark />
			<span className="text-[17px] font-bold tracking-tight">StudyFlow</span>
		</Link>
	);
}
