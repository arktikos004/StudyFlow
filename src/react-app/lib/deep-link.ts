import { useEffect, useEffectEvent, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { dateString } from '../../shared/schemas';

// 深連結（?new=1、?open=<id>、?date=…）：從指令面板、總覽、單科頁等地方直接打開某一頁的某個項目。

type LinkValues<K extends string> = Partial<Record<K, string>>;

/**
 * 每次導覽帶來的深連結參數只處理一次，並用 replace 從網址清掉（上一頁不會又打開一次）。
 * onLink 在 render 中呼叫，可以直接 setState（例如打開對話框）；
 * 回傳 false 表示「還不能處理」（例如要等科目清單載入），之後每次 render 會再呼叫，直到處理為止。
 *
 *   useDeepLink(['new', 'open'], ({ new: isNew, open }) => {
 *     if (isNew === '1') setDialog({});
 *     if (open) setOpenId(open);
 *   });
 */
export function useDeepLink<K extends string>(keys: readonly K[], onLink: (values: LinkValues<K>) => boolean | void): void {
	const [params, setParams] = useSearchParams();
	const { key: navKey } = useLocation();
	const found = keys.filter((k) => params.has(k));
	const [link, setLink] = useState<{ navKey: string | null; seq: number; values: LinkValues<K> }>({ navKey: null, seq: 0, values: {} });
	if (found.length > 0 && link.navKey !== navKey) {
		const values = Object.fromEntries(found.map((k) => [k, params.get(k) ?? ''])) as LinkValues<K>;
		setLink({ navKey, seq: link.seq + 1, values });
	}

	const [handledSeq, setHandledSeq] = useState(0);
	if (link.seq !== handledSeq && onLink(link.values) !== false) setHandledSeq(link.seq);

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
}

/**
 * 深連結要開啟的項目（?open=<id>）：id 有值而且清單到了就找。
 * - 找到：onFound(item)，在 render 中呼叫，可以直接 setState。
 * - 找不到：快取裡的舊資料可能還沒有它（例如剛在別頁新增，清單還沒重新取得），等這次查詢回來再判斷；
 *   最後還是找不到才呼叫 onMissing（在 effect 裡，可以跳 toast）。
 * 找到或確定找不到之後呼叫 onSettled，呼叫端在這裡把 id 清掉。
 */
export function useOpenDeepLink<T extends { id: string }>(
	id: string | null,
	{
		items,
		isFetching,
		onFound,
		onMissing,
		onSettled,
	}: {
		/** 要在裡面找的清單；還沒載入（或還不能找）時傳 undefined */
		items: readonly T[] | undefined;
		isFetching: boolean;
		onFound: (item: T) => void;
		onMissing: () => void;
		onSettled: () => void;
	},
): void {
	const [missingCount, setMissingCount] = useState(0);
	if (id && items) {
		const found = items.find((item) => item.id === id);
		if (found) {
			onSettled();
			onFound(found);
		} else if (!isFetching) {
			onSettled();
			setMissingCount((n) => n + 1);
		}
	}
	const reportMissing = useEffectEvent(onMissing);
	useEffect(() => {
		if (missingCount) reportMissing();
	}, [missingCount]);
}

/** 深連結的 ?date= 是不是一個真的日期（YYYY-MM-DD） */
export const isDateParam = (value: string | undefined): value is string => !!value && dateString.safeParse(value).success;
