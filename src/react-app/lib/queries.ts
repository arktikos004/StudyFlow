import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
	DashboardResponse,
	EventItem,
	NoteItem,
	PublicAttachment,
	PublicUser,
	StatsResponse,
	StudySession,
	Subject,
	Task,
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

export function useEvents(params: { from?: string; to?: string } = {}) {
	return useQuery({
		queryKey: ['events', params],
		queryFn: async () => (await api.get<{ events: EventItem[] }>(`/events${qs(params)}`)).events,
	});
}

export function useTasks(params: { status?: string; subjectId?: string; eventId?: string } = {}) {
	return useQuery({
		queryKey: ['tasks', params],
		queryFn: async () => (await api.get<{ tasks: Task[] }>(`/tasks${qs(params)}`)).tasks,
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

// 任務、考試、學習紀錄的變動都會影響儀表板與統計
const OVERVIEW: QueryKey[] = [['dashboard'], ['stats']];

export type SubjectInput = { name: string; color: string };
export const useCreateSubject = () =>
	useApiMutation((v: SubjectInput) => api.post<{ subject: Subject }>('/subjects', v), [['subjects']], '已新增科目');
export const useUpdateSubject = () =>
	useApiMutation(
		({ id, ...v }: Partial<SubjectInput> & { id: string; archived?: boolean }) => api.patch(`/subjects/${id}`, v),
		[['subjects']],
	);
export const useDeleteSubject = () =>
	useApiMutation((id: string) => api.del(`/subjects/${id}`), [['subjects'], ['events'], ['tasks'], ['notes'], ...OVERVIEW], '已刪除科目');

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

export type TaskInput = {
	title: string;
	description?: string | null;
	dueDate?: string | null;
	priority?: 'low' | 'medium' | 'high';
	status?: 'todo' | 'doing' | 'done';
	estimatedMinutes?: number | null;
	subjectId?: string | null;
	eventId?: string | null;
};
export const useCreateTask = () =>
	useApiMutation((v: TaskInput) => api.post<{ task: Task }>('/tasks', v), [['tasks'], ['events'], ...OVERVIEW], '已新增任務');
export const useUpdateTask = () =>
	useApiMutation(
		({ id, ...v }: Partial<TaskInput> & { id: string }) => api.patch<{ task: Task }>(`/tasks/${id}`, v),
		[['tasks'], ['events'], ...OVERVIEW],
	);
export const useDeleteTask = () =>
	useApiMutation((id: string) => api.del(`/tasks/${id}`), [['tasks'], ['events'], ...OVERVIEW], '已刪除任務');

export type SessionInput = {
	mode: 'pomodoro' | 'stopwatch' | 'manual';
	startedAt: number;
	endedAt: number;
	durationSec?: number;
	subjectId?: string | null;
	taskId?: string | null;
	note?: string | null;
};
export const useCreateSession = () =>
	useApiMutation(
		(v: SessionInput) => api.post<{ session: StudySession }>('/study-sessions', v),
		[['sessions'], ...OVERVIEW],
		'已記錄學習時間',
	);
export const useDeleteSession = () =>
	useApiMutation((id: string) => api.del(`/study-sessions/${id}`), [['sessions'], ...OVERVIEW], '已刪除紀錄');

export type NoteInput = {
	kind: 'note' | 'mistake';
	title: string;
	content?: string | null;
	question?: string | null;
	wrongAnswer?: string | null;
	correctAnswer?: string | null;
	reason?: string | null;
	tags?: string[];
	subjectId?: string | null;
	scheduleReview?: boolean;
	mastered?: boolean;
};
const NOTE_KEYS: QueryKey[] = [['notes'], ['note'], ['dashboard'], ['stats']];
export const useCreateNote = () => useApiMutation((v: NoteInput) => api.post<{ note: NoteItem }>('/notes', v), NOTE_KEYS);
export const useUpdateNote = () =>
	useApiMutation(({ id, ...v }: Partial<NoteInput> & { id: string }) => api.patch<{ note: NoteItem }>(`/notes/${id}`, v), NOTE_KEYS);
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

export const useUpdateProfile = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { displayName?: string; timezone?: string }) => api.patch<{ user: PublicUser }>('/auth/me', v),
		onSuccess: ({ user }) => {
			qc.setQueryData(['me'], user);
			// 時區改變會影響「今天」的判斷
			qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
			toast.success('已更新個人資料');
		},
		onError: (e) => toast.error(e.message),
	});
};
