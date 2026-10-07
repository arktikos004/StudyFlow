import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { z } from 'zod';
import type {
	AchievementsResponse,
	DashboardResponse,
	EventItem,
	NoteItem,
	ProfileSummary,
	PublicAttachment,
	SearchResponse,
	StatsResponse,
	StudySession,
	Subject,
	SubjectOverview,
	SummaryResponse,
	TaskItem,
} from '../../shared/api-types';
import type {
	eventSchema,
	eventUpdateSchema,
	NoteInput,
	noteUpdateSchema,
	SessionInput,
	studySessionUpdateSchema,
	subjectSchema,
	subjectUpdateSchema,
	taskSchema,
	taskUpdateSchema,
} from '../../shared/schemas';
import { api, qs } from './api';
import { toastError, useApiMutation } from './mutation';
import {
	EVENT_DELETE_KEYS,
	EVENT_KEYS,
	invalidateKeys,
	NOTE_KEYS,
	NOTE_PHOTO_KEYS,
	QK,
	SESSION_KEYS,
	SUBJECT_DELETE_KEYS,
	SUBJECT_KEYS,
	TASK_KEYS,
} from './query-keys';

// ---- 查詢 ----

export function useSubjects() {
	return useQuery({
		queryKey: QK.subjects,
		queryFn: async () => (await api.get<{ subjects: Subject[] }>('/subjects')).subjects,
		staleTime: 60_000,
	});
}

/** 科目 id → 科目，方便各頁面顯示顏色與名稱；同一份科目清單只建一次（計時頁計時中每 250ms 重繪，每個 SubjectTag 也會呼叫） */
export function useSubjectMap() {
	const { data } = useSubjects();
	return useMemo(() => new Map((data ?? []).map((s) => [s.id, s])), [data]);
}

/** 單科總覽；不是本人的科目會得到 ApiError（status 404） */
export function useSubjectOverview(id: string | undefined) {
	return useQuery({
		queryKey: [...QK.subjectOverview, id],
		queryFn: () => api.get<SubjectOverview>(`/subjects/${encodeURIComponent(id ?? '')}/overview`),
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
		queryKey: [...QK.events, params],
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
		queryKey: [...QK.tasks, params],
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
		queryKey: [...QK.notes, params],
		queryFn: async () => (await api.get<{ notes: NoteItem[] }>(`/notes${qs(params)}`)).notes,
		placeholderData: keepPreviousData,
		enabled,
	});
}

export function useNote(id: string | undefined) {
	return useQuery({
		queryKey: [...QK.note, id],
		queryFn: async () => (await api.get<{ note: NoteItem }>(`/notes/${id}`)).note,
		enabled: !!id,
	});
}

export function useStudySessions(params: { from?: string; to?: string } = {}, { keepPrevious = false }: ListQueryOptions = {}) {
	return useQuery({
		queryKey: [...QK.sessions, params],
		queryFn: async () => (await api.get<{ sessions: StudySession[] }>(`/study-sessions${qs(params)}`)).sessions,
		placeholderData: keepPrevious ? keepPreviousData : undefined,
	});
}

export function useStats(days: 7 | 30 | 90) {
	return useQuery({
		queryKey: [...QK.stats, days],
		queryFn: () => api.get<StatsResponse>(`/stats?days=${days}`),
		placeholderData: (prev) => prev,
	});
}

export function useDashboard() {
	return useQuery({ queryKey: QK.dashboard, queryFn: () => api.get<DashboardResponse>('/dashboard') });
}

/** 頁首摘要：今天到期、逾期、待複習數與下一場考試 */
export function useSummary() {
	return useQuery({ queryKey: QK.summary, queryFn: () => api.get<SummaryResponse>('/summary'), staleTime: 30_000 });
}

/**
 * 全站搜尋。q 去掉前後空白後是空的就不查（data 為 undefined，顯示快捷動作）；
 * 輸入中保留上一次的結果，避免清單閃爍。輸入框請設 maxLength={SEARCH_QUERY_MAX}，防抖由呼叫端處理。
 */
export function useSearch(q: string) {
	const term = q.trim();
	return useQuery({
		queryKey: [...QK.search, term],
		queryFn: () => api.get<SearchResponse>(`/search${qs({ q: term })}`),
		enabled: term.length > 0,
		placeholderData: (prev) => (term ? prev : undefined),
		// 每次搜尋都重新取得（先顯示上次的結果）：新增、刪除、改名之後再搜同一個字要看到最新的。
		// 面板開著時不會有其他修改，所以不必在每個修改後另外讓搜尋失效。
		staleTime: 0,
	});
}

/** 成就清單（固定順序）；學習紀錄、任務、錯題有變動時會重新取得，可用來偵測新解鎖 */
export function useAchievements() {
	return useQuery({
		queryKey: QK.achievements,
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
		queryKey: QK.profileSummary,
		queryFn: () => api.get<ProfileSummary>('/profile/summary'),
		staleTime: 60_000,
	});
}

// ---- 修改 ----

export type SubjectInput = z.input<typeof subjectSchema>;
export type SubjectUpdateInput = z.input<typeof subjectUpdateSchema> & { id: string };
export const useCreateSubject = () =>
	useApiMutation((v: SubjectInput) => api.post<{ subject: Subject }>('/subjects', v), SUBJECT_KEYS, '已新增科目');
export const useUpdateSubject = () =>
	useApiMutation(({ id, ...v }: SubjectUpdateInput) => api.patch<{ subject: Subject }>(`/subjects/${id}`, v), SUBJECT_KEYS);
export const useDeleteSubject = () => useApiMutation((id: string) => api.del(`/subjects/${id}`), SUBJECT_DELETE_KEYS, '已刪除科目');

/**
 * 調整科目順序：傳入本人「全部」科目的 id（新順序）。
 * 樂觀更新：按下就先換掉科目清單快取（QK.subjects）的順序，失敗時還原並顯示錯誤。
 */
export const useReorderSubjects = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (ids: string[]) => api.put<{ subjects: Subject[] }>('/subjects/order', { ids }),
		onMutate: async (ids) => {
			await qc.cancelQueries({ queryKey: QK.subjects });
			const prev = qc.getQueryData<Subject[]>(QK.subjects);
			if (prev) {
				const byId = new Map(prev.map((s) => [s.id, s]));
				const next = ids.flatMap((id, sortOrder) => {
					const s = byId.get(id);
					return s ? [{ ...s, sortOrder }] : [];
				});
				qc.setQueryData<Subject[]>(QK.subjects, next);
			}
			return { prev };
		},
		onError: (e, _ids, ctx) => {
			if (ctx?.prev) qc.setQueryData(QK.subjects, ctx.prev);
			toastError(e);
		},
		onSettled: () => invalidateKeys(qc, SUBJECT_KEYS),
	});
};

export type EventInput = z.input<typeof eventSchema>;
export type EventUpdateInput = z.input<typeof eventUpdateSchema> & { id: string };
export const useCreateEvent = () => useApiMutation((v: EventInput) => api.post<{ event: EventItem }>('/events', v), EVENT_KEYS, '已新增');
export const useUpdateEvent = () =>
	useApiMutation(({ id, ...v }: EventUpdateInput) => api.patch<{ event: EventItem }>(`/events/${id}`, v), EVENT_KEYS, '已更新');
export const useDeleteEvent = () => useApiMutation((id: string) => api.del(`/events/${id}`), EVENT_DELETE_KEYS, '已刪除');

/** checklist 可省略（預設空清單）；子項目的 id 由前端產生，例如 crypto.randomUUID() */
export type TaskInput = z.input<typeof taskSchema>;
export type TaskUpdateInput = z.input<typeof taskUpdateSchema> & { id: string };
// 任務會影響考試的準備進度（events）、「完成 50 個任務」成就與個人檔案的完成任務數
export const useCreateTask = () => useApiMutation((v: TaskInput) => api.post<{ task: TaskItem }>('/tasks', v), TASK_KEYS, '已新增任務');
export const useUpdateTask = () =>
	useApiMutation(({ id, ...v }: TaskUpdateInput) => api.patch<{ task: TaskItem }>(`/tasks/${id}`, v), TASK_KEYS);
export const useDeleteTask = () => useApiMutation((id: string) => api.del(`/tasks/${id}`), TASK_KEYS, '已刪除任務');

// 送出的形狀定義在 shared/schemas.ts（不依賴瀏覽器的 lib 純函式也要用），這裡轉出給元件
export type { NoteInput, SessionInput };
/** 只送要改的欄位；沒給 durationSec 但改了起訖時間時，後端會依起訖時間重新計算 */
export type SessionUpdateInput = z.input<typeof studySessionUpdateSchema> & { id: string };
export const useCreateSession = () =>
	useApiMutation((v: SessionInput) => api.post<{ session: StudySession }>('/study-sessions', v), SESSION_KEYS, '已記錄學習時間');
export const useUpdateSession = () =>
	useApiMutation(
		({ id, ...v }: SessionUpdateInput) => api.patch<{ session: StudySession }>(`/study-sessions/${id}`, v),
		SESSION_KEYS,
		'已更新紀錄',
	);
export const useDeleteSession = () => useApiMutation((id: string) => api.del(`/study-sessions/${id}`), SESSION_KEYS, '已刪除紀錄');

/** 只送要改的欄位；{ id, pinned } 只改釘選，不會更新「最後更新」時間 */
export type NoteUpdateInput = z.input<typeof noteUpdateSchema> & { id: string };
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
	}, NOTE_PHOTO_KEYS);
export const useDeleteAttachment = () => useApiMutation((id: string) => api.del(`/attachments/${id}`), NOTE_PHOTO_KEYS, '已刪除照片');
