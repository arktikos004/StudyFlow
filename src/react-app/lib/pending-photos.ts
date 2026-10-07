import { useEffect, useRef, useState } from 'react';

/** 還沒上傳的照片與它的預覽網址（URL.createObjectURL） */
export type PendingPhoto = { file: File; url: string };

/**
 * 新筆記的照片先暫存在本機（用暫存網址預覽），儲存筆記後才上傳。
 * 上傳完或移除時釋放那一張的暫存網址；關閉編輯視窗（卸載）時釋放全部。
 */
export function usePendingPhotos() {
	const [pending, setPending] = useState<PendingPhoto[]>([]);
	const objectUrls = useRef<string[]>([]);
	useEffect(() => {
		const urls = objectUrls.current;
		return () => urls.forEach((u) => URL.revokeObjectURL(u));
	}, []);

	const add = (files: File[]) =>
		setPending((list) => [
			...list,
			...files.map((file) => {
				const url = URL.createObjectURL(file);
				objectUrls.current.push(url);
				return { file, url };
			}),
		]);
	const remove = (photo: PendingPhoto) => {
		URL.revokeObjectURL(photo.url);
		setPending((list) => list.filter((p) => p !== photo));
	};
	return { pending, add, remove };
}
