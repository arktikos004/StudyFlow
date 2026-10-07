import { addDays, zonedTime } from '../../shared/dates';
import { EVENT_KIND_LABEL } from '../../shared/labels';
import { HOUR_MS } from '../../shared/time';
import type { StudyEvent, Task } from '../db/schema';
import type { IcsEvent } from './ics';

// 考試、截止日與任務轉成行事曆事件（匯出 .ics 用）。ICS 的語法在 lib/ics.ts，這裡只決定內容。

/** UID 的網域部分：同一筆資料每次匯出的 UID 都相同，重新匯入時日曆 App 會更新而不是重複 */
const UID_DOMAIN = 'studyflow';

/** 有時間的考試或截止日沒有結束時間，日曆上預設佔 1 小時 */
const DEFAULT_EVENT_MS = HOUR_MS;

// 提醒的時間（相對於開始時間的 DURATION）
/** 有時間的考試：前一天同一時間 */
const ALARM_SAME_TIME_DAY_BEFORE = '-P1D';
/** 全天的考試：從當天 00:00 往前 15 小時，也就是前一天早上 9 點 */
const ALARM_9AM_DAY_BEFORE = '-PT15H';

/** 科目名稱與備註合在一起，當作日曆的說明 */
const describe = (subjectName: string | undefined, text: string | null) =>
	[subjectName && `科目：${subjectName}`, text].filter(Boolean).join('\n') || null;

/** 考試或截止日：有時間的依使用者時區換算成 UTC，沒有時間的是全天事件；只有考試會提醒 */
export function eventToIcs(event: StudyEvent, subjectName: string | undefined, tz: string): IcsEvent {
	const kind = EVENT_KIND_LABEL[event.kind];
	const base = {
		uid: `${event.id}@${UID_DOMAIN}`,
		summary: `【${kind}】${event.title}`,
		location: event.location,
		description: describe(subjectName, event.notes),
		categories: kind,
	};
	const alarm = (trigger: string) => (event.kind === 'exam' ? { trigger, description: `明天考試：${event.title}` } : undefined);

	if (event.time) {
		const start = zonedTime(event.date, event.time, tz);
		return { ...base, start: { utc: start }, end: { utc: start + DEFAULT_EVENT_MS }, alarm: alarm(ALARM_SAME_TIME_DAY_BEFORE) };
	}
	return { ...base, start: { date: event.date }, end: { date: addDays(event.date, 1) }, alarm: alarm(ALARM_9AM_DAY_BEFORE) };
}

/** 有期限的任務：期限當天的全天事件，不提醒 */
export function taskToIcs(task: Task & { dueDate: string }, subjectName: string | undefined): IcsEvent {
	return {
		uid: `${task.id}@${UID_DOMAIN}`,
		summary: `【${task.status === 'done' ? '已完成' : '任務'}】${task.title}`,
		start: { date: task.dueDate },
		end: { date: addDays(task.dueDate, 1) },
		description: describe(subjectName, task.description),
		categories: '任務',
	};
}
