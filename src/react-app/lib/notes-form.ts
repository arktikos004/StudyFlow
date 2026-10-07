import type { NoteItem } from '../../shared/api-types';
import type { NoteInput } from '../../shared/schemas';

// 筆記與錯題編輯視窗的表單：表單狀態與送出內容之間的轉換（純函式，test/notes-form.spec.ts）。

type NoteKind = NoteItem['kind'];

/** 表單狀態：文字欄位一律是字串（空字串＝沒填），標籤是使用者輸入的原文 */
export type NoteForm = {
	kind: NoteKind;
	title: string;
	subjectId: string | null;
	tags: string;
	content: string;
	question: string;
	wrongAnswer: string;
	correctAnswer: string;
	reason: string;
	scheduleReview: boolean;
};

/** 錯題預設加入複習排程，筆記預設不加（新增時切換類型也跟著改） */
export const defaultScheduleReview = (kind: NoteKind) => kind === 'mistake';

export function emptyNoteForm(kind: NoteKind, subjectId: string | null): NoteForm {
	return {
		kind,
		title: '',
		subjectId,
		tags: '',
		content: '',
		question: '',
		wrongAnswer: '',
		correctAnswer: '',
		reason: '',
		scheduleReview: defaultScheduleReview(kind),
	};
}

export function noteToForm(note: NoteItem): NoteForm {
	return {
		kind: note.kind,
		title: note.title,
		subjectId: note.subjectId,
		tags: note.tags.join(', '),
		content: note.content ?? '',
		question: note.question ?? '',
		wrongAnswer: note.wrongAnswer ?? '',
		correctAnswer: note.correctAnswer ?? '',
		reason: note.reason ?? '',
		scheduleReview: !!note.nextReviewDate,
	};
}

/** 標籤：用逗號（半形或全形）、頓號或空白分隔，去掉空的與重複的 */
export function parseTags(text: string): string[] {
	return [
		...new Set(
			text
				.split(/[,，、\s]+/)
				.map((t) => t.trim())
				.filter(Boolean),
		),
	];
}

const orNull = (v: string) => v.trim() || null;

/** 送出的內容：空的欄位送 null；題目、答案與錯誤原因只有錯題才有，筆記一律送 null */
export function formToNoteInput(form: NoteForm): NoteInput {
	const mistakeOnly = (v: string) => (form.kind === 'mistake' ? orNull(v) : null);
	return {
		kind: form.kind,
		title: form.title,
		subjectId: form.subjectId,
		tags: parseTags(form.tags),
		content: orNull(form.content),
		question: mistakeOnly(form.question),
		wrongAnswer: mistakeOnly(form.wrongAnswer),
		correctAnswer: mistakeOnly(form.correctAnswer),
		reason: mistakeOnly(form.reason),
		scheduleReview: form.scheduleReview,
	};
}

/** 編輯視窗的標題：新增時可以在表單裡切換錯題或筆記，所以不寫死類型 */
export function noteEditorTitle(note: Pick<NoteItem, 'kind'> | undefined): string {
	if (!note) return '新增錯題或筆記';
	return note.kind === 'mistake' ? '編輯錯題' : '編輯筆記';
}
