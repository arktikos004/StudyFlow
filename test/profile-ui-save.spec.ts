import { describe, expect, it, vi } from 'vitest';
import type { PhotoDraft } from '../src/react-app/lib/profile-photo';
import { photoWasSaved, saveFailureMessage, saveProfile, type SaveDeps, type SaveResult } from '../src/react-app/lib/profile-save';

const blob = new Blob(['jpeg'], { type: 'image/jpeg' });
const SET: PhotoDraft = { kind: 'set', blob, url: 'blob:preview' };
const REMOVE: PhotoDraft = { kind: 'remove' };
const KEEP: PhotoDraft = { kind: 'keep' };

/** 假的依賴：預設全部成功、有網路、沒有被放棄；calls 記下呼叫順序 */
function fakeDeps(over: Partial<SaveDeps> = {}) {
	const calls: string[] = [];
	const deps: SaveDeps = {
		uploadPhoto: vi.fn(async () => {
			calls.push('upload');
		}),
		removePhoto: vi.fn(async () => {
			calls.push('remove');
		}),
		updateName: vi.fn(async (name: string) => {
			calls.push(`name:${name}`);
		}),
		isOnline: () => true,
		isCurrent: () => true,
		...over,
	};
	return { deps, calls };
}

describe('儲存個人資料（saveProfile）', () => {
	it('先存照片再存暱稱；只改一項時只呼叫那一項', async () => {
		const both = fakeDeps();
		expect(await saveProfile({ draft: SET, name: '小安同學' }, both.deps)).toEqual({ status: 'saved' });
		expect(both.calls).toEqual(['upload', 'name:小安同學']);
		expect(both.deps.uploadPhoto).toHaveBeenCalledWith(blob);

		const photoOnly = fakeDeps();
		expect(await saveProfile({ draft: SET, name: null }, photoOnly.deps)).toEqual({ status: 'saved' });
		expect(photoOnly.calls).toEqual(['upload']);

		const removeOnly = fakeDeps();
		expect(await saveProfile({ draft: REMOVE, name: null }, removeOnly.deps)).toEqual({ status: 'saved' });
		expect(removeOnly.calls).toEqual(['remove']);

		const nameOnly = fakeDeps();
		expect(await saveProfile({ draft: KEEP, name: '新暱稱' }, nameOnly.deps)).toEqual({ status: 'saved' });
		expect(nameOnly.calls).toEqual(['name:新暱稱']);
	});

	it('照片失敗：暱稱不會被存', async () => {
		const error = new Error('照片太大（上限 1MB）');
		const { deps, calls } = fakeDeps({ uploadPhoto: vi.fn(async () => Promise.reject(error)) });
		const result = await saveProfile({ draft: SET, name: '不該被存' }, deps);
		expect(result).toEqual({ status: 'photo-failed', error });
		expect(deps.updateName).not.toHaveBeenCalled();
		expect(calls).toEqual([]);
		expect(photoWasSaved(result)).toBe(false);
	});

	it('移除失敗：暱稱不會被存', async () => {
		const error = new Error('伺服器暫時無法處理');
		const { deps } = fakeDeps({ removePhoto: vi.fn(async () => Promise.reject(error)) });
		expect(await saveProfile({ draft: REMOVE, name: '不該被存' }, deps)).toEqual({ status: 'photo-failed', error });
		expect(deps.updateName).not.toHaveBeenCalled();
	});

	it('照片成功、暱稱失敗：回報部分成功', async () => {
		const error = new Error('暱稱最多 30 個字');
		const { deps, calls } = fakeDeps({ updateName: vi.fn(async () => Promise.reject(error)) });
		const result = await saveProfile({ draft: SET, name: '新暱稱' }, deps);
		expect(result).toEqual({ status: 'name-failed', error, photoDone: true });
		expect(calls).toEqual(['upload']);
		expect(photoWasSaved(result)).toBe(true);
	});

	it('只改暱稱而且失敗：不是部分成功', async () => {
		const error = new Error('無法連線到伺服器，請稍後再試');
		const { deps } = fakeDeps({ updateName: vi.fn(async () => Promise.reject(error)) });
		const result = await saveProfile({ draft: KEEP, name: '新暱稱' }, deps);
		expect(result).toEqual({ status: 'name-failed', error, photoDone: false });
		expect(photoWasSaved(result)).toBe(false);
	});

	it('一開始就離線：什麼都不送', async () => {
		const { deps, calls } = fakeDeps({ isOnline: () => false });
		const result = await saveProfile({ draft: SET, name: '新暱稱' }, deps);
		expect(result).toEqual({ status: 'offline', photoDone: false });
		expect(calls).toEqual([]);
		expect(deps.uploadPhoto).not.toHaveBeenCalled();
		expect(deps.updateName).not.toHaveBeenCalled();
	});

	it('照片存好之後才斷線（review A2）：不送暱稱，回報照片已經存好', async () => {
		let online = true;
		const { deps, calls } = fakeDeps({
			isOnline: () => online,
			uploadPhoto: vi.fn(async () => {
				online = false;
			}),
		});
		const result = await saveProfile({ draft: SET, name: '新暱稱' }, deps);
		expect(result).toEqual({ status: 'offline', photoDone: true });
		expect(deps.updateName).not.toHaveBeenCalled();
		expect(calls).toEqual([]);
		expect(photoWasSaved(result)).toBe(true);
	});

	it('上傳途中關掉對話框（review A1）：上傳完成後不存暱稱', async () => {
		let current = true;
		let finishUpload: () => void = () => {};
		const { deps } = fakeDeps({
			isCurrent: () => current,
			uploadPhoto: vi.fn(() => new Promise<void>((resolve) => (finishUpload = resolve))),
		});
		const pending = saveProfile({ draft: SET, name: '按了取消就不該存' }, deps);
		// 使用者按「取消」：這一輪不算數了；之後上傳才完成
		current = false;
		finishUpload();
		expect(await pending).toEqual({ status: 'abandoned' });
		expect(deps.updateName).not.toHaveBeenCalled();
	});

	it('關掉對話框之後上傳才失敗：也是放棄，不回報照片失敗', async () => {
		let current = true;
		let failUpload: (e: Error) => void = () => {};
		const { deps } = fakeDeps({
			isCurrent: () => current,
			uploadPhoto: vi.fn(() => new Promise<void>((_, reject) => (failUpload = reject))),
		});
		const pending = saveProfile({ draft: SET, name: null }, deps);
		current = false;
		failUpload(new Error('無法連線到伺服器，請稍後再試'));
		expect(await pending).toEqual({ status: 'abandoned' });
	});

	it('存暱稱途中關掉對話框：請求收不回來，但回報放棄（呼叫端不碰畫面）', async () => {
		let current = true;
		let finishName: () => void = () => {};
		const { deps, calls } = fakeDeps({
			isCurrent: () => current,
			updateName: vi.fn(() => new Promise<void>((resolve) => (finishName = resolve))),
		});
		const pending = saveProfile({ draft: SET, name: '新暱稱' }, deps);
		await vi.waitFor(() => expect(deps.updateName).toHaveBeenCalledWith('新暱稱'));
		current = false;
		finishName();
		expect(await pending).toEqual({ status: 'abandoned' });
		expect(calls).toEqual(['upload']);
	});

	it('一開始就已經不算數（對話框已經關掉）：什麼都不送', async () => {
		const { deps, calls } = fakeDeps({ isCurrent: () => false });
		expect(await saveProfile({ draft: SET, name: '新暱稱' }, deps)).toEqual({ status: 'abandoned' });
		expect(calls).toEqual([]);
	});

	it('沒有任何變更：直接算存好，不呼叫任何依賴', async () => {
		const { deps, calls } = fakeDeps();
		expect(await saveProfile({ draft: KEEP, name: null }, deps)).toEqual({ status: 'saved' });
		expect(calls).toEqual([]);
	});
});

describe('對話框裡的失敗訊息（saveFailureMessage）', () => {
	const message = (result: SaveResult, draft: PhotoDraft, name: string | null) => saveFailureMessage(result, { draft, name });

	it('成功或已放棄時沒有訊息', () => {
		expect(message({ status: 'saved' }, SET, '新暱稱')).toBeNull();
		expect(message({ status: 'abandoned' }, SET, '新暱稱')).toBeNull();
	});

	it('離線：什麼都沒送，或照片已經存好只剩暱稱', () => {
		expect(message({ status: 'offline', photoDone: false }, SET, '新暱稱')).toBe('目前離線，連上網路後再儲存');
		expect(message({ status: 'offline', photoDone: true }, SET, '新暱稱')).toBe('照片已經更新，但目前離線，暱稱還沒儲存。連上網路後再按一次「儲存」');
		expect(message({ status: 'offline', photoDone: true }, REMOVE, '新暱稱')).toBe('照片已經移除，但目前離線，暱稱還沒儲存。連上網路後再按一次「儲存」');
	});

	it('照片失敗：附上後端的原因；暱稱也在等的話一起說', () => {
		const error = new Error('照片太大（上限 1MB）');
		expect(message({ status: 'photo-failed', error }, SET, null)).toBe('照片上傳失敗：照片太大（上限 1MB）');
		expect(message({ status: 'photo-failed', error }, SET, '新暱稱')).toBe('照片上傳失敗：照片太大（上限 1MB）。暱稱也還沒儲存');
		expect(message({ status: 'photo-failed', error: new Error('找不到頭像') }, REMOVE, null)).toBe('照片移除失敗：找不到頭像');
	});

	it('暱稱失敗：照片已經存好時說清楚是部分成功', () => {
		const error = new Error('無法連線到伺服器，請稍後再試');
		expect(message({ status: 'name-failed', error, photoDone: true }, SET, '新暱稱')).toBe('照片已經更新，但暱稱沒有儲存：無法連線到伺服器，請稍後再試');
		expect(message({ status: 'name-failed', error, photoDone: true }, REMOVE, '新暱稱')).toBe('照片已經移除，但暱稱沒有儲存：無法連線到伺服器，請稍後再試');
		expect(message({ status: 'name-failed', error, photoDone: false }, KEEP, '新暱稱')).toBe('暱稱沒有儲存：無法連線到伺服器，請稍後再試');
	});

	it('錯誤沒有訊息時用「請再試一次」', () => {
		expect(message({ status: 'photo-failed', error: 'boom' }, SET, null)).toBe('照片上傳失敗：請再試一次');
		expect(message({ status: 'name-failed', error: new Error(''), photoDone: false }, KEEP, '新暱稱')).toBe('暱稱沒有儲存：請再試一次');
	});
});
