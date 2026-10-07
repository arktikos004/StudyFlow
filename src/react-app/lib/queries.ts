import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import type {
	eventSchema,
	eventUpdateSchema,
	noteSchema,
	noteUpdateSchema,
	studySessionSchema,
	studySessionUpdateSchema,
	subjectSchema,
	subjectUpdateSchema,
	taskSchema,
	taskUpdateSchema,
	updateProfileSchema,
} from '../../shared/schemas';
import type {
	AchievementsResponse,
	DashboardResponse,
	EventItem,
	NoteItem,
	ProfileSummary,
	PublicAttachment,
	PublicUser,
	SearchResponse,
	StatsResponse,
	StudySession,
	Subject,
	SubjectOverview,
	SummaryResponse,
	TaskItem,
} from '../../shared/api-types';
import { api, ApiError, isAbortError, qs, type RequestOptions } from './api';

// ---- 查詢 ----

/** 目前登入的使用者；null = 沒有登入 */
export const ME_KEY = ['me'] as const;

export function useMe() {
	return useQuery({
		queryKey: ME_KEY,
		queryFn: async () => {
			try {
				return (await api.get<{ user: PublicUser }>('/auth/me')).user;
			} catch (e) {
				if (e instanceof ApiError && e.status === 401) return null;
				throw e;
			}
		},
		// 這台裝置上的變更都會直接寫進快取，平常不必重新取得；
		// 但別的裝置可能換了照片或暱稱（登入也可能過期）：切回分頁、重新連上網路時一律重新取得
		staleTime: Infinity,
		refetchOnWindowFocus: 'always',
		refetchOnReconnect: 'always',
	});
}

/** 已登入頁面使用：RequireAuth 保證 user 一定存在 */
export function useUser(): PublicUser {
	const { data } = useMe();
	return data!;
}

export function useSubjects() {
	return useQuery({
		queryKey: ['subjects'],
		queryFn: async () => (await api.get<{ subjects: Subject[] }>('/subjects')).subjects,
		staleTime: 60_000,
	});
}

/** 科目 id → 科目，方便各頁面顯示顏色與名稱 */
export function useSubjectMap() {
	const { data } = useSubjects();
	return new Map((data ?? []).map((s) => [s.id, s]));
}

/** 單科總覽；不是本人的科目會得到 ApiError（status 404） */
export function useSubjectOverview(id: string | undefined) {
	return useQuery({
		queryKey: ['subject-overview', id],
		queryFn: () => api.get<SubjectOverview>(`/subjects/${id}/overview`),
		enabled: !!id,
	});
}

/** 列表查詢共用的選項 */
type ListQueryOptions = {
	/** 換範圍時，新資料載入前先顯示上一個範圍的資料（月曆切換月份或週次時，畫面不會閃成空白） */
	keepPrevious?: boolean;
	/** false 時不發請求（例如有深連結時才需要全部的資料） */
	enabled?: boolean;
};

export function useEvents(params: { from?: string; to?: string } = {}, { keepPrevious = false, enabled = true }: ListQueryOptions = {}) {
	return useQuery({
		queryKey: ['events', params],
		queryFn: async () => (await api.get<{ events: EventItem[] }>(`/events${qs(params)}`)).events,
		placeholderData: keepPrevious ? keepPreviousData : undefined,
		enabled,
	});
}

/** 每筆都帶 spentMinutes（實際投入時間）與 checklist */
export function useTasks(
	params: { status?: string; subjectId?: string; eventId?: string } = {},
	{ enabled = true }: ListQueryOptions = {},
) {
	return useQuery({
		queryKey: ['tasks', params],
		queryFn: async () => (await api.get<{ tasks: TaskItem[] }>(`/tasks${qs(params)}`)).tasks,
		enabled,
	});
}

export type NoteFilters = {
	kind?: 'note' | 'mistake';
	subjectId?: string;
	q?: string;
	tag?: string;
	review?: 'due';
	mastered?: 'true' | 'false';
};
/** 筆記列表；換篩選條件時保留上一次的結果。enabled 為 false 時不發請求（例如筆記頁在複習檢視時不需要列表） */
export function useNotes(params: NoteFilters = {}, { enabled = true }: { enabled?: boolean } = {}) {
	return useQuery({
		queryKey: ['notes', params],
		queryFn: async () => (await api.get<{ notes: NoteItem[] }>(`/notes${qs(params)}`)).notes,
		placeholderData: keepPreviousData,
		enabled,
	});
}

export function useNote(id: string | undefined) {
	return useQuery({
		queryKey: ['note', id],
		queryFn: async () => (await api.get<{ note: NoteItem }>(`/notes/${id}`)).note,
		enabled: !!id,
	});
}

export function useStudySessions(params: { from?: string; to?: string } = {}, { keepPrevious = false }: ListQueryOptions = {}) {
	return useQuery({
		queryKey: ['sessions', params],
		queryFn: async () => (await api.get<{ sessions: StudySession[] }>(`/study-sessions${qs(params)}`)).sessions,
		placeholderData: keepPrevious ? keepPreviousData : undefined,
	});
}

export function useStats(days: 7 | 30 | 90) {
	return useQuery({
		queryKey: ['stats', days],
		queryFn: () => api.get<StatsResponse>(`/stats?days=${days}`),
		placeholderData: (prev) => prev,
	});
}

export function useDashboard() {
	return useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardResponse>('/dashboard') });
}

/** 頁首摘要：今天到期、逾期、待複習數與下一場考試 */
export function useSummary() {
	return useQuery({ queryKey: ['summary'], queryFn: () => api.get<SummaryResponse>('/summary'), staleTime: 30_000 });
}

/**
 * 全站搜尋。q 去掉前後空白後是空的就不查（data 為 undefined，顯示快捷動作）；
 * 輸入中保留上一次的結果，避免清單閃爍。輸入框請設 maxLength={SEARCH_QUERY_MAX}，防抖由呼叫端處理。
 */
export function useSearch(q: string) {
	const term = q.trim();
	return useQuery({
		queryKey: ['search', term],
		queryFn: () => api.get<SearchResponse>(`/search${qs({ q: term })}`),
		enabled: term.length > 0,
		placeholderData: (prev) => (term ? prev : undefined),
	});
}

/** 成就清單（固定順序）；學習紀錄、任務、錯題有變動時會重新取得，可用來偵測新解鎖 */
export function useAchievements() {
	return useQuery({
		queryKey: ['achievements'],
		queryFn: async () => (await api.get<AchievementsResponse>('/achievements')).achievements,
		staleTime: 60_000,
	});
}

/**
 * 個人檔案的累積數字（PRO-1）：累積時數與次數、連續天數、完成任務、掌握錯題、已解鎖的徽章。
 * 和成就同一份計算；學習紀錄、任務、筆記有變動時會和 ['achievements'] 一起重新取得。
 */
export function useProfileSummary() {
	return useQuery({
		queryKey: ['profile-summary'],
		queryFn: () => api.get<ProfileSummary>('/profile/summary'),
		staleTime: 60_000,
	});
}

// ---- 修改 ----

/** 失敗的提示：顯示後端回傳的錯誤訊息；呼叫端自己中止的請求（例如對話框按了取消）不提示 */
function toastError(e: unknown) {
	if (!isAbortError(e)) toast.error(e instanceof Error ? e.message : '發生錯誤');
}

/**
 * 包裝 useMutation：成功後重新整理相關資料、顯示提示；失敗時顯示後端回傳的錯誤訊息。
 */
function useApiMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, invalidate: QueryKey[], successMessage?: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => {
			invalidate.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
			if (successMessage) toast.success(successMessage);
		},
		onError: toastError,
	});
}

// 任務、考試、學習紀錄的變動都會影響總覽、統計、頁首摘要與單科總覽
const OVERVIEW: QueryKey[] = [['dashboard'], ['stats'], ['summary'], ['subject-overview']];

// 科目的名稱、顏色、圖示、目標、順序會出現在總覽（各科目標）、統計圖表與單科總覽
const SUBJECT_KEYS: QueryKey[] = [['subjects'], ['dashboard'], ['stats'], ['subject-overview']];

export type SubjectInput = z.input<typeof subjectSchema>;
export type SubjectUpdateInput = z.input<typeof subjectUpdateSchema> & { id: string };
export const useCreateSubject = () =>
	useApiMutation((v: SubjectInput) => api.post<{ subject: Subject }>('/subjects', v), SUBJECT_KEYS, '已新增科目');
export const useUpdateSubject = () =>
	useApiMutation(({ id, ...v }: SubjectUpdateInput) => api.patch<{ subject: Subject }>(`/subjects/${id}`, v), SUBJECT_KEYS);
export const useDeleteSubject = () =>
	useApiMutation(
		(id: string) => api.del(`/subjects/${id}`),
		[['subjects'], ['events'], ['tasks'], ['notes'], ['sessions'], ...OVERVIEW],
		'已刪除科目',
	);

/**
 * 調整科目順序：傳入本人「全部」科目的 id（新順序）。
 * 樂觀更新：按下就先換掉 ['subjects'] 快取的順序，失敗時還原並顯示錯誤。
 */
export const useReorderSubjects = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (ids: string[]) => api.put<{ subjects: Subject[] }>('/subjects/order', { ids }),
		onMutate: async (ids) => {
			await qc.cancelQueries({ queryKey: ['subjects'] });
			const prev = qc.getQueryData<Subject[]>(['subjects']);
			if (prev) {
				const byId = new Map(prev.map((s) => [s.id, s]));
				const next = ids.flatMap((id, sortOrder) => {
					const s = byId.get(id);
					return s ? [{ ...s, sortOrder }] : [];
				});
				qc.setQueryData<Subject[]>(['subjects'], next);
			}
			return { prev };
		},
		onError: (e, _ids, ctx) => {
			if (ctx?.prev) qc.setQueryData(['subjects'], ctx.prev);
			toastError(e);
		},
		onSettled: () => SUBJECT_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
	});
};

export type EventInput = z.input<typeof eventSchema>;
export type EventUpdateInput = z.input<typeof eventUpdateSchema> & { id: string };
export const useCreateEvent = () =>
	useApiMutation((v: EventInput) => api.post<{ event: EventItem }>('/events', v), [['events'], ...OVERVIEW], '已新增');
export const useUpdateEvent = () =>
	useApiMutation(
		({ id, ...v }: EventUpdateInput) => api.patch<{ event: EventItem }>(`/events/${id}`, v),
		[['events'], ...OVERVIEW],
		'已更新',
	);
export const useDeleteEvent = () =>
	useApiMutation((id: string) => api.del(`/events/${id}`), [['events'], ['tasks'], ...OVERVIEW], '已刪除');

/** checklist 可省略（預設空清單）；子項目的 id 由前端產生，例如 crypto.randomUUID() */
export type TaskInput = z.input<typeof taskSchema>;
export type TaskUpdateInput = z.input<typeof taskUpdateSchema> & { id: string };
// 任務會影響考試的準備進度（events）、「完成 50 個任務」成就與個人檔案的完成任務數
export const TASK_KEYS: QueryKey[] = [['tasks'], ['events'], ['achievements'], ['profile-summary'], ...OVERVIEW];
export const useCreateTask = () => useApiMutation((v: TaskInput) => api.post<{ task: TaskItem }>('/tasks', v), TASK_KEYS, '已新增任務');
export const useUpdateTask = () =>
	useApiMutation(({ id, ...v }: TaskUpdateInput) => api.patch<{ task: TaskItem }>(`/tasks/${id}`, v), TASK_KEYS);
export const useDeleteTask = () => useApiMutation((id: string) => api.del(`/tasks/${id}`), TASK_KEYS, '已刪除任務');

export type SessionInput = z.input<typeof studySessionSchema>;
/** 只送要改的欄位；沒給 durationSec 但改了起訖時間時，後端會依起訖時間重新計算 */
export type SessionUpdateInput = z.input<typeof studySessionUpdateSchema> & { id: string };
/**
 * 學習紀錄的新增、修改、刪除會影響：紀錄列表、任務投入時間、總覽、統計、頁首摘要、成就、個人檔案、單科總覽。
 * 計時器自己送出紀錄時（lib/timer.ts）也要 invalidate 這一組。
 */
export const SESSION_KEYS: QueryKey[] = [
	['sessions'],
	['tasks'],
	['dashboard'],
	['stats'],
	['summary'],
	['achievements'],
	['profile-summary'],
	['subject-overview'],
];
export const useCreateSession = () =>
	useApiMutation((v: SessionInput) => api.post<{ session: StudySession }>('/study-sessions', v), SESSION_KEYS, '已記錄學習時間');
export const useUpdateSession = () =>
	useApiMutation(
		({ id, ...v }: SessionUpdateInput) => api.patch<{ session: StudySession }>(`/study-sessions/${id}`, v),
		SESSION_KEYS,
		'已更新紀錄',
	);
export const useDeleteSession = () => useApiMutation((id: string) => api.del(`/study-sessions/${id}`), SESSION_KEYS, '已刪除紀錄');

export type NoteInput = z.input<typeof noteSchema>;
/** 只送要改的欄位；{ id, pinned } 只改釘選，不會更新「最後更新」時間 */
export type NoteUpdateInput = z.input<typeof noteUpdateSchema> & { id: string };
// 筆記與錯題會影響待複習數、錯題統計、單科總覽、「掌握錯題」成就與個人檔案的掌握錯題數
const NOTE_KEYS: QueryKey[] = [
	['notes'],
	['note'],
	['dashboard'],
	['stats'],
	['summary'],
	['achievements'],
	['profile-summary'],
	['subject-overview'],
];
export const useCreateNote = () => useApiMutation((v: NoteInput) => api.post<{ note: NoteItem }>('/notes', v), NOTE_KEYS);
export const useUpdateNote = () =>
	useApiMutation(({ id, ...v }: NoteUpdateInput) => api.patch<{ note: NoteItem }>(`/notes/${id}`, v), NOTE_KEYS);
export const useDeleteNote = () => useApiMutation((id: string) => api.del(`/notes/${id}`), NOTE_KEYS, '已刪除');
export const useReviewNote = () =>
	useApiMutation(
		({ id, result }: { id: string; result: 'remembered' | 'forgot' }) => api.post<{ note: NoteItem }>(`/notes/${id}/review`, { result }),
		NOTE_KEYS,
	);
export const useUploadAttachment = () =>
	useApiMutation(({ noteId, file }: { noteId: string; file: Blob }) => {
		const form = new FormData();
		form.append('file', file, 'photo.jpg');
		return api.post<{ attachment: PublicAttachment }>(`/notes/${noteId}/attachments`, form);
	}, NOTE_KEYS);
export const useDeleteAttachment = () => useApiMutation((id: string) => api.del(`/attachments/${id}`), NOTE_KEYS, '已刪除照片');

/**
 * 使用者資料的修改（個人資料、頭像）失敗或被中止時：請求可能已經在伺服器上完成（例如處理完才斷線、按了取消），
 * 重新取得使用者，畫面以伺服器為準；再顯示失敗的提示（中止的不提示）。
 */
function resyncMeAndToast(qc: QueryClient, e: unknown) {
	void qc.invalidateQueries({ queryKey: ME_KEY });
	toastError(e);
}

/** 暱稱、時區、每日／每週目標；目標傳 null 代表清除 */
export type ProfileInput = z.input<typeof updateProfileSchema>;
/**
 * 更新個人資料：mutate({ ...欄位, signal? })；signal 可以中止請求，不會送給後端。
 * successMessage：成功時的提示（例如「已更新時區」）；省略就不提示，由呼叫端自己決定
 * （例如「編輯個人資料」一次存好照片與暱稱，只提示一次）。
 */
export const useUpdateProfile = (successMessage?: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ signal, ...input }: ProfileInput & RequestOptions) => api.patch<{ user: PublicUser }>('/auth/me', input, { signal }),
		onSuccess: ({ user }) => {
			qc.setQueryData(ME_KEY, user);
			// 時區改變會影響「今天」的判斷
			qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
			if (successMessage) toast.success(successMessage);
		},
		onError: (e) => resyncMeAndToast(qc, e),
	});
};

/**
 * 頭像的上傳與移除：成功後直接換掉 ME_KEY 快取裡的使用者。avatarUpdatedAt 變了，avatarUrl() 就會換網址，
 * 用 useMe／useUser 的地方（側欄、「更多」選單、設定頁）都會跟著更新。
 * 成功不提示：只有「編輯個人資料」在用，存好整輪才提示一次。失敗時用 toast 顯示後端的錯誤訊息。
 */
function useAvatarMutation<TVars>(fn: (vars: TVars) => Promise<{ user: PublicUser }>) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
		onError: (e) => resyncMeAndToast(qc, e),
	});
}

/**
 * 上傳頭像：mutate({ file, signal? })。請先在前端裁成正方形並縮小；後端上限 AVATAR_MAX_BYTES（1MB），
 * 依檔案內容只接受 JPEG、PNG、WebP（AVATAR_TYPES）。signal 可以中止上傳。
 */
export const useUploadAvatar = () =>
	useAvatarMutation(({ file, signal }: { file: Blob } & RequestOptions) => {
		const form = new FormData();
		form.append('file', file, 'avatar');
		return api.put<{ user: PublicUser }>('/auth/avatar', form, { signal });
	});

/** 移除頭像：mutate({ signal? })；之後 avatarUpdatedAt 是 null，畫面改用暱稱首字 */
export const useDeleteAvatar = () =>
	useAvatarMutation(({ signal }: RequestOptions) => api.del<{ user: PublicUser }>('/auth/avatar', { signal }));
