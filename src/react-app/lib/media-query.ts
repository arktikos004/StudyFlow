import { useSyncExternalStore } from 'react';

/** CSS media query 是否成立（例如月曆在手機改成單日時間軸） */
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const media = window.matchMedia(query);
			media.addEventListener('change', onChange);
			return () => media.removeEventListener('change', onChange);
		},
		() => window.matchMedia(query).matches,
	);
}
