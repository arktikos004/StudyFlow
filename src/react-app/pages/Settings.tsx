import { AppearanceCard } from '../components/settings/AppearanceCard';
import { InstallCard } from '../components/settings/InstallCard';
import { PasswordCard } from '../components/settings/PasswordCard';
import { ProfileCard } from '../components/settings/ProfileCard';
import { SubjectsCard } from '../components/settings/SubjectsCard';
import { PageHeader } from '../components/ui';

// 設定頁只負責組合卡片；每張卡片在 components/settings/，各自管理自己的狀態與資料
export function SettingsPage() {
	return (
		<div>
			<PageHeader title="設定" />
			<div className="grid gap-5 lg:grid-cols-2">
				<div className="space-y-5">
					<SubjectsCard />
					<AppearanceCard />
					<InstallCard />
				</div>
				<div className="space-y-5">
					<ProfileCard />
					<PasswordCard />
				</div>
			</div>
		</div>
	);
}
