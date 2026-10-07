import type { QueryClient, QueryKey } from '@tanstack/react-query';

// 每一種資料的 query key 開頭，以及修改之後要重新取得哪些資料。都在這裡，不在各處手寫字串：
// 新增一種「總覽類」資料時只要加進下面的清單，所有相關的修改都會讓它重新取得。

/** 目前登入的使用者（null：沒有登入） */
export const ME_KEY = ['me'] as const;

export const QK = {
	subjects: ['subjects'],
	subjectOverview: ['subject-overview'],
	events: ['events'],
	tasks: ['tasks'],
	notes: ['notes'],
	note: ['note'],
	sessions: ['sessions'],
	stats: ['stats'],
	dashboard: ['dashboard'],
	summary: ['summary'],
	search: ['search'],
	achievements: ['achievements'],
	profileSummary: ['profile-summary'],
} as const satisfies Record<string, QueryKey>;

/** 任務、考試、學習紀錄、筆記的變動都會影響：總覽、統計、頁首摘要、單科總覽 */
const OVERVIEW_KEYS = [QK.dashboard, QK.stats, QK.summary, QK.subjectOverview];
/** 學習紀錄、任務、筆記的變動會解鎖或收回成就；個人檔案也顯示這些累積數字 */
const ACHIEVEMENT_KEYS = [QK.achievements, QK.profileSummary];

/** 科目的名稱、顏色、圖示、目標、順序會出現在總覽（各科目標）、統計圖表與單科總覽 */
export const SUBJECT_KEYS: readonly QueryKey[] = [QK.subjects, QK.dashboard, QK.stats, QK.subjectOverview];
/** 刪除科目：連結到它的考試、任務、筆記、紀錄改成未分類 */
export const SUBJECT_DELETE_KEYS: readonly QueryKey[] = [QK.subjects, QK.events, QK.tasks, QK.notes, QK.sessions, ...OVERVIEW_KEYS];
export const EVENT_KEYS: readonly QueryKey[] = [QK.events, ...OVERVIEW_KEYS];
/** 刪除考試：連結到它的任務不再連結 */
export const EVENT_DELETE_KEYS: readonly QueryKey[] = [QK.events, QK.tasks, ...OVERVIEW_KEYS];
export const TASK_KEYS: readonly QueryKey[] = [QK.tasks, QK.events, ...ACHIEVEMENT_KEYS, ...OVERVIEW_KEYS];
/** 學習紀錄的新增、修改、刪除；計時器自己送出紀錄時（lib/timer.ts）也用這一組 */
export const SESSION_KEYS: readonly QueryKey[] = [QK.sessions, QK.tasks, ...ACHIEVEMENT_KEYS, ...OVERVIEW_KEYS];
/** 筆記與錯題會影響待複習數、錯題統計、單科總覽、「掌握錯題」成就與個人檔案的掌握錯題數 */
export const NOTE_KEYS: readonly QueryKey[] = [QK.notes, QK.note, ...ACHIEVEMENT_KEYS, ...OVERVIEW_KEYS];
/** 筆記照片只出現在筆記列表與單筆筆記，不影響總覽、統計與成就 */
export const NOTE_PHOTO_KEYS: readonly QueryKey[] = [QK.notes, QK.note];

/** 讓這幾組資料重新取得（畫面上正在用的會馬上重新請求） */
export function invalidateKeys(qc: QueryClient, keys: readonly QueryKey[]): void {
	keys.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
}
