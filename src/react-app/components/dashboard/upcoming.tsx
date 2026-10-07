import { CalendarDays, Plus } from 'lucide-react';
import { Link } from 'react-router';
import type { EventItem } from '../../../shared/api-types';
import { formatDate } from '../../lib/format';
import { EVENT_KIND_LABEL } from '../../../shared/labels';
import { useUser } from '../../lib/account-queries';
import { CountdownTile } from '../countdown';
import { SubjectTag } from '../subjects';
import { Button, Card, CardHeader, EmptyState } from '../ui';
import { PrepProgress } from './exams';
import { useSubjectMark } from './hooks';

/** 總覽的「即將到來」：考試與截止日、準備任務的完成數與進度條（DASH-1），點一下到考試頁開啟該項目 */
export function UpcomingCard({
	events,
	today,
	onNew,
	hasNextExam,
}: {
	events: EventItem[];
	today: string;
	onNew: () => void;
	hasNextExam: boolean;
}) {
	const markOf = useSubjectMark();
	const { timezone } = useUser();
	return (
		<Card>
			<CardHeader
				title="即將到來"
				icon={CalendarDays}
				action={
					<Button size="icon" variant="ghost" onClick={onNew} aria-label="新增考試或截止日">
						<Plus className="size-5" aria-hidden />
					</Button>
				}
			/>
			{events.length ? (
				<ul className="space-y-0.5 px-2 pb-2 sm:px-3 sm:pb-3">
					{events.map((e) => (
						<li key={e.id}>
							<Link
								to={`/events?open=${e.id}`}
								className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors duration-120 ease-out hover:bg-subtle"
							>
								{/* 倒數的規則與文案全站統一（components/countdown.tsx）：今天、明天、N 天後；3 天內的考試紅色＋鬧鐘 */}
								<CountdownTile kind={e.kind} date={e.date} today={today} timeZone={timezone} size="sm" className="w-[4.75rem]" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-dense text-ink">{e.title}</p>
									<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-3">
										<span>{EVENT_KIND_LABEL[e.kind]}</span>
										<span className="font-num tabular-nums">
											{formatDate(e.date)}
											{e.time && ` ${e.time}`}
										</span>
										<SubjectTag subjectId={e.subjectId} />
									</div>
									{e.taskTotal > 0 ? (
										<PrepProgress event={e} color={markOf(e.subjectId)} size="sm" className="mt-2" />
									) : (
										e.kind === 'exam' && <p className="mt-1 text-meta text-ink-3">還沒有準備任務</p>
									)}
								</div>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<EmptyState
					variant="inline"
					className="pb-4 sm:pb-5"
					title={hasNextExam ? '之後沒有其他考試或截止日' : '近期沒有考試或截止日'}
					description={hasNextExam ? undefined : '新增後會幫你倒數'}
					action={
						<Button size="sm" variant="ghost" onClick={onNew}>
							<Plus className="size-4" aria-hidden />
							新增考試或截止日
						</Button>
					}
				/>
			)}
		</Card>
	);
}
