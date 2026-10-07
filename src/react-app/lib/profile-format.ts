// 個人檔案（PRO-1）的純邏輯：加入時間、累積數字的文字、一列放得下幾個徽章、時區選單。
// 累積數字的型別是 src/shared/api-types.ts 的 ProfileSummary（GET /api/profile/summary）。
// 不碰 DOM 與 React，test/profile-ui-format.spec.ts 直接測。

const COUNT = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 });

/** 數量：千分位、最多一位小數（1,234、40.6）；負數與 NaN 當成 0 */
export function formatCount(n: number): string {
	return COUNT.format(Number.isFinite(n) && n > 0 ? n : 0);
}

/**
 * 加入時間：「2026 年 9 月加入」。年月依使用者的時區判斷（UTC 的 8/31 16:00 在台北已經是 9/1）；
 * 時區不合法時改用 UTC，不會丟錯。dateTime 給 <time dateTime>（2026-09）。
 */
export function joinedLabel(createdAt: number, timeZone: string): { text: string; dateTime: string } {
	const parts = (tz: string) =>
		new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric' }).formatToParts(createdAt);
	let list: Intl.DateTimeFormatPart[];
	try {
		list = parts(timeZone);
	} catch {
		list = parts('UTC');
	}
	const year = list.find((p) => p.type === 'year')?.value ?? '';
	const month = Number(list.find((p) => p.type === 'month')?.value ?? 0);
	return { text: `${year} 年 ${month} 月加入`, dateTime: `${year}-${String(month).padStart(2, '0')}` };
}

/**
 * 累積學習時間：未滿 1 小時用分鐘（「45 分鐘」）；1 小時以上用小時，無條件捨去到一位小數（「40.6 小時」，和成就頁的進度一致，
 * 不會比實際多）；100 小時以上只留整數（「128 小時」）。0 顯示「0 小時」。
 */
export function studyTotal(totalMinutes: number): { value: string; unit: string } {
	const m = Number.isFinite(totalMinutes) ? Math.floor(totalMinutes) : 0;
	if (m <= 0) return { value: '0', unit: '小時' };
	if (m < 60) return { value: String(m), unit: '分鐘' };
	const hours = Math.floor(m / 6) / 10;
	return { value: formatCount(hours >= 100 ? Math.floor(hours) : hours), unit: '小時' };
}

/** 學習累積的副標：「共 32 次學習」 */
export function sessionsNote(totalSessions: number): string {
	return `共 ${formatCount(totalSessions)} 次學習`;
}

/** 連續天數的副標：最長紀錄；目前就是最長紀錄時直接說；兩個都是 0 時給下一步 */
export function streakNote(current: number, longest: number): string {
	if (current <= 0 && longest <= 0) return '今天讀書就能開始累積';
	if (current > 0 && current >= longest) return '目前就是最長紀錄';
	return `最長 ${formatCount(Math.max(current, longest))} 天`;
}

/** 完成量的副標：「已掌握 3 題錯題」 */
export function masteredNote(mistakesMastered: number): string {
	return `已掌握 ${formatCount(mistakesMastered)} 題錯題`;
}

/**
 * 一列放得下幾個徽章（寬度單位都是 px）：全部放得下就全部顯示；放不下時留一格給「+N」（chip 寬），
 * 其餘的格子放徽章。回傳要顯示的徽章數（0…count）。
 */
export function badgeCapacity(width: number, count: number, size: number, gap: number, chip = size): number {
	if (count <= 0) return 0;
	if (count * size + (count - 1) * gap <= width) return count;
	const fit = Math.floor((width - chip) / (size + gap));
	return Math.max(0, Math.min(count - 1, fit));
}

/** 個人檔案徽章列的尺寸（rem）：徽章 1.75rem（28px）、間距 0.5rem（8px）、「+N」最寬約 2.125rem（34px，+11） */
export const BADGE_ROW = { size: 1.75, gap: 0.5, chip: 2.125 } as const;

/**
 * 個人檔案的徽章列放得下幾個：width 是這一列實際的寬度（px），rootFontSize 是 <html> 的字級（px）。
 * 徽章的尺寸是 rem，使用者把瀏覽器的預設字級調大時會跟著變大，所以換算後再算（不能假設 1rem = 16px）。
 */
export function badgeRowCapacity(width: number, count: number, rootFontSize: number): number {
	const px = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
	return badgeCapacity(width, count, BADGE_ROW.size * px, BADGE_ROW.gap * px, BADGE_ROW.chip * px);
}

/**
 * Email 的換行點：在「@」與「.」前面斷開（alex.chen.2026@student.example 換行 .edu.tw），
 * 不會在單字中間斷（example.e／du.tw）。回傳的片段依序接起來就是原本的 Email。
 */
export function emailParts(email: string): string[] {
	return email.split(/(?=[@.])/).filter(Boolean);
}

/** 時區選單的常用選項；使用者目前的時區不在清單裡時排在最前面 */
export const TIMEZONES = [
	'Asia/Taipei',
	'Asia/Tokyo',
	'Asia/Hong_Kong',
	'Asia/Shanghai',
	'Asia/Singapore',
	'Europe/London',
	'America/New_York',
	'America/Los_Angeles',
	'Australia/Sydney',
] as const;

export function timezoneOptions(current: string): string[] {
	const list: string[] = [...TIMEZONES];
	return list.includes(current) ? list : [current, ...list];
}

/**
 * 時區選項的文字：「Asia/Taipei（GMT+8）」，偏移依 at 當下（有日光節約時間的地區會變）；取不到偏移時只顯示 ID。
 * 零偏移統一寫成「GMT+0」（瀏覽器會給「GMT」，選單裡和其他選項的格式一致）。
 */
export function timezoneLabel(timeZone: string, at: number = Date.now()): string {
	try {
		const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
			.formatToParts(at)
			.find((p) => p.type === 'timeZoneName')?.value;
		if (!offset) return timeZone;
		return `${timeZone}（${/^(GMT|UTC)$/.test(offset) ? 'GMT+0' : offset}）`;
	} catch {
		return timeZone;
	}
}
