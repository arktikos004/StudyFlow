import { Archive, Pencil, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { EventItem, SubjectOverview, TaskItem } from '../../shared/api-types';
import { today as todayOf } from '../../shared/dates';
import { EventDialog, TaskDialog } from '../components/forms';
import { SubjectDialog } from '../components/settings/SubjectDialog';
import { MistakesCard } from '../components/subject/mistakes';
import { StartFocusButton } from '../components/subject/start-focus';
import { StudyTimeCard } from '../components/subject/study-time';
import { TasksCard } from '../components/subject/tasks';
import { UpcomingCard } from '../components/subject/upcoming';
import { SubjectIconTile } from '../components/subjects';
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorNote, PageHeader, PageLoader, PageStack } from '../components/ui';
import { ApiError } from '../lib/api';
import { formatMinutes } from '../lib/format';
import { useSubjectOverview, useSubjects, useUser } from '../lib/queries';
import { useSubjectTone } from '../lib/subject-color';

// 單科總覽（SUB-3）：/subjects/:id，資料用一次 API（useSubjectOverview）取得。
// 焦點是「下一場考試還有幾天、準備到哪裡」；其次是這科的待辦、讀書時間與錯題。

function Overview({ data }: { data: SubjectOverview }) {
	const { subject, upcomingEvents, openTasks, minutes, mistakes } = data;
	const user = useUser();
	const today = todayOf(user.timezone);
	const tone = useSubjectTone()(subject.color);
	const mark = tone.mark;
	const { data: subjects = [] } = useSubjects();
	const navigate = useNavigate();
	const [editing, setEditing] = useState(false);
	const [taskDialog, setTaskDialog] = useState<{ task?: TaskItem } | null>(null);
	const [eventDialog, setEventDialog] = useState<{ event?: EventItem } | null>(null);

	const summary = [
		minutes.week > 0 ? `本週讀了 ${formatMinutes(minutes.week)}` : '本週還沒讀這一科',
		openTasks.length ? `${openTasks.length} 項任務未完成` : '沒有未完成的任務',
	].join('，');

	return (
		<div>
			<PageHeader
				title={
					<span className="flex items-center gap-3">
						{/* 直接用這次 API 回傳的科目資料：不必等科目清單（另一個請求），直接開啟這一頁時方塊不會晚一拍才出現 */}
						<SubjectIconTile name={subject.name} tone={tone} icon={subject.icon} />
						<span className="min-w-0 wrap-anywhere">{subject.name}</span>
					</span>
				}
				description={
					<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
						{subject.archived && <Badge icon={<Archive aria-hidden />}>已封存</Badge>}
						{summary}
					</span>
				}
				actions={
					<>
						<Button onClick={() => setEditing(true)}>
							<Pencil className="size-4" aria-hidden />
							編輯科目
						</Button>
						<StartFocusButton subjectId={subject.id} />
					</>
				}
			/>

			{/* 桌面兩欄（3：2）；手機依 DOM 順序：考試、任務、讀書時間、錯題 */}
			<div className="grid grid-cols-1 items-start gap-section lg:grid-cols-5">
				<PageStack className="min-w-0 lg:col-span-3">
					<UpcomingCard
						events={upcomingEvents}
						today={today}
						timeZone={user.timezone}
						color={mark}
						onOpen={(event) => setEventDialog({ event })}
						onAdd={() => setEventDialog({})}
					/>
					<TasksCard
						tasks={openTasks}
						subjectId={subject.id}
						today={today}
						onOpen={(task) => setTaskDialog({ task })}
						onAdd={() => setTaskDialog({})}
					/>
				</PageStack>
				<PageStack className="min-w-0 lg:col-span-2">
					<StudyTimeCard
						week={minutes.week}
						last30={minutes.last30}
						goal={subject.weeklyGoalMinutes}
						color={mark}
						onSetGoal={() => setEditing(true)}
					/>
					<MistakesCard mistakes={mistakes} subjectId={subject.id} color={mark} />
				</PageStack>
			</div>

			<SubjectDialog
				open={editing}
				onClose={() => setEditing(false)}
				subject={subject}
				subjects={subjects}
				onDeleted={() => navigate('/settings', { replace: true })}
			/>
			<TaskDialog open={!!taskDialog} task={taskDialog?.task} defaults={{ subjectId: subject.id }} onClose={() => setTaskDialog(null)} />
			<EventDialog
				open={!!eventDialog}
				event={eventDialog?.event}
				defaults={{ subjectId: subject.id }}
				onClose={() => setEventDialog(null)}
			/>
		</div>
	);
}

function SubjectNotFound() {
	return (
		<div>
			<PageHeader title="科目總覽" />
			<Card>
				<EmptyState
					icon={<SearchX />}
					title="找不到此科目"
					description="這個科目可能已經刪除，或不屬於你的帳號。"
					action={<ButtonLink to="/settings">查看所有科目</ButtonLink>}
				/>
			</Card>
		</div>
	);
}

/** 單科總覽（SUB-3）。不是本人的科目或不存在時，API 回 404，顯示「找不到此科目」 */
export function SubjectPage() {
	const { id } = useParams();
	const { data, isPending, error, refetch, isRefetching } = useSubjectOverview(id);
	// 科目清單（編輯科目、任務與考試對話框的科目選單要用）和總覽同時開始載入，不必等總覽回來才去要
	useSubjects();
	if (isPending) return <PageLoader />;
	if (error) {
		if (error instanceof ApiError && error.status === 404) return <SubjectNotFound />;
		return <ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />;
	}
	return <Overview key={data.subject.id} data={data} />;
}
