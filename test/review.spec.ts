import { describe, expect, it } from 'vitest';
import { REVIEW_INTERVALS } from '../src/shared/schemas';
import { afterReview, firstReviewDate, reviewPatch } from '../src/worker/lib/review';

const TODAY = '2026-10-07';

describe('間隔複習的規則（lib/review.ts）', () => {
	it('第一次複習排在隔天', () => {
		expect(REVIEW_INTERVALS[0]).toBe(1);
		expect(firstReviewDate(TODAY)).toBe('2026-10-08');
		expect(firstReviewDate('2026-12-31')).toBe('2027-01-01');
	});

	it('記得：進到下一個間隔（1、3、7、14、30 天）', () => {
		expect(afterReview({ reviewStage: 0 }, 'remembered', TODAY)).toEqual({ reviewStage: 1, nextReviewDate: '2026-10-10', mastered: false });
		expect(afterReview({ reviewStage: 1 }, 'remembered', TODAY)).toEqual({ reviewStage: 2, nextReviewDate: '2026-10-14', mastered: false });
		expect(afterReview({ reviewStage: 3 }, 'remembered', TODAY)).toEqual({ reviewStage: 4, nextReviewDate: '2026-11-06', mastered: false });
	});

	it('最後一個間隔也記得：已掌握，不再排複習', () => {
		const last = REVIEW_INTERVALS.length - 1;
		expect(afterReview({ reviewStage: last }, 'remembered', TODAY)).toEqual({
			reviewStage: last + 1,
			nextReviewDate: null,
			mastered: true,
		});
	});

	it('忘了：不論複習到第幾次都從頭開始，明天再複習', () => {
		const restart = { reviewStage: 0, nextReviewDate: '2026-10-08', mastered: false };
		expect(afterReview({ reviewStage: 0 }, 'forgot', TODAY)).toEqual(restart);
		expect(afterReview({ reviewStage: 4 }, 'forgot', TODAY)).toEqual(restart);
	});
});

describe('編輯筆記對複習排程的影響（reviewPatch）', () => {
	const scheduled = { nextReviewDate: '2026-10-20', mastered: false };
	const unscheduled = { nextReviewDate: null, mastered: false };
	const mastered = { nextReviewDate: null, mastered: true };

	it('沒有動到 mastered 與 scheduleReview：不改排程', () => {
		expect(reviewPatch(scheduled, {}, TODAY)).toEqual({});
		expect(reviewPatch(mastered, {}, TODAY)).toEqual({});
	});

	it('標成已掌握：清掉複習日', () => {
		expect(reviewPatch(scheduled, { mastered: true }, TODAY)).toEqual({ nextReviewDate: null });
	});

	it('取消已掌握：重新開始複習；本來就沒掌握的不重設', () => {
		expect(reviewPatch(mastered, { mastered: false }, TODAY)).toEqual({ reviewStage: 0, nextReviewDate: '2026-10-08' });
		expect(reviewPatch(scheduled, { mastered: false }, TODAY)).toEqual({});
	});

	it('加入排程：還沒排、也還沒掌握的才排到明天', () => {
		expect(reviewPatch(unscheduled, { scheduleReview: true }, TODAY)).toEqual({ nextReviewDate: '2026-10-08' });
		expect(reviewPatch(scheduled, { scheduleReview: true }, TODAY)).toEqual({});
		expect(reviewPatch(mastered, { scheduleReview: true }, TODAY)).toEqual({});
	});

	it('移出排程：清掉複習日', () => {
		expect(reviewPatch(scheduled, { scheduleReview: false }, TODAY)).toEqual({ nextReviewDate: null });
	});

	it('兩個欄位一起送：scheduleReview 後套用（目前的行為，未掌握又沒排程的筆記會留下複習日）', () => {
		expect(reviewPatch(unscheduled, { mastered: true, scheduleReview: true }, TODAY)).toEqual({ nextReviewDate: '2026-10-08' });
		expect(reviewPatch(mastered, { mastered: false, scheduleReview: false }, TODAY)).toEqual({ reviewStage: 0, nextReviewDate: null });
	});
});
