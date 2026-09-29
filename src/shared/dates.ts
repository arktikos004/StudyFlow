// 以 'YYYY-MM-DD' 字串表示的「日曆日期」工具，前後端共用。
// 日期運算一律在 UTC 正午進行，避免夏令時間或時區造成跨日誤差。

// 建立 Intl.DateTimeFormat 很花 CPU，統計與匯出會逐筆換算，所以每個時區只建立一次
const formatters = new Map<string, Intl.DateTimeFormat>();
function cached(key: string, create: () => Intl.DateTimeFormat) {
	let f = formatters.get(key);
	if (!f) {
		f = create();
		formatters.set(key, f);
	}
	return f;
}

// en-CA 的日期格式剛好是 YYYY-MM-DD
const dateFormat = (timeZone: string) =>
	cached(`date|${timeZone}`, () => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));

/** 某個瞬間在該時區的年月日時分（都是補零的字串） */
function localParts(epochMs: number, timeZone: string) {
	const parts = cached(
		`parts|${timeZone}`,
		() =>
			new Intl.DateTimeFormat('en-US', {
				timeZone,
				hourCycle: 'h23',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
			}),
	).formatToParts(epochMs);
	const get = (t: string) => parts.find((p) => p.type === t)!.value;
	return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

export function localDate(epochMs: number, timeZone: string): string {
	return dateFormat(timeZone).format(epochMs);
}

/** 'YYYY-MM-DD HH:mm'：某個瞬間在該時區的當地日期與時間 */
export function localDateTime(epochMs: number, timeZone: string): string {
	const p = localParts(epochMs, timeZone);
	return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
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

/** 某時區當地的 'YYYY-MM-DD' 加上 'HH:mm' 所對應的 epoch 毫秒（處理任意 UTC 偏移與夏令時間） */
export function zonedTime(date: string, time: string, timeZone: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = time.split(':').map(Number);
	const guess = Date.UTC(y, m - 1, d, hh, mm);
	// 用該時刻在目標時區的時間差修正偏移，最多修正兩次以處理夏令時間邊界
	let ts = guess;
	for (let i = 0; i < 2; i++) {
		const p = localParts(ts, timeZone);
		const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
		ts += guess - asUtc;
	}
	return ts;
}

/** 某時區某日 00:00 的 epoch 毫秒（處理任意 UTC 偏移） */
export function startOfLocalDay(date: string, timeZone: string): number {
	return zonedTime(date, '00:00', timeZone);
}
