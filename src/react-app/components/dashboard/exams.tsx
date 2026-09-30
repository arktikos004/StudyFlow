import { AlarmClock, CircleCheck, GraduationCap, MapPin, Plus } from 'lucide-react';
import { useId } from 'react';
import type { EventItem } from '../../../shared/api-types';
import { diffDays } from '../../../shared/dates';
import { eventStartMs } from '../../lib/dashboard-format';
import { formatDate } from '../../lib/format';
import { useNow } from '../../lib/timer';
import { SubjectTag } from '../subjects';
import { Button, Card, CardHeader, cn, Countdown, NumDisplay, ProgressBar } from '../ui';
import { useSubjectMark } from './hooks';
import { MoreLink } from './parts';

const DAY_MS = 86_400_000;

/**
 * 倒數磚：幾天後；24 小時內而且有時間的考試改成即時倒數（h:mm:ss）。
 * 3 天內用紅筆（DESIGN.md：紅色代表現在就要處理），並加上鬧鐘圖示，不只靠顏色。
 */
function ExamCountdown({ date, time, today, timeZone }: { date: string; time: string | null; today: string; timeZone: string }) {
	const days = diffDays(today, date);
	const start = eventStartMs(date, time, timeZone);
	// 只有今天或明天的考試才需要每秒更新
	const now = useNow(start !== null && days <= 1);
	const left = start === null ? null : start - now;
	const urgent = days <= 3;

	let value;
	let label: string;
	if (left !== null && left > 0 && left < DAY_MS) {
		value = <Countdown seconds={left / 1000} size="lg" />;
		label = '後開始';
	} else if (days <= 0) {
		value = <span className="text-h1 font-bold">今天</span>;
		label = '考試日';
	} else {
		value = <NumDisplay size="lg">{days}</NumDisplay>;
		label = '天後';
	}
	return (
		<div
			className={cn(
				'flex min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-lg px-3 py-2.5 text-center',
				urgent ? 'bg-danger-soft text-danger' : 'bg-subtle text-ink',
			)}
		>
			{value}
			<span className={cn('mt-1 inline-flex items-center gap-1 text-meta', urgent ? 'text-danger' : 'text-ink-2')}>
				{urgent && <AlarmClock className="size-3.5 shrink-0" aria-hidden />}
				{label}
			</span>
		</div>
	);
}

/** 準備進度：已完成／全部的準備任務，進度條用科目色；全部完成時加上圖示與「全部完成」 */
export function PrepProgress({ event, color, size = 'md', className }: { event: EventItem; color?: string; size?: 'sm' | 'md'; className?: string }) {
	const labelId = useId();
	const { taskTotal: total, taskDone: done } = event;
	if (!total) return null;
	const all = done >= total;
	return (
		<div className={className}>
			<div className="flex items-baseline justify-between gap-3 text-meta">
				<span id={labelId} className="text-ink-2">
					準備進度
				</span>
				<span className={cn('inline-flex items-center gap-1', all ? 'font-semibold text-success' : 'text-ink-2')}>
					{all && <CircleCheck className="size-3.5 shrink-0 self-center" aria-hidden />}
					<span className="font-num tabular-nums">
						<span className={cn(!all && 'font-semibold text-ink')}>{done}</span>／{total}
					</span>
					項{all && '，全部完成'}
				</span>
			</div>
			<ProgressBar
				className="mt-1.5"
				value={done}
				max={total}
				labelledBy={labelId}
				valueText={`已完成 ${done}／${total} 項準備任務${all ? '，全部完成' : ''}`}
				color={color}
				size={size}
			/>
		</div>
	);
}

/** 總覽的「下一場考試」焦點卡：倒數、科目 chip、日期地點、準備進度 */
export function NextExamCard({
	event,
	today,
	timeZone,
	onAddTask,
}: {
	event: EventItem;
	today: string;
	timeZone: string;
	/** 還沒有準備任務時的「新增準備任務」 */
	onAddTask: (event: EventItem) => void;
}) {
	const markOf = useSubjectMark();
	return (
		<Card>
			<CardHeader
				title="下一場考試"
				icon={<GraduationCap className="size-[18px] text-ink-3" aria-hidden />}
				action={
					<MoreLink to={`/events?open=${event.id}`} aria-label={`查看「${event.title}」`}>
						查看
					</MoreLink>
				}
			/>
			<div className="px-4 pb-4 sm:px-5 sm:pb-5">
				<div className="flex items-start gap-4">
					<ExamCountdown date={event.date} time={event.time} today={today} timeZone={timeZone} />
					<div className="min-w-0 flex-1 pt-0.5">
						<p className="text-h3 font-semibold break-words text-ink">{event.title}</p>
						<div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-meta text-ink-2">
							<SubjectTag subjectId={event.subjectId} />
							<span className="font-num tabular-nums">
								{formatDate(event.date)}
								{event.time && ` ${event.time}`}
							</span>
							{event.location && (
								<span className="inline-flex min-w-0 items-center gap-1">
									<MapPin className="size-3.5 shrink-0 text-ink-3" aria-hidden />
									<span className="truncate">{event.location}</span>
								</span>
							)}
						</div>
					</div>
				</div>
				{event.taskTotal > 0 ? (
					<PrepProgress event={event} color={markOf(event.subjectId)} className="mt-4" />
				) : (
					<div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
						<p className="text-meta text-ink-3">還沒有準備任務</p>
						<Button size="sm" variant="ghost" onClick={() => onAddTask(event)}>
							<Plus className="size-4" aria-hidden />
							新增準備任務
						</Button>
					</div>
				)}
			</div>
		</Card>
	);
}
