import { useEffect, useState } from 'react';
import { MINUTE_MS } from '../../shared/time';

/** 每 30 秒更新一次的「現在」（月曆的現在時間線、今天） */
export function useMinuteClock(): number {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), MINUTE_MS / 2);
		return () => clearInterval(id);
	}, []);
	return now;
}
