import type { StudySession } from '../../shared/api-types';
import { STUDY_MODE_LABEL } from '../../shared/labels';
import { formatMinutes } from './format';
import { formatClockRange } from './time-format';

/**
 * 學習紀錄列（按下去編輯）的報讀：時段、科目、方式、時間。計時頁的紀錄與月曆的當天面板共用，兩處念出來一樣。
 * subjectName 是 undefined 時念「未分類」。
 */
export function sessionRowLabel(
	session: Pick<StudySession, 'startedAt' | 'endedAt' | 'mode' | 'durationSec'>,
	subjectName: string | undefined,
	timeZone: string,
): string {
	const range = formatClockRange(session.startedAt, session.endedAt, timeZone);
	const minutes = formatMinutes(session.durationSec / 60);
	return `編輯學習紀錄：${range}，${subjectName ?? '未分類'}，${STUDY_MODE_LABEL[session.mode]}，${minutes}`;
}
