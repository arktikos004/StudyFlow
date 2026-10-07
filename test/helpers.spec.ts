import { describe, expect, it } from 'vitest';
import { localDateTime } from '../src/shared/dates';
import { noonTimezone } from './helpers';

describe('測試輔助：noonTimezone', () => {
	it('一天 24 個小時，回傳的時區都剛好是當地 12 點', () => {
		for (let hour = 0; hour < 24; hour++) {
			const now = Date.UTC(2026, 9, 7, hour, 30);
			expect(localDateTime(now, noonTimezone(now)).slice(11, 13), `UTC ${hour}:30`).toBe('12');
		}
	});
});
