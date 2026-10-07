import { describe, expect, it } from 'vitest';
import { draftPreview, KEEP_PHOTO, photoNote, removeDraft, type PhotoDraft } from '../src/react-app/lib/profile-photo';

// 編輯個人資料時，照片的變更（review B5）：「移除照片」的語意都在這三個純函式裡。
const CURRENT = '/api/auth/avatar?v=1';
const picked: PhotoDraft = { kind: 'set', blob: new Blob(['x'], { type: 'image/jpeg' }), url: 'blob:preview' };
const removed: PhotoDraft = { kind: 'remove' };

describe('照片的變更（PhotoDraft）', () => {
	it('預覽：新選的照片優先；移除後沒有照片；沒有變更時顯示目前的照片', () => {
		expect(draftPreview(picked, CURRENT)).toBe('blob:preview');
		expect(draftPreview(picked, null)).toBe('blob:preview');
		expect(draftPreview(removed, CURRENT)).toBeNull();
		expect(draftPreview(KEEP_PHOTO, CURRENT)).toBe(CURRENT);
		expect(draftPreview(KEEP_PHOTO, null)).toBeNull();
	});

	it('按「移除照片」：有舊照片才是移除；沒有舊照片時只是取消這次新選的照片', () => {
		expect(removeDraft(CURRENT)).toEqual({ kind: 'remove' });
		expect(removeDraft(null)).toBe(KEEP_PHOTO);
	});

	it('欄位下方的說明跟著變更改變', () => {
		expect(photoNote(KEEP_PHOTO)).toBe('JPEG、PNG 或 WebP，會置中裁成正方形');
		expect(photoNote(picked)).toBe('新照片會在儲存後套用');
		expect(photoNote(removed)).toBe('儲存後會移除照片，改用暱稱的第一個字');
	});
});
