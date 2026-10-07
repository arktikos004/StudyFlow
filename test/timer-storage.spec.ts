import { describe, expect, it } from 'vitest';
import type { SessionInput } from '../src/shared/schemas';
import { adoptLegacyTimerData, queueKey, readQueue, timerKey, writeQueue, type KeyValueStorage } from '../src/react-app/lib/timer-storage';

// 計時狀態與待上傳紀錄依使用者分開存：共用電腦換帳號時不會串到別人的帳號

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v),
		removeItem: (k) => void data.delete(k),
	};
}

const record = (startedAt: number): SessionInput => ({ mode: 'pomodoro', startedAt, endedAt: startedAt + 25 * 60_000, durationSec: 1500 });

describe('待上傳紀錄依使用者分開', () => {
	it('A 的佇列不會出現在 B 的佇列', () => {
		const storage = memoryStorage();
		writeQueue(storage, 'alice', [record(1)]);
		expect(readQueue(storage, 'alice')).toEqual([record(1)]);
		expect(readQueue(storage, 'bob')).toEqual([]);
		expect(timerKey('alice')).not.toBe(timerKey('bob'));
		expect(queueKey('alice')).not.toBe(queueKey('bob'));
	});

	it('內容壞掉（不是陣列、不是 JSON）時當成空的', () => {
		expect(readQueue(memoryStorage({ [queueKey('alice')]: '{"a":1}' }), 'alice')).toEqual([]);
		expect(readQueue(memoryStorage({ [queueKey('alice')]: 'not json' }), 'alice')).toEqual([]);
	});
});

describe('舊版（不分使用者）的資料交給更新後第一個登入的人', () => {
	it('計時狀態與待上傳紀錄搬過去，舊的 key 刪掉，之後別人登入拿不到', () => {
		const storage = memoryStorage({
			'studyflow:timer': '{"phase":"focus"}',
			'studyflow:pending-sessions': JSON.stringify([record(1)]),
		});
		adoptLegacyTimerData(storage, 'alice');
		expect(storage.getItem(timerKey('alice'))).toBe('{"phase":"focus"}');
		expect(readQueue(storage, 'alice')).toEqual([record(1)]);
		expect(storage.getItem('studyflow:timer')).toBeNull();
		expect(storage.getItem('studyflow:pending-sessions')).toBeNull();

		adoptLegacyTimerData(storage, 'bob');
		expect(storage.getItem(timerKey('bob'))).toBeNull();
		expect(readQueue(storage, 'bob')).toEqual([]);
	});

	it('這個人已經有自己的計時就不覆蓋；待上傳紀錄接在後面', () => {
		const storage = memoryStorage({
			[timerKey('alice')]: '{"phase":"break"}',
			[queueKey('alice')]: JSON.stringify([record(1)]),
			'studyflow:timer': '{"phase":"focus"}',
			'studyflow:pending-sessions': JSON.stringify([record(2)]),
		});
		adoptLegacyTimerData(storage, 'alice');
		expect(storage.getItem(timerKey('alice'))).toBe('{"phase":"break"}');
		expect(readQueue(storage, 'alice')).toEqual([record(1), record(2)]);
		expect(storage.data.has('studyflow:timer')).toBe(false);
	});

	it('沒有舊資料時不寫任何東西', () => {
		const storage = memoryStorage();
		adoptLegacyTimerData(storage, 'alice');
		expect(storage.data.size).toBe(0);
	});
});
