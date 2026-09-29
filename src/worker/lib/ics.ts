// iCalendar（RFC 5545）產生工具：匯入 Google 日曆、Apple 行事曆、Outlook 用

/** 3.3.11 TEXT：跳脫反斜線、分號、逗號，換行寫成 \n */
export function escapeText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\r|\n/g, '\\n');
}

const utf8Length = (codePoint: number) => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4);

/**
 * 3.1 折行：每行最多 75 octets（不含 CRLF），續行以一個空白開頭（空白也算在 75 裡）。
 * 以 code point 為單位切，不會把中文等多位元組字元從中間切斷。
 */
export function foldLine(line: string): string {
	const out: string[] = [];
	let current = '';
	let octets = 0;
	for (const ch of line) {
		const size = utf8Length(ch.codePointAt(0)!);
		if (octets + size > 75) {
			out.push(current);
			current = ' ';
			octets = 1;
		}
		current += ch;
		octets += size;
	}
	out.push(current);
	return out.join('\r\n');
}

/** epoch 毫秒 → UTC 的 DATE-TIME，例如 20261010T011000Z */
export function formatUtc(epochMs: number): string {
	return new Date(epochMs).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** 'YYYY-MM-DD' → DATE，例如 20261010 */
export function formatDate(date: string): string {
	return date.replace(/-/g, '');
}

/** 全天：當地日期；有時間：UTC 的瞬間 */
export type IcsTime = { date: string } | { utc: number };

export type IcsEvent = {
	/** 同一筆資料每次匯出都相同，重新匯入時日曆 App 才會更新而不是重複 */
	uid: string;
	summary: string;
	start: IcsTime;
	/** 全天事件的結束日不包含在內（隔天） */
	end: IcsTime;
	location?: string | null;
	description?: string | null;
	categories?: string;
	/** 提醒：trigger 是相對於開始時間的 DURATION，例如 -P1D */
	alarm?: { trigger: string; description: string };
};

const timeLine = (name: 'DTSTART' | 'DTEND', t: IcsTime) =>
	'date' in t ? `${name};VALUE=DATE:${formatDate(t.date)}` : `${name}:${formatUtc(t.utc)}`;

/** 整份行事曆：CRLF 換行、每行折到 75 octets 以內 */
export function buildCalendar(events: IcsEvent[], { name, now }: { name: string; now: number }): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//StudyFlow//StudyFlow//ZH-TW',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(name)}`,
	];
	const stamp = formatUtc(now);
	for (const e of events) {
		lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`, timeLine('DTSTART', e.start), timeLine('DTEND', e.end));
		lines.push(`SUMMARY:${escapeText(e.summary)}`);
		if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
		if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
		if (e.categories) lines.push(`CATEGORIES:${escapeText(e.categories)}`);
		if (e.alarm) {
			lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.alarm.description)}`, `TRIGGER:${e.alarm.trigger}`, 'END:VALARM');
		}
		lines.push('END:VEVENT');
	}
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}
