import { Pencil } from 'lucide-react';
import type { ProfileSummary, PublicUser } from '../../../shared/api-types';
import { joinedLabel } from '../../lib/profile-format';
import { Avatar, Button, Card, ErrorNote } from '../ui';
import { EmailText } from './ProfileEmail';
import { ProfileStats } from './ProfileStats';

/**
 * 設定頁最上面的個人檔案（PRO-1，純展示）：頭像、暱稱、Email、加入時間，下面是累積數字。
 * - 暱稱是這張卡的 h2（前面有 sr-only「個人檔案：」），頭像是裝飾（旁邊就有暱稱）。
 * - 「編輯個人資料」是 secondary：設定頁只有一個 primary（讀書目標的「儲存」），對話框裡的「儲存」才是 primary。
 *   手機撐滿寬度、放在暱稱下面；sm 以上靠右。
 * - 數字載入失敗時換成 ErrorNote（可以重新載入），頭像與暱稱照常顯示。
 */
export function ProfileHeader({
	user,
	avatarSrc,
	summary,
	error,
	onRetry,
	retrying,
	onEdit,
}: {
	user: PublicUser;
	avatarSrc: string | null;
	/** 累積數字；undefined 代表載入中（顯示占位） */
	summary: ProfileSummary | undefined;
	error?: unknown;
	onRetry?: () => void;
	retrying?: boolean;
	onEdit: () => void;
}) {
	const joined = joinedLabel(user.createdAt, user.timezone);
	return (
		<Card className="overflow-hidden">
			<div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
				<div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
					<Avatar name={user.displayName} src={avatarSrc} size="lg" />
					<div className="min-w-0">
						<h2 className="text-[1.25rem] leading-[1.4] font-bold text-balance [overflow-wrap:anywhere]">
							<span className="sr-only">個人檔案：</span>
							{user.displayName}
						</h2>
						<p className="mt-0.5 text-sm text-ink-2 [overflow-wrap:anywhere]">
							<EmailText email={user.email} />
						</p>
						<p className="text-meta text-ink-3">
							<time dateTime={joined.dateTime}>{joined.text}</time>
						</p>
					</div>
				</div>
				<Button onClick={onEdit} aria-haspopup="dialog" className="w-full sm:w-auto">
					<Pencil className="size-4" aria-hidden />
					編輯個人資料
				</Button>
			</div>
			{error ? (
				<div className="border-t border-line p-4 sm:px-5">
					<ErrorNote error={error} onRetry={onRetry} retrying={retrying} />
				</div>
			) : (
				<ProfileStats summary={summary} />
			)}
		</Card>
	);
}
