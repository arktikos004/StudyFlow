import { useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'studyflow:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function readMode(): ThemeMode {
	try {
		const v = localStorage.getItem(KEY);
		if (v === 'light' || v === 'dark') return v;
	} catch {
		// 無痕模式等情況讀不到 localStorage，就跟隨系統
	}
	return 'system';
}

let mode = readMode();

function apply() {
	const dark = mode === 'dark' || (mode === 'system' && media.matches);
	document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d0d0d' : '#f6f6f3');
}

export function initTheme() {
	apply();
	media.addEventListener('change', () => {
		if (mode === 'system') {
			apply();
			listeners.forEach((l) => l());
		}
	});
}

export function setThemeMode(next: ThemeMode) {
	mode = next;
	try {
		if (next === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, next);
	} catch {
		// 忽略：只影響「記住選擇」
	}
	apply();
	listeners.forEach((l) => l());
}

export function useThemeMode(): ThemeMode {
	return useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => mode,
	);
}

/** 目前實際套用的是否為深色（圖表配色用） */
export function useIsDark(): boolean {
	return useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => document.documentElement.dataset.theme === 'dark',
	);
}
