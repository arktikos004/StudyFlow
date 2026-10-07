import type { SessionInput } from '../../shared/schemas';

// 計時狀態與待上傳的學習紀錄存在 localStorage，每個使用者各一份：
// 共用電腦上換帳號時，別人的計時不會出現在這個帳號，別人沒送出的紀錄也不會用這個帳號送出。
// 不依賴瀏覽器（storage 由呼叫端傳入），test/timer-storage.spec.ts 直接測試。

/** 用到的 localStorage 方法（測試用 Map 做一個；不用 DOM 的 Storage 型別，測試環境沒有） */
export type KeyValueStorage = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
};

export const timerKey = (userId: string) => `studyflow:timer:${userId}`;
export const queueKey = (userId: string) => `studyflow:pending-sessions:${userId}`;

/** 舊版不分使用者的 key */
const LEGACY_TIMER_KEY = 'studyflow:timer';
const LEGACY_QUEUE_KEY = 'studyflow:pending-sessions';

/** 待上傳的學習紀錄；內容壞掉（不是陣列）時當成空的，不讓之後每次送出都出錯 */
export function readQueue(storage: KeyValueStorage, userId: string): SessionInput[] {
	try {
		const parsed: unknown = JSON.parse(storage.getItem(queueKey(userId)) ?? '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function writeQueue(storage: KeyValueStorage, userId: string, queue: readonly SessionInput[]): void {
	storage.setItem(queueKey(userId), JSON.stringify(queue));
}

/**
 * 舊版（不分使用者）留下的計時與待上傳紀錄，交給更新後第一個登入的人，然後刪掉舊的 key。
 * 舊版本來就是「誰登入就算誰的」，所以這次交接的結果和舊版相同，而且只會發生一次。
 * 計時狀態：這個人還沒有自己的才搬過去；待上傳紀錄：接在這個人的佇列後面。
 */
export function adoptLegacyTimerData(storage: KeyValueStorage, userId: string): void {
	const legacyTimer = storage.getItem(LEGACY_TIMER_KEY);
	if (legacyTimer !== null) {
		if (storage.getItem(timerKey(userId)) === null) storage.setItem(timerKey(userId), legacyTimer);
		storage.removeItem(LEGACY_TIMER_KEY);
	}
	const legacyQueue = storage.getItem(LEGACY_QUEUE_KEY);
	if (legacyQueue !== null) {
		let records: unknown;
		try {
			records = JSON.parse(legacyQueue);
		} catch {
			records = [];
		}
		if (Array.isArray(records) && records.length > 0) writeQueue(storage, userId, [...readQueue(storage, userId), ...records]);
		storage.removeItem(LEGACY_QUEUE_KEY);
	}
}
