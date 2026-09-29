import { BookOpen } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '../components/ui';

/** 單科總覽（SUB-3）：Sprint 2 由 s2/subjects 實作，這裡先放佔位頁 */
export function SubjectPage() {
	return (
		<div>
			<PageHeader title="科目總覽" />
			<Card>
				<EmptyState icon={<BookOpen />} title="即將推出" description="這裡會整理這一科的考試、待辦、讀書時間與錯題。" />
			</Card>
		</div>
	);
}
