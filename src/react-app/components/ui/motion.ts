import { useSyncExternalStore } from 'react';

// 動效：使用者要求減少動態時，動畫改成直接到最後的樣子

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** 使用者是否要求減少動態。CSS 能處理的用 `motion-reduce:`；只有 JS 控制的動畫（拖曳歸位、捲動）才需要這個 hook */
export function usePrefersReducedMotion(): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const media = window.matchMedia(REDUCED_MOTION);
			media.addEventListener('change', onChange);
			return () => media.removeEventListener('change', onChange);
		},
		() => window.matchMedia(REDUCED_MOTION).matches,
	);
}
