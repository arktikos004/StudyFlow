// 以 'YYYY-MM-DD' 字串表示的「日曆日期」工具，前後端共用。
// 日期運算一律在 UTC 正午進行，避免夏令時間或時區造成跨日誤差。

export function localDate(epochMs: number, timeZone: string): string {
	// en-CA 的日期格式剛好是 YYYY-MM-DD
	return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(epochMs);
}

export function today(timeZone: string): string {
	return localDate(Date.now(), timeZone);
}

function toUtcNoon(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUtc(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
	const d = toUtcNoon(date);
	d.setUTCDate(d.getUTCDate() + days);
	return fromUtc(d);
}

export function diffDays(from: string, to: string): number {
	return Math.round((toUtcNoon(to).getTime() - toUtcNoon(from).getTime()) / 86_400_000);
}

/** 該日期所在週的週一 */
export function weekStart(date: string): string {
	const dow = toUtcNoon(date).getUTCDay(); // 0 = 週日
	return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function dateRange(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
	return out;
}

/** 某時區某日 00:00 的 epoch 毫秒（處理任意 UTC 偏移） */
export function startOfLocalDay(date: string, timeZone: string): number {
	const guess = toUtcNoon(date).getTime() - 12 * 3_600_000;
	// 用該時刻在目標時區的時間差修正偏移，最多修正兩次以處理夏令時間邊界
	let ts = guess;
	for (let i = 0; i < 2; i++) {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}).formatToParts(ts);
		const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
		const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
		ts += guess - asUtc;
	}
	return ts;
}
