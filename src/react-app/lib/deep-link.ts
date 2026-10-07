import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

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
