import { Trophy } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '../components/ui';

/** 成就與里程碑（APP-2）：Sprint 2 由 s2/shell 實作，這裡先放佔位頁 */
export function AchievementsPage() {
	return (
		<div>
			<PageHeader title="成就" />
			<Card>
				<EmptyState icon={<Trophy />} title="即將推出" description="累積讀書時數、連續天數、番茄數與掌握錯題，達到里程碑就會解鎖徽章。" />
			</Card>
		</div>
	);
}
