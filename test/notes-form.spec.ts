import { describe, expect, it } from 'vitest';
import type { NoteItem } from '../src/shared/api-types';
import { noteSchema } from '../src/shared/schemas';
import { emptyNoteForm, formToNoteInput, noteEditorTitle, noteToForm, parseTags } from '../src/react-app/lib/notes-form';

// 筆記與錯題編輯視窗的表單轉換

const note: NoteItem = {
	id: 'n1',
	userId: 'u1',
	subjectId: '6c8f0d3e-2f4b-4c1a-9d7e-1b2c3d4e5f60',
	kind: 'mistake',
	title: '遞迴式',
	content: null,
	question: '題目',
	wrongAnswer: null,
	correctAnswer: '答案',
	reason: null,
	tags: ['遞迴', '期中考'],
	mastered: false,
	pinned: false,
	reviewStage: 1,
	nextReviewDate: '2026-10-08',
	lastReviewedAt: null,
	createdAt: 0,
	updatedAt: 0,
	attachments: [],
};

describe('表單初始值', () => {
	it('新增：錯題預設加入複習排程，筆記不加；預先帶入科目', () => {
		expect(emptyNoteForm('mistake', 's1')).toMatchObject({ kind: 'mistake', subjectId: 's1', title: '', scheduleReview: true });
		expect(emptyNoteForm('note', null)).toMatchObject({ kind: 'note', subjectId: null, scheduleReview: false });
	});

	it('編輯：null 欄位變成空字串、標籤用「, 」接起來、有下次複習日就是在排程裡', () => {
		expect(noteToForm(note)).toEqual({
			kind: 'mistake',
			title: '遞迴式',
			subjectId: '6c8f0d3e-2f4b-4c1a-9d7e-1b2c3d4e5f60',
			tags: '遞迴, 期中考',
			content: '',
			question: '題目',
			wrongAnswer: '',
			correctAnswer: '答案',
			reason: '',
			scheduleReview: true,
		});
		expect(noteToForm({ ...note, nextReviewDate: null }).scheduleReview).toBe(false);
	});
});

describe('parseTags', () => {
	it('用半形或全形逗號、頓號、空白分隔，去掉空的與重複的', () => {
		expect(parseTags('遞迴, 期中考，排序、  遞迴\n圖論')).toEqual(['遞迴', '期中考', '排序', '圖論']);
		expect(parseTags(' , ， ')).toEqual([]);
	});
});

describe('formToNoteInput', () => {
	it('前後空白去掉，空的欄位送 null；標題原樣（由 schema trim 與檢查）', () => {
		const input = formToNoteInput({
			...emptyNoteForm('mistake', null),
			title: ' 第 5 題 ',
			content: '  ',
			question: ' 題目 ',
			reason: '\n',
		});
		expect(input).toMatchObject({ title: ' 第 5 題 ', content: null, question: '題目', wrongAnswer: null, reason: null, tags: [] });
	});

	it('筆記不送錯題才有的欄位（切換類型前填的內容不會被存進去）', () => {
		const form = { ...noteToForm(note), kind: 'note' as const, content: '重點' };
		expect(formToNoteInput(form)).toMatchObject({
			kind: 'note',
			content: '重點',
			question: null,
			wrongAnswer: null,
			correctAnswer: null,
			reason: null,
		});
	});

	it('送出的內容通過共用的 noteSchema', () => {
		expect(noteSchema.safeParse(formToNoteInput(noteToForm(note))).success).toBe(true);
	});
});

describe('noteEditorTitle', () => {
	it('新增時不寫死類型；編輯時依類型', () => {
		expect(noteEditorTitle(undefined)).toBe('新增錯題或筆記');
		expect(noteEditorTitle({ kind: 'mistake' })).toBe('編輯錯題');
		expect(noteEditorTitle({ kind: 'note' })).toBe('編輯筆記');
	});
});
