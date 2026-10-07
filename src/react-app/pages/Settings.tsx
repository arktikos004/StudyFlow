import { AccountCard } from '../components/settings/AccountCard';
import { AppearanceCard } from '../components/settings/AppearanceCard';
import { DataCard } from '../components/settings/DataCard';
import { GoalsCard } from '../components/settings/GoalsCard';
import { InstallCard } from '../components/settings/InstallCard';
import { ProfileSection } from '../components/settings/ProfileSection';
import { SubjectsCard } from '../components/settings/SubjectsCard';
import { PageHeader, PageStack } from '../components/ui';

// 設定頁只負責組合卡片；每張卡片在 components/settings/，各自管理自己的狀態與資料。
// 最上面是整頁寬的個人檔案（PRO-1）；下面左欄是讀書相關（科目、目標、匯出），右欄是外觀與帳號；手機依 DOM 順序由上而下排列。
export function SettingsPage() {
	return (
		<div>
			<PageHeader title="設定" />
			<PageStack>
				<ProfileSection />
				{/* 欄用 min-w-0：很長的科目名稱（nowrap 截斷）不會把格線欄撐寬，手機上整頁不會水平捲動 */}
				<div className="grid items-start gap-section lg:grid-cols-2">
					<PageStack className="min-w-0">
						<SubjectsCard />
						<GoalsCard />
						<DataCard />
					</PageStack>
					<PageStack className="min-w-0">
						<AppearanceCard />
						<AccountCard />
						<InstallCard />
					</PageStack>
				</div>
			</PageStack>
		</div>
	);
}
