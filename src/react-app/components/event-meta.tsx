import { CalendarClock, CalendarDays, GraduationCap, MapPin } from 'lucide-react';
import type { EventItem } from '../../shared/api-types';
import { EVENT_KIND_LABEL } from '../../shared/labels';
import { formatDateForToday } from '../lib/format';
import { Badge, cn } from './ui';

// 考試或截止日的類型 badge 與時間地點：考試頁的卡片與單科總覽的「即將到來」共用，兩處看起來一樣。

/** 類型：考試（GraduationCap）或截止日（CalendarClock），中性色加圖示 */
export function EventKindBadge({ kind }: { kind: EventItem['kind'] }) {
	return <Badge icon={kind === 'exam' ? <GraduationCap aria-hidden /> : <CalendarClock aria-hidden />}>{EVENT_KIND_LABEL[kind]}</Badge>;
}

/** 日期與時間（<time>；不是今年時加上年份），有地點時接在後面 */
export function EventWhenWhere({ event, today, className }: { event: EventItem; today: string; className?: string }) {
	return (
		<div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-meta text-ink-2', className)}>
			<span className="inline-flex items-center gap-1">
				<CalendarDays className="size-3.5 shrink-0 text-ink-3" aria-hidden />
				<time dateTime={event.time ? `${event.date}T${event.time}` : event.date} className="font-num tabular-nums">
					{formatDateForToday(event.date, today)}
					{event.time && ` ${event.time}`}
				</time>
			</span>
			{event.location && (
				<span className="inline-flex min-w-0 items-center gap-1">
					<MapPin className="size-3.5 shrink-0 text-ink-3" aria-hidden />
					<span className="wrap-anywhere">{event.location}</span>
				</span>
			)}
		</div>
	);
}
