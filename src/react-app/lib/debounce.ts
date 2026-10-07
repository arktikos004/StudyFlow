import { useEffect, useState } from 'react';

/** value 停止變動 ms 毫秒後才跟著更新（搜尋框不必每打一個字就查詢一次） */
export function useDebounced<T>(value: T, ms = 300): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), ms);
		return () => clearTimeout(id);
	}, [value, ms]);
	return debounced;
}
