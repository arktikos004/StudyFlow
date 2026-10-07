import { CalendarArrowDown, Download, FileJson, FileSpreadsheet, ListChecks } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { exportUrl, type ExportFile } from '../../lib/api';
import { useUser } from '../../lib/queries';
import { Card, CardHeader, Checkbox } from '../ui';

/** 一個匯出檔：同源的 <a download>（會帶登入 cookie），檔名由伺服器的 Content-Disposition 決定 */
function ExportLink({
	file,
	params,
	icon,
	title,
	description,
	describedBy,
}: {
	file: ExportFile;
	params?: Record<string, string | number | undefined>;
	icon: ReactNode;
	title: string;
	description: string;
	describedBy?: string;
}) {
	return (
		<a
			href={exportUrl(file, params)}
			download
			aria-describedby={describedBy}
			className="flex min-h-14 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-120 ease-out hover:bg-subtle"
		>
			<span className="shrink-0 text-ink-2 [&_svg]:size-5" aria-hidden>
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-dense text-ink">{title}</span>
				<span className="block text-meta text-ink-3">{description}</span>
			</span>
			<Download className="size-4 shrink-0 text-ink-3" aria-hidden />
		</a>
	);
}

/** 匯出與備份（DATA-1、CAL-2）：JSON 備份、學習紀錄與任務 CSV、.ics 行事曆（可選擇包含任務期限） */
export function DataCard() {
	const user = useUser();
	const [withTasks, setWithTasks] = useState(false);
	const calendarNoteId = useId();

	return (
		<Card>
			<CardHeader title="匯出與備份" />
			<p className="px-4 pb-2 text-sm text-ink-2 sm:px-5">
				下載自己的資料，用來備份、用試算表分析，或匯入其他行事曆。檔案裡的時間依你的時區（{user.timezone}）。
			</p>
			<ul className="space-y-0.5 px-1 pb-3 sm:px-2">
				<li>
					<ExportLink
						file="backup.json"
						icon={<FileJson />}
						title="下載完整備份"
						description="JSON，含科目、考試、任務、學習紀錄與筆記；照片只含檔案資訊，不含圖片"
					/>
				</li>
				<li>
					<ExportLink
						file="sessions.csv"
						icon={<FileSpreadsheet />}
						title="下載學習紀錄"
						description="CSV，可用 Excel 或 Google 試算表開啟"
					/>
				</li>
				<li>
					<ExportLink file="tasks.csv" icon={<ListChecks />} title="下載任務清單" description="CSV，含期限、優先度、預估與已投入時間" />
				</li>
				<li>
					<ExportLink
						file="calendar.ics"
						params={{ tasks: withTasks ? 1 : undefined }}
						icon={<CalendarArrowDown />}
						title="下載行事曆"
						description=".ics，所有考試與截止日；匯入 Google 日曆後，考試前一天會提醒"
						describedBy={calendarNoteId}
					/>
					<div className="pl-11 sm:pl-12">
						<Checkbox checked={withTasks} onChange={setWithTasks} label="行事曆也包含任務期限" />
						<p id={calendarNoteId} className="sr-only">
							{withTasks ? '會包含任務期限，有期限的任務會變成全天事件' : '不包含任務期限'}
						</p>
					</div>
				</li>
			</ul>
		</Card>
	);
}
