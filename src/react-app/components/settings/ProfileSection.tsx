import { useState } from 'react';
import { avatarUrl } from '../../lib/api';
import { useProfileSummary, useUser } from '../../lib/queries';
import { ProfileDialog } from './ProfileDialog';
import { ProfileHeader } from './ProfileHeader';

/** 設定頁最上面的個人檔案（PRO-1）：資料與對話框的狀態在這裡，外觀在 ProfileHeader／ProfileStats */
export function ProfileSection() {
	const user = useUser();
	const summary = useProfileSummary();
	const [editing, setEditing] = useState(false);
	const avatarSrc = avatarUrl(user);
	return (
		<>
			<ProfileHeader
				user={user}
				avatarSrc={avatarSrc}
				summary={summary.data}
				// 已經有數字時，背景重新整理失敗就繼續顯示舊的數字
				error={summary.data ? undefined : summary.error}
				onRetry={() => void summary.refetch()}
				retrying={summary.isRefetching}
				onEdit={() => setEditing(true)}
			/>
			<ProfileDialog open={editing} onClose={() => setEditing(false)} user={user} avatarSrc={avatarSrc} />
		</>
	);
}
