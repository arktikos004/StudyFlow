import { AppearanceCard } from '../components/settings/AppearanceCard';
import { DataCard } from '../components/settings/DataCard';
import { GoalsCard } from '../components/settings/GoalsCard';
import { InstallCard } from '../components/settings/InstallCard';
import { PasswordCard } from '../components/settings/PasswordCard';
import { ProfileCard } from '../components/settings/ProfileCard';
import { SubjectsCard } from '../components/settings/SubjectsCard';
import { PageHeader } from '../components/ui';

// 設定頁只負責組合卡片；每張卡片在 components/settings/，各自管理自己的狀態與資料。
// 左欄是讀書相關（科目、目標、匯出），右欄是外觀與帳號；手機依 DOM 順序由上而下排列。
export function SettingsPage() {
	return (
		<div>
			<PageHeader title="設定" />
			<div className="grid items-start gap-5 lg:grid-cols-2">
				<div className="space-y-5">
					<SubjectsCard />
					<GoalsCard />
					<DataCard />
				</div>
				<div className="space-y-5">
					<AppearanceCard />
					<ProfileCard />
					<PasswordCard />
					<InstallCard />
				</div>
			</div>
		</div>
	);
}
