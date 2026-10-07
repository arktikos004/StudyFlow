// 「編輯個人資料」的儲存流程（PRO-1）：純 async 函式，依賴都由呼叫端注入，test/profile-ui-save.spec.ts 用假的依賴直接測。
// 元件在 components/settings/ProfileDialog.tsx。
import type { PhotoDraft } from './profile-photo';

export type SaveDeps = {
	uploadPhoto: (file: Blob) => Promise<unknown>;
	removePhoto: () => Promise<unknown>;
	updateName: (displayName: string) => Promise<unknown>;
	/** 現在有沒有網路（TanStack Query 的 onlineManager）：離線時 mutation 會被暫停、連線後才補送，所以離線就不送 */
	isOnline: () => boolean;
	/** 這一輪儲存還算數嗎？對話框被關掉（或關掉後重新打開）就回傳 false，後面的步驟全部放棄 */
	isCurrent: () => boolean;
};

export type SaveInput = {
	draft: PhotoDraft;
	/** 要存的暱稱（已經檢查過格式）；null 代表暱稱沒有改 */
	name: string | null;
};

export type SaveResult =
	/** 全部存好了 */
	| { status: 'saved' }
	/** 使用者關掉了對話框：不再往下做，呼叫端不要碰畫面的狀態（已經送出的請求收不回來） */
	| { status: 'abandoned' }
	/** 離線所以沒有送出；photoDone 為 true 代表照片已經存好，只剩暱稱（部分成功） */
	| { status: 'offline'; photoDone: boolean }
	/** 照片上傳或移除失敗：什麼都沒存 */
	| { status: 'photo-failed'; error: unknown }
	/** 暱稱儲存失敗；photoDone 為 true 代表照片已經存好（部分成功） */
	| { status: 'name-failed'; error: unknown; photoDone: boolean };

/**
 * 先處理照片（上傳或移除），成功才存暱稱：
 * - 一開始就離線：什麼都不送。
 * - 照片失敗：不存暱稱。
 * - 照片成功後才斷線、或暱稱失敗：照片已經存好，回報部分成功，再存一次只需要存暱稱。
 * - 每個等待結束後都檢查 isCurrent()：對話框已經關掉就放棄（不存暱稱、回傳 abandoned）。
 */
export async function saveProfile({ draft, name }: SaveInput, deps: SaveDeps): Promise<SaveResult> {
	const abandoned: SaveResult = { status: 'abandoned' };
	if (!deps.isCurrent()) return abandoned;
	if (!deps.isOnline()) return { status: 'offline', photoDone: false };

	const photoChanged = draft.kind !== 'keep';
	if (photoChanged) {
		try {
			if (draft.kind === 'set') await deps.uploadPhoto(draft.blob);
			else await deps.removePhoto();
		} catch (error) {
			return deps.isCurrent() ? { status: 'photo-failed', error } : abandoned;
		}
		if (!deps.isCurrent()) return abandoned;
	}

	if (name === null) return { status: 'saved' };
	if (!deps.isOnline()) return { status: 'offline', photoDone: photoChanged };
	try {
		await deps.updateName(name);
	} catch (error) {
		return deps.isCurrent() ? { status: 'name-failed', error, photoDone: photoChanged } : abandoned;
	}
	return deps.isCurrent() ? { status: 'saved' } : abandoned;
}

/** 這次儲存有沒有把照片存好（畫面要把「新選的照片」換成「目前的照片」） */
export function photoWasSaved(result: SaveResult): boolean {
	return (result.status === 'offline' || result.status === 'name-failed') && result.photoDone;
}

const reason = (error: unknown) => (error instanceof Error && error.message ? error.message : '請再試一次');

/**
 * 儲存沒有完成時，顯示在對話框裡的訊息（role="alert"）；成功或已放棄時回傳 null。
 * 對話框是 modal，toast 在對話框外面，螢幕報讀器不一定念得到，所以對話框裡要有一份。
 */
export function saveFailureMessage(result: SaveResult, { draft, name }: SaveInput): string | null {
	const photoDoneText = draft.kind === 'remove' ? '照片已經移除' : '照片已經更新';
	switch (result.status) {
		case 'saved':
		case 'abandoned':
			return null;
		case 'offline':
			return result.photoDone ? `${photoDoneText}，但目前離線，暱稱還沒儲存。連上網路後再按一次「儲存」` : '目前離線，連上網路後再儲存';
		case 'photo-failed':
			return `${draft.kind === 'remove' ? '照片移除失敗' : '照片上傳失敗'}：${reason(result.error)}${name === null ? '' : '。暱稱也還沒儲存'}`;
		case 'name-failed':
			return `${result.photoDone ? `${photoDoneText}，但` : ''}暱稱沒有儲存：${reason(result.error)}`;
	}
}
