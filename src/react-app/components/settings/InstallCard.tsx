import { CircleCheck, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, CardHeader } from '../ui';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallCard() {
	const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
	const standalone = window.matchMedia('(display-mode: standalone)').matches;
	const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

	useEffect(() => {
		const handler = (e: Event) => {
			e.preventDefault();
			setPrompt(e as InstallPrompt);
		};
		window.addEventListener('beforeinstallprompt', handler);
		return () => window.removeEventListener('beforeinstallprompt', handler);
	}, []);

	return (
		<Card>
			<CardHeader title="安裝到手機或電腦" />
			<div className="px-4 pb-5 text-sm text-ink-2 sm:px-5">
				{standalone ? (
					<p className="flex items-center gap-2">
						<CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
						你正在使用已安裝的 StudyFlow App。
					</p>
				) : prompt ? (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p>安裝後可以從主畫面直接開啟，使用起來就像一般 App。</p>
						<Button
							variant="primary"
							onClick={async () => {
								await prompt.prompt();
								setPrompt(null);
							}}
						>
							<Download className="size-4" aria-hidden />
							安裝 App
						</Button>
					</div>
				) : ios ? (
					<p>
						在 Safari 點下方的<strong className="text-ink">「分享」</strong>按鈕，再選<strong className="text-ink">「加入主畫面」</strong>
						，就能像 App 一樣使用。
					</p>
				) : (
					<p>在 Chrome 或 Edge 的網址列右側點「安裝」圖示，或從瀏覽器選單選擇「安裝 StudyFlow」。</p>
				)}
			</div>
		</Card>
	);
}
