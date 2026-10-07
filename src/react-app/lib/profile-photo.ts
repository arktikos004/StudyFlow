// 編輯個人資料時，照片的變更（還沒儲存）。純資料，元件在 components/settings/ProfilePhotoField.tsx。

/**
 * - keep：維持目前的照片（或目前沒有照片）。
 * - set：選了新照片（已經裁好的 JPEG；url 是預覽用的 blob: 網址，由持有 draft 的元件負責 revoke）。
 * - remove：儲存後移除照片，改回暱稱的第一個字。
 */
export type PhotoDraft = { kind: 'keep' } | { kind: 'set'; blob: Blob; url: string } | { kind: 'remove' };

export const KEEP_PHOTO: PhotoDraft = { kind: 'keep' };

/** 預覽要顯示的照片：新選的、移除後沒有、或維持目前的 */
export function draftPreview(draft: PhotoDraft, currentSrc: string | null): string | null {
	if (draft.kind === 'set') return draft.url;
	return draft.kind === 'remove' ? null : currentSrc;
}

/** 按下「移除照片」：有舊照片就改成「移除」；沒有舊照片時只是取消這次新選的照片 */
export function removeDraft(currentSrc: string | null): PhotoDraft {
	return currentSrc ? { kind: 'remove' } : KEEP_PHOTO;
}

/** 照片欄位下方的說明（aria-live 念出來） */
export function photoNote(draft: PhotoDraft): string {
	if (draft.kind === 'set') return '新照片會在儲存後套用';
	if (draft.kind === 'remove') return '儲存後會移除照片，改用暱稱的第一個字';
	return 'JPEG、PNG 或 WebP，會置中裁成正方形';
}
