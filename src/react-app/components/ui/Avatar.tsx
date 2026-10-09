import { UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { firstGrapheme } from '../../lib/format';
import { cn } from './cn';

// 頭像：有照片顯示照片，沒有時顯示名字的第一個字

/** 頭像尺寸：sm 32px（側欄）、md 40px（手機選單）、lg 72px（個人檔案）、xl 96px（編輯對話框的預覽） */
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const AVATAR: Record<AvatarSize, { box: string; px: number }> = {
	sm: { box: 'size-8 text-sm', px: 32 },
	md: { box: 'size-10 text-[1.0625rem]', px: 40 },
	lg: { box: 'size-18 text-[1.875rem]', px: 72 },
	xl: { box: 'size-24 text-[2.5rem]', px: 96 },
};

/** 暱稱的第一個字素（emoji、組合字不會被切半）；拉丁字母轉大寫，但轉完變成不同長度的（例如 ß）保留原樣 */
function avatarInitial(name: string): string {
	const g = firstGrapheme(name);
	const upper = g.toUpperCase();
	return upper.length === g.length ? upper : g;
}

/**
 * 頭像（圓形）。有照片時顯示照片（object-cover，邊緣一圈 ink 10% 的細線，白底照片在紙色上也有邊）；
 * 沒有照片、或照片載入失敗（例如離線）時，顯示暱稱的第一個字素：主題色底、on-accent 字（6 組主題色淺深色都 ≥ 6:1）。
 * - 照片載入中是 subtle 底，不會先閃一下首字；失敗才換成首字。src 換了（例如上傳新照片）或連回網路（online 事件）時會重新載入。
 * - 頭像是裝飾（aria-hidden）：用到的地方旁邊都有暱稱文字。要單獨出現時再加無障礙名稱。
 */
export function Avatar({
	name,
	src,
	size = 'md',
}: {
	/** 暱稱：沒有照片或照片載入失敗時顯示第一個字素 */
	name: string;
	/** 照片網址（例如 avatarUrl(user)、預覽用的 blob: 網址）；null 或省略就顯示首字 */
	src?: string | null;
	size?: AvatarSize;
}) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	// 載入失敗多半是暫時的（離線）：連回網路時再試一次。側欄的頭像整個工作階段都掛著，
	// 不重試的話會一直顯示首字，和設定頁新掛上去的頭像不一致。
	useEffect(() => {
		if (!failedSrc) return;
		const retry = () => setFailedSrc(null);
		window.addEventListener('online', retry);
		return () => window.removeEventListener('online', retry);
	}, [failedSrc]);
	const photo = src && src !== failedSrc ? src : null;
	const { box, px } = AVATAR[size];
	const initial = avatarInitial(name);
	return (
		<span
			aria-hidden
			className={cn(
				'inline-grid shrink-0 place-items-center overflow-hidden rounded-full leading-none font-semibold select-none',
				box,
				photo ? 'bg-subtle' : 'bg-accent text-on-accent',
			)}
		>
			{photo ? (
				<img
					src={photo}
					alt=""
					width={px}
					height={px}
					decoding="async"
					draggable={false}
					onError={() => setFailedSrc(photo)}
					className="size-full rounded-full object-cover outline-1 -outline-offset-1 outline-ink/10"
				/>
			) : (
				initial || <UserRound className="size-1/2" strokeWidth={2} />
			)}
		</span>
	);
}
