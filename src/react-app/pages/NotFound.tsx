import { Link } from 'react-router';
import { usePageTitle } from '../lib/document-title';

/** 網址對不到任何頁面（在版面裡顯示，側欄與頁首還在） */
export function NotFound() {
	usePageTitle('找不到這個頁面');
	return (
		<div className="py-16 text-center">
			<p className="text-5xl font-bold text-ink-3" aria-hidden>
				404
			</p>
			{/* 頁面標題（螢幕報讀器用標題找到這一頁在說什麼）；樣式和原本的說明文字一樣 */}
			<h1 className="mt-3 text-ink-2">找不到這個頁面</h1>
			<Link to="/" className="mt-4 inline-block text-accent-ink hover:underline">
				回到總覽
			</Link>
		</div>
	);
}
