import { DAY_MS, MINUTE_MS } from './time';

// 以 'YYYY-MM-DD' 字串表示的「日曆日期」工具，前後端共用。
// 日期運算一律在 UTC 正午進行，避免夏令時間或時區造成跨日誤差。

// 建立 Intl.DateTimeFormat 很花 CPU，統計與匯出會逐筆換算，所以快取起來重複使用。
// 時區字串來自使用者資料（大小寫不同也是不同的 key），快取一定要有上限，否則會一直佔用 isolate 的記憶體：
// 用 Map 的插入順序做 LRU，用到的移到最後，滿了就刪掉最前面（最久沒用）的那一個。
const MAX_FORMATTERS = 64;
const formatters = new Map<string, Intl.DateTimeFormat>();
function cached(key: string, create: () => Intl.DateTimeFormat) {
	let f = formatters.get(key);
	if (f) {
		formatters.delete(key);
	} else {
		f = create();
		if (formatters.size >= MAX_FORMATTERS) formatters.delete(formatters.keys().next().value!);
	}
	formatters.set(key, f);
	return f;
}

/** 目前快取的 formatter 數量（測試用：確認快取有上限） */
export function formatterCacheSize() {
	return formatters.size;
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

// sv-SE 的日期時間格式剛好是 'YYYY-MM-DD HH:mm'：匯出時每筆只需要呼叫一次 format()
const dateTimeFormat = (timeZone: string) =>
	cached(
		`datetime|${timeZone}`,
		() =>
			new Intl.DateTimeFormat('sv-SE', {
				timeZone,
				hourCycle: 'h23',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
			}),
	);

/** 'YYYY-MM-DD HH:mm'：某個瞬間在該時區的當地日期與時間 */
export function localDateTime(epochMs: number, timeZone: string): string {
	return dateTimeFormat(timeZone).format(epochMs);
}

/** 'YYYY-MM-DD' 是不是真的有這一天（2026-02-31、2026-13-01 都不是） */
export function isRealDate(date: string): boolean {
	const [y, m, d] = date.split('-').map(Number);
	// 用 setUTCFullYear 而不是 Date.UTC：Date.UTC 會把 0–99 年當成 1900–1999
	const utc = new Date(0);
	utc.setUTCFullYear(y, m - 1, d);
	return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
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
	return Math.round((toUtcNoon(to).getTime() - toUtcNoon(from).getTime()) / DAY_MS);
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

/** 某個瞬間在該時區的牆上時間，換成「當作 UTC 的毫秒」（精確到分鐘） */
function wallClock(epochMs: number, timeZone: string) {
	const p = localParts(epochMs, timeZone);
	return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}

/** 某個瞬間該時區的 UTC 偏移（毫秒）＝牆上時間 − UTC */
const offsetAt = (epochMs: number, timeZone: string) => wallClock(epochMs, timeZone) - Math.floor(epochMs / MINUTE_MS) * MINUTE_MS;

/**
 * 某時區當地的 'YYYY-MM-DD' 加上 'HH:mm' 所對應的 epoch 毫秒。
 * 夏令時間切換時依 RFC 5545 §3.3.5，一律用切換前的偏移解讀：
 * - 春季跳過、不存在的時間（紐約 2026-03-08 02:30）：當成 02:30 EST = 07:30Z，牆上顯示 03:30
 * - 秋季重複出現的時間（紐約 2026-11-01 01:30）：取第一次出現（EDT）
 */
export function zonedTime(date: string, time: string, timeZone: string): number {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = time.split(':').map(Number);
	const local = Date.UTC(y, m - 1, d, hh, mm);
	// 前一天與後一天的偏移，就是切換前與切換後的偏移（一天內最多切換一次）
	const before = local - offsetAt(local - DAY_MS, timeZone);
	const after = local - offsetAt(local + DAY_MS, timeZone);
	if (before === after) return before;
	const beforeOk = wallClock(before, timeZone) === local;
	const afterOk = wallClock(after, timeZone) === local;
	if (beforeOk && afterOk) return Math.min(before, after); // 重複的時段：第一次出現
	if (afterOk) return after;
	return before; // 只有切換前的對得上，或是落在跳過的時段：用切換前的偏移
}

/**
 * 某時區某日開始的 epoch 毫秒（處理任意 UTC 偏移）。
 * 在午夜切換夏令時間的時區（Santiago、Havana），當天的 00:00 不存在，
 * 會得到跳躍的那個瞬間，也就是那一天真正開始的時間，不會落到前一天。
 */
export function startOfLocalDay(date: string, timeZone: string): number {
	return zonedTime(date, '00:00', timeZone);
}
