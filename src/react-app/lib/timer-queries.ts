import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { EventItem, StudySession } from '../../shared/api-types';
import { api, qs } from './api';

// s2/timer 的頁面 hook（計時頁、月曆）。

/**
 * 和 queries.ts 的 useEvents 相同（query key、queryFn 都一樣，快取與 invalidate 共用），
 * 另外在換範圍時保留上一個範圍的資料：月曆切換月份或週次時，新資料載入前畫面不會閃成空白。
 */
export function useEventsKeep(params: { from?: string; to?: string } = {}) {
	return useQuery({
		queryKey: ['events', params],
		queryFn: async () => (await api.get<{ events: EventItem[] }>(`/events${qs(params)}`)).events,
		placeholderData: (prev) => prev,
	});
}

/** 和 queries.ts 的 useStudySessions 相同，另外在換範圍時保留上一個範圍的資料（同 useEventsKeep） */
export function useSessionsKeep(params: { from?: string; to?: string } = {}) {
	return useQuery({
		queryKey: ['sessions', params],
		queryFn: async () => (await api.get<{ sessions: StudySession[] }>(`/study-sessions${qs(params)}`)).sessions,
		placeholderData: (prev) => prev,
	});
}

export type DeepLink<K extends string> = { seq: number; values: Partial<Record<K, string>> };

/**
 * 深連結參數（?new=1、?open=<id>、?date=…）：每次導覽帶來的參數只交出一次，並用 replace 從網址清掉。
 * seq 在每次有新的深連結時加一；頁面用「seq 改變時調整 state」的寫法開啟對話框：
 *
 *   const link = useDeepLink(['new', 'open']);
 *   const [seen, setSeen] = useState(0);
 *   if (link.seq !== seen) { setSeen(link.seq); if (link.values.new === '1') setDialog({}); }
 */
export function useDeepLink<K extends string>(keys: readonly K[]): DeepLink<K> {
	const [params, setParams] = useSearchParams();
	const { key: navKey } = useLocation();
	const found = keys.filter((k) => params.has(k));
	const [link, setLink] = useState<DeepLink<K> & { navKey: string | null }>({ navKey: null, seq: 0, values: {} });
	if (found.length > 0 && link.navKey !== navKey) {
		const values = Object.fromEntries(found.map((k) => [k, params.get(k) ?? ''])) as Partial<Record<K, string>>;
		setLink({ navKey, seq: link.seq + 1, values });
	}

	const pending = found.join(',');
	useEffect(() => {
		if (!pending) return;
		setParams(
			(p) => {
				pending.split(',').forEach((k) => p.delete(k));
				return p;
			},
			{ replace: true },
		);
	}, [pending, setParams]);

	return link;
}

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

/** 每 30 秒更新一次的「現在」（月曆的現在時間線、今天） */
export function useMinuteClock(): number {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);
	return now;
}
