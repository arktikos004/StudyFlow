import { z } from 'zod';
import { isRealDate } from './dates';
import { DAY_MS, MINUTE_MS } from './time';

// 前後端共用的輸入驗證：後端用來擋錯誤資料，前端用來顯示同樣的錯誤訊息

export const dateString = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式錯誤')
	.refine(isRealDate, '沒有這一天，請確認日期');
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時間格式錯誤');
const id = z.uuid('ID 格式錯誤');
/** 列表的日期區間（?from=&to=），兩邊都可以省略 */
export const dateRangeQuerySchema = z.object({ from: dateString.optional(), to: dateString.optional() });
const optionalText = (max: number) => z.string().trim().max(max, `最多 ${max} 個字`).nullish();

const email = z
	.email('Email 格式錯誤')
	.max(254)
	.transform((v) => v.trim().toLowerCase());
const newPassword = z.string().min(8, '密碼至少 8 個字元').max(128, '密碼最多 128 個字元');
/** 暱稱的長度上限（輸入框的 maxLength 也用這個） */
export const DISPLAY_NAME_MAX = 30;
const displayName = z.string().trim().min(1, '請輸入暱稱').max(DISPLAY_NAME_MAX, `暱稱最多 ${DISPLAY_NAME_MAX} 個字`);

export const registerSchema = z.object({
	email,
	password: newPassword,
	displayName,
});

export const loginSchema = z.object({
	email,
	password: z.string().min(1, '請輸入密碼').max(128),
});

// 讀書目標（分鐘）的範圍；前端輸入框的 min／max 也用這組數字
export const GOAL_LIMITS = {
	daily: { min: 10, max: 720 },
	weekly: { min: 60, max: 5040 },
	subjectWeekly: { min: 10, max: 3000 },
} as const;

/** 目標分鐘數：整數、在範圍內；null 代表清除目標 */
const goalMinutes = (label: string, { min, max }: { min: number; max: number }) => {
	const range = `${label}需介於 ${min}–${max} 分鐘`;
	return z
		.number({ error: `${label}請輸入數字` })
		.int(`${label}必須是整數`)
		.min(min, range)
		.max(max, range)
		.nullish();
};

export const updateProfileSchema = z.object({
	displayName: displayName.optional(),
	timezone: z
		.string()
		.refine((tz) => {
			try {
				new Intl.DateTimeFormat('en-US', { timeZone: tz });
				return true;
			} catch {
				return false;
			}
		}, '時區格式錯誤')
		// 時區名稱不分大小寫：存成標準寫法（asia/taipei → Asia/Taipei），同一個時區只會有一種字串
		.transform((tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone)
		.optional(),
	dailyGoalMinutes: goalMinutes('每日目標', GOAL_LIMITS.daily),
	weeklyGoalMinutes: goalMinutes('每週目標', GOAL_LIMITS.weekly),
});

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, '請輸入目前密碼').max(128),
	newPassword,
});

// 科目圖示的白名單：前端把每個 key 對應到一個 lucide 圖示
export const SUBJECT_ICONS = [
	'book',
	'calculator',
	'sigma',
	'flask',
	'atom',
	'dna',
	'leaf',
	'globe',
	'languages',
	'pen',
	'code',
	'cpu',
	'database',
	'network',
	'chart',
	'landmark',
	'scale',
	'briefcase',
	'palette',
	'music',
	'dumbbell',
	'heart',
	'brain',
	'microscope',
] as const;
export type SubjectIcon = (typeof SUBJECT_ICONS)[number];

export const subjectSchema = z.object({
	name: z.string().trim().min(1, '請輸入科目名稱').max(30, '科目名稱最多 30 個字'),
	color: z.string().regex(/^#[0-9a-f]{6}$/i, '顏色格式錯誤'),
	icon: z.enum(SUBJECT_ICONS, { error: '圖示不存在' }).nullish(),
	weeklyGoalMinutes: goalMinutes('科目每週目標', GOAL_LIMITS.subjectWeekly),
});
export const subjectUpdateSchema = subjectSchema.partial().extend({ archived: z.boolean().optional() });

/** 科目的新順序：必須剛好是本人全部科目的 id（後端再檢查是否屬於本人） */
export const subjectOrderSchema = z.object({
	ids: z
		.array(id, { error: '科目清單不正確' })
		.min(1, '科目清單不正確')
		.max(200, '科目清單不正確')
		.refine((ids) => new Set(ids).size === ids.length, '科目清單不正確'),
});

export const EVENT_KINDS = ['exam', 'deadline'] as const;
export const eventSchema = z.object({
	kind: z.enum(EVENT_KINDS),
	title: z.string().trim().min(1, '請輸入標題').max(100, '標題最多 100 個字'),
	date: dateString,
	time: timeString.nullish(),
	location: optionalText(100),
	notes: optionalText(2000),
	subjectId: id.nullish(),
});
export const eventUpdateSchema = eventSchema.partial();

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;

// 子任務清單：整份一起送出（新增、勾選、刪除、調整順序都是改陣列）
export const CHECKLIST_MAX_ITEMS = 30;
export const CHECKLIST_ITEM_MAX = 100;
export const checklistItemSchema = z.object({
	// 由前端產生（例如 crypto.randomUUID()），只用來當 React key 與辨識項目
	id: z.string({ error: '子項目 ID 格式錯誤' }).min(1, '子項目 ID 格式錯誤').max(40, '子項目 ID 格式錯誤'),
	title: z
		.string({ error: '請輸入子項目內容' })
		.trim()
		.min(1, '請輸入子項目內容')
		.max(CHECKLIST_ITEM_MAX, `子項目最多 ${CHECKLIST_ITEM_MAX} 個字`),
	done: z.boolean({ error: '子項目格式錯誤' }),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
const checklist = z
	.array(checklistItemSchema, { error: '子項目格式錯誤' })
	.max(CHECKLIST_MAX_ITEMS, `子項目最多 ${CHECKLIST_MAX_ITEMS} 項`)
	.refine((items) => new Set(items.map((i) => i.id)).size === items.length, '子項目 ID 重複');

export const taskSchema = z.object({
	title: z.string().trim().min(1, '請輸入任務名稱').max(200, '任務名稱最多 200 個字'),
	description: optionalText(5000),
	dueDate: dateString.nullish(),
	priority: z.enum(TASK_PRIORITIES).default('medium'),
	status: z.enum(TASK_STATUSES).default('todo'),
	estimatedMinutes: z.number().int().min(1).max(1440).nullish(),
	subjectId: id.nullish(),
	eventId: id.nullish(),
	checklist: checklist.default([]),
});
// 修改用的 schema 逐欄列出，不用 taskSchema.partial()：Zod 4 的 partial() 仍然會套用 .default()，
// 只送 title 的 PATCH 會把 priority、status、checklist 悄悄洗回預設值。
export const taskUpdateSchema = z.object({
	title: taskSchema.shape.title.optional(),
	description: taskSchema.shape.description,
	dueDate: taskSchema.shape.dueDate,
	priority: z.enum(TASK_PRIORITIES).optional(),
	status: z.enum(TASK_STATUSES).optional(),
	estimatedMinutes: taskSchema.shape.estimatedMinutes,
	subjectId: taskSchema.shape.subjectId,
	eventId: taskSchema.shape.eventId,
	checklist: checklist.optional(),
});

const MAX_SESSION_MS = DAY_MS;
/** 裝置的時鐘可能比伺服器快一點：結束時間最多可以比現在晚這麼多 */
const CLOCK_SKEW_TOLERANCE_MS = 5 * MINUTE_MS;
export const STUDY_MODES = ['pomodoro', 'stopwatch', 'manual'] as const;
/** 學習紀錄的欄位（不含跨欄位檢查）；Zod 4 不能對加了 refine 的 schema 呼叫 .partial()，所以分開 */
const studySessionBase = z.object({
	mode: z.enum(STUDY_MODES),
	startedAt: z.number().int().positive(),
	endedAt: z.number().int().positive(),
	// 有暫停時，實際專注秒數會小於起訖時間差
	durationSec: z.number().int().min(1).optional(),
	subjectId: id.nullish(),
	taskId: id.nullish(),
	note: optionalText(500),
});

/** 起訖時間與秒數的檢查，新增與編輯共用（編輯時先和原紀錄合併成整筆再檢查） */
const withSessionChecks = (schema: typeof studySessionBase) =>
	schema
		.refine((s) => s.endedAt > s.startedAt, { message: '結束時間必須晚於開始時間', path: ['endedAt'] })
		.refine((s) => s.endedAt - s.startedAt <= MAX_SESSION_MS, { message: '單次學習不可超過 24 小時', path: ['endedAt'] })
		.refine((s) => s.durationSec === undefined || s.durationSec * 1000 <= s.endedAt - s.startedAt + 1000, {
			message: '學習秒數不可超過起訖時間',
			path: ['durationSec'],
		})
		.refine((s) => s.endedAt <= Date.now() + CLOCK_SKEW_TOLERANCE_MS, { message: '不能記錄未來的時間', path: ['endedAt'] });

export const studySessionSchema = withSessionChecks(studySessionBase);
/** PATCH 只驗證個別欄位；跨欄位規則由後端和原紀錄合併後，用 studySessionSchema 檢查 */
export const studySessionUpdateSchema = studySessionBase.partial();

export const NOTE_KINDS = ['note', 'mistake'] as const;
const noteFields = {
	kind: z.enum(NOTE_KINDS),
	title: z.string().trim().min(1, '請輸入標題').max(200, '標題最多 200 個字'),
	content: optionalText(20000),
	question: optionalText(5000),
	wrongAnswer: optionalText(5000),
	correctAnswer: optionalText(5000),
	reason: optionalText(5000),
	tags: z.array(z.string().trim().min(1).max(20)).max(10, '最多 10 個標籤'),
	subjectId: id.nullish(),
};
export const noteSchema = z.object({
	...noteFields,
	tags: noteFields.tags.default([]),
	// 錯題預設加入複習排程，一般筆記可選擇加入
	scheduleReview: z.boolean().optional(),
});
// 和 taskUpdateSchema 一樣逐欄列出：partial() 會套用 tags 的預設值（空陣列），只改標題就會清掉標籤。
export const noteUpdateSchema = z.object({
	title: noteFields.title.optional(),
	content: noteFields.content,
	question: noteFields.question,
	wrongAnswer: noteFields.wrongAnswer,
	correctAnswer: noteFields.correctAnswer,
	reason: noteFields.reason,
	tags: noteFields.tags.optional(),
	subjectId: noteFields.subjectId,
	mastered: z.boolean().optional(),
	// 只改釘選時，不會更新「最後更新」時間，也不影響複習排程
	pinned: z.boolean({ error: '釘選格式錯誤' }).optional(),
	scheduleReview: z.boolean().optional(),
});
export const reviewSchema = z.object({ result: z.enum(['remembered', 'forgot']) });

/** GET /api/notes 一次最多回傳幾則（最近更新的優先）；前端超過時會提示只顯示這麼多 */
export const NOTES_LIST_LIMIT = 500;

/** GET /api/notes?q= 的關鍵字最多幾個字（筆記頁與任務頁搜尋框的 maxLength 也用這個） */
export const LIST_SEARCH_MAX = 100;

/** GET /api/search?q=：全站搜尋的關鍵字（前端輸入框的 maxLength 也用這個） */
export const SEARCH_QUERY_MAX = 50;
export const searchQuerySchema = z.object({
	q: z
		.string({ error: '請輸入搜尋關鍵字' })
		.trim()
		.min(1, '請輸入搜尋關鍵字')
		.max(SEARCH_QUERY_MAX, `搜尋關鍵字最多 ${SEARCH_QUERY_MAX} 個字`),
});

/** GET /api/export/calendar.ics?tasks=1：是否把有期限的任務也匯出成全天事件 */
export const calendarExportQuerySchema = z.object({ tasks: z.enum(['0', '1'], { error: '參數格式錯誤' }).optional() });

// 間隔重複：第 n 次答對後隔幾天再複習；全部通過即視為已掌握
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_NOTE = 6;
export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** 頭像（PRO-1）：前端先裁成正方形並縮小再上傳；後端檢查大小與實際格式（同筆記照片） */
export const AVATAR_MAX_BYTES = 1024 * 1024;
export const AVATAR_TYPES = ATTACHMENT_TYPES;
