import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, foldLine, formatDate, formatUtc } from '../src/worker/lib/ics';

const octets = (s: string) => new TextEncoder().encode(s).length;
const unfold = (s: string) => s.replace(/\r\n /g, '');

describe('escapeText', () => {
	it('跳脫反斜線、分號、逗號與換行（RFC 5545 3.3.11）', () => {
		expect(escapeText('期中考, 第一次; 重要')).toBe('期中考\\, 第一次\\; 重要');
		expect(escapeText('C:\\temp')).toBe('C:\\\\temp');
		expect(escapeText('第一行\n第二行\r\n第三行\r第四行')).toBe('第一行\\n第二行\\n第三行\\n第四行');
		expect(escapeText('冒號: 不用跳脫')).toBe('冒號: 不用跳脫');
	});
});

describe('foldLine', () => {
	it('75 octets 以內不折行', () => {
		const line = `SUMMARY:${'a'.repeat(67)}`;
		expect(octets(line)).toBe(75);
		expect(foldLine(line)).toBe(line);
	});

	it('超過 75 octets 時折行，續行以一個空白開頭', () => {
		const line = `DESCRIPTION:${'x'.repeat(200)}`;
		const folded = foldLine(line);
		const lines = folded.split('\r\n');
		expect(lines.length).toBeGreaterThan(2);
		expect(lines.every((l) => octets(l) <= 75)).toBe(true);
		expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true);
		expect(octets(lines[0])).toBe(75);
		expect(unfold(folded)).toBe(line);
	});

	it('中文（3 bytes）與 emoji（4 bytes）不會被切斷', () => {
		for (const ch of ['考', '📚']) {
			const line = `SUMMARY:${ch.repeat(60)}`;
			const folded = foldLine(line);
			const lines = folded.split('\r\n');
			expect(lines.every((l) => octets(l) <= 75)).toBe(true);
			// 每一段都是完整的字元：沒有落單的 surrogate，編碼後再解碼不變
			for (const l of lines) expect(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(new TextEncoder().encode(l))).toBe(l);
			expect(unfold(folded)).toBe(line);
		}
	});
});

describe('日期時間格式', () => {
	it('UTC 的 DATE-TIME 與 DATE', () => {
		expect(formatUtc(Date.UTC(2026, 10, 3, 1, 10))).toBe('20261103T011000Z');
		expect(formatUtc(Date.UTC(2026, 0, 1, 0, 0, 5, 999))).toBe('20260101T000005Z');
		expect(formatDate('2027-01-10')).toBe('20270110');
	});
});

describe('buildCalendar', () => {
	it('產生 CRLF 分行的 VCALENDAR，包含全天與有時間的事件與提醒', () => {
		const now = Date.UTC(2026, 8, 29, 4, 0);
		const ics = buildCalendar(
			[
				{
					uid: 'a@studyflow',
					summary: '【考試】期中考, 第一次',
					start: { utc: Date.UTC(2026, 10, 3, 1, 10) },
					end: { utc: Date.UTC(2026, 10, 3, 2, 10) },
					location: '工學院 E101',
					description: '科目：資料結構\n帶計算機',
					categories: '考試',
					alarm: { trigger: '-P1D', description: '明天考試：期中考' },
				},
				{ uid: 'b@studyflow', summary: '【任務】複習', start: { date: '2026-10-30' }, end: { date: '2026-10-31' } },
			],
			{ name: 'StudyFlow', now },
		);
		expect(ics.endsWith('\r\n')).toBe(true);
		expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
		expect(ics.split('\r\n').every((l) => octets(l) <= 75)).toBe(true);
		expect(unfold(ics).split('\r\n')).toEqual([
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//StudyFlow//StudyFlow//ZH-TW',
			'CALSCALE:GREGORIAN',
			'METHOD:PUBLISH',
			'X-WR-CALNAME:StudyFlow',
			'BEGIN:VEVENT',
			'UID:a@studyflow',
			'DTSTAMP:20260929T040000Z',
			'DTSTART:20261103T011000Z',
			'DTEND:20261103T021000Z',
			'SUMMARY:【考試】期中考\\, 第一次',
			'LOCATION:工學院 E101',
			'DESCRIPTION:科目：資料結構\\n帶計算機',
			'CATEGORIES:考試',
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			'DESCRIPTION:明天考試：期中考',
			'TRIGGER:-P1D',
			'END:VALARM',
			'END:VEVENT',
			'BEGIN:VEVENT',
			'UID:b@studyflow',
			'DTSTAMP:20260929T040000Z',
			'DTSTART;VALUE=DATE:20261030',
			'DTEND;VALUE=DATE:20261031',
			'SUMMARY:【任務】複習',
			'END:VEVENT',
			'END:VCALENDAR',
			'',
		]);
	});

	it('沒有事件時仍是合法的空行事曆', () => {
		expect(buildCalendar([], { name: 'StudyFlow', now: 0 })).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0');
	});
});
