import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import type {
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
	DashboardResponse,
	EventItem,
	NoteItem,
	PublicAttachment,
	PublicUser,
	StatsResponse,
	StudySession,
	Subject,
	SubjectOverview,
	TaskItem,
} from '../../shared/api-types';
import { api, ApiError, qs } from './api';

// ---- 查詢 ----

export function useMe() {
	return useQuery({
		queryKey: ['me'],
		queryFn: async () => {
			try {
				return (await api.get<{ user: PublicUser }>('/auth/me')).user;
			} catch (e) {
				if (e instanceof ApiError && e.status === 401) return null;
				throw e;
			}
		},
		staleTime: Infinity,
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

export function useEvents(params: { from?: string; to?: string } = {}) {
	return useQuery({
		queryKey: ['events', params],
		queryFn: async () => (await api.get<{ events: EventItem[] }>(`/events${qs(params)}`)).events,
	});
}

/** 每筆都帶 spentMinutes（實際投入時間）與 checklist */
export function useTasks(params: { status?: string; subjectId?: string; eventId?: string } = {}) {
	return useQuery({
		queryKey: ['tasks', params],
		queryFn: async () => (await api.get<{ tasks: TaskItem[] }>(`/tasks${qs(params)}`)).tasks,
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
export function useNotes(params: NoteFilters = {}) {
	return useQuery({
		queryKey: ['notes', params],
		queryFn: async () => (await api.get<{ notes: NoteItem[] }>(`/notes${qs(params)}`)).notes,
		placeholderData: (prev) => prev,
	});
}

export function useNote(id: string | undefined) {
	return useQuery({
		queryKey: ['note', id],
		queryFn: async () => (await api.get<{ note: NoteItem }>(`/notes/${id}`)).note,
		enabled: !!id,
	});
}

export function useStudySessions(params: { from?: string; to?: string } = {}) {
	return useQuery({
		queryKey: ['sessions', params],
		queryFn: async () => (await api.get<{ sessions: StudySession[] }>(`/study-sessions${qs(params)}`)).sessions,
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

// ---- 修改 ----

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
		onError: (e) => toast.error(e instanceof Error ? e.message : '發生錯誤'),
	});
}

// 任務、考試、學習紀錄的變動都會影響總覽、統計與單科總覽
const OVERVIEW: QueryKey[] = [['dashboard'], ['stats'], ['subject-overview']];

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
			toast.error(e instanceof Error ? e.message : '發生錯誤');
		},
		onSettled: () => SUBJECT_KEYS.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
	});
};

export type EventInput = {
	kind: 'exam' | 'deadline';
	title: string;
	date: string;
	time?: string | null;
	location?: string | null;
	notes?: string | null;
	subjectId?: string | null;
};
export const useCreateEvent = () =>
	useApiMutation((v: EventInput) => api.post<{ event: EventItem }>('/events', v), [['events'], ...OVERVIEW], '已新增');
export const useUpdateEvent = () =>
	useApiMutation(
		({ id, ...v }: Partial<EventInput> & { id: string }) => api.patch(`/events/${id}`, v),
		[['events'], ...OVERVIEW],
		'已更新',
	);
export const useDeleteEvent = () =>
	useApiMutation((id: string) => api.del(`/events/${id}`), [['events'], ['tasks'], ...OVERVIEW], '已刪除');

/** checklist 可省略（預設空清單）；子項目的 id 由前端產生，例如 crypto.randomUUID() */
export type TaskInput = z.input<typeof taskSchema>;
export type TaskUpdateInput = z.input<typeof taskUpdateSchema> & { id: string };
export const useCreateTask = () =>
	useApiMutation((v: TaskInput) => api.post<{ task: TaskItem }>('/tasks', v), [['tasks'], ['events'], ...OVERVIEW], '已新增任務');
export const useUpdateTask = () =>
	useApiMutation(
		({ id, ...v }: TaskUpdateInput) => api.patch<{ task: TaskItem }>(`/tasks/${id}`, v),
		[['tasks'], ['events'], ...OVERVIEW],
	);
export const useDeleteTask = () =>
	useApiMutation((id: string) => api.del(`/tasks/${id}`), [['tasks'], ['events'], ...OVERVIEW], '已刪除任務');

export type SessionInput = z.input<typeof studySessionSchema>;
/** 只送要改的欄位；沒給 durationSec 但改了起訖時間時，後端會依起訖時間重新計算 */
export type SessionUpdateInput = z.input<typeof studySessionUpdateSchema> & { id: string };
/**
 * 學習紀錄的新增、修改、刪除會影響：紀錄列表、任務投入時間、總覽、統計、頁首摘要、成就、單科總覽。
 * 計時器自己送出紀錄時（lib/timer.ts）也要 invalidate 這一組。
 */
export const SESSION_KEYS: QueryKey[] = [
	['sessions'],
	['tasks'],
	['dashboard'],
	['stats'],
	['summary'],
	['achievements'],
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
const NOTE_KEYS: QueryKey[] = [['notes'], ['note'], ['dashboard'], ['stats'], ['subject-overview']];
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

/** 暱稱、時區、每日／每週目標；目標傳 null 代表清除 */
export type ProfileInput = z.input<typeof updateProfileSchema>;
export const useUpdateProfile = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: ProfileInput) => api.patch<{ user: PublicUser }>('/auth/me', v),
		onSuccess: ({ user }) => {
			qc.setQueryData(['me'], user);
			// 時區改變會影響「今天」的判斷
			qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
			toast.success('已更新個人資料');
		},
		onError: (e) => toast.error(e.message),
	});
};
