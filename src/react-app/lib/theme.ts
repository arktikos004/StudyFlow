import { useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'studyflow:theme';
const ACCENT_KEY = 'studyflow:accent';
/** 瀏覽器介面（網址列、狀態列）的顏色：跟著 page token */
const PAGE_COLOR = { light: '#f7f6f2', dark: '#0c0f18' };
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function subscribe(l: () => void) {
	listeners.add(l);
	return () => {
		listeners.delete(l);
	};
}
const notify = () => listeners.forEach((l) => l());

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
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? PAGE_COLOR.dark : PAGE_COLOR.light);
}

export function initTheme() {
	apply();
	applyAccent();
	media.addEventListener('change', () => {
		if (mode === 'system') {
			apply();
			notify();
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
	notify();
}

export function useThemeMode(): ThemeMode {
	return useSyncExternalStore(subscribe, () => mode);
}

/** 目前實際套用的是否為深色（圖表配色用） */
export function useIsDark(): boolean {
	return useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === 'dark');
}

// ---- 主題色（SUB-4） ----

/**
 * 6 組預先驗證的強調色，順序即設定頁的顯示順序。
 * 實際顏色定義在 index.css 的 [data-accent]；preview 只給色票預覽用（與 index.css 的 --accent 相同）。
 * 新增或修改時，public/theme-init.js 的清單也要同步。
 */
export const ACCENTS = [
	{ id: 'blue', name: '藍筆', preview: { light: '#2d53ca', dark: '#7da1f9' } },
	{ id: 'lake', name: '湖水青', preview: { light: '#006c82', dark: '#38afcc' } },
	{ id: 'green', name: '墨綠', preview: { light: '#00614f', dark: '#51ad95' } },
	{ id: 'grape', name: '葡萄紫', preview: { light: '#7e46bd', dark: '#b48feb' } },
	{ id: 'berry', name: '莓果', preview: { light: '#a8328a', dark: '#db84bf' } },
	{ id: 'graphite', name: '鉛筆', preview: { light: '#5a616e', dark: '#9ba2ad' } },
] as const satisfies readonly { id: string; name: string; preview: { light: string; dark: string } }[];

export type AccentId = (typeof ACCENTS)[number]['id'];

const DEFAULT_ACCENT: AccentId = 'blue';
const isAccent = (v: unknown): v is AccentId => ACCENTS.some((a) => a.id === v);

function readAccent(): AccentId {
	try {
		const v = localStorage.getItem(ACCENT_KEY);
		if (isAccent(v)) return v;
	} catch {
		// 讀不到就用預設的藍筆
	}
	return DEFAULT_ACCENT;
}

let accent = readAccent();

function applyAccent() {
	document.documentElement.dataset.accent = accent;
}

export function setAccent(next: AccentId) {
	if (!isAccent(next)) return;
	accent = next;
	try {
		if (next === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
		else localStorage.setItem(ACCENT_KEY, next);
	} catch {
		// 忽略：只影響「記住選擇」
	}
	applyAccent();
	notify();
}

export function useAccent(): AccentId {
	return useSyncExternalStore(subscribe, () => accent);
}
