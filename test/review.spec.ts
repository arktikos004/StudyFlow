import { describe, expect, it } from 'vitest';
import { REVIEW_INTERVALS } from '../src/shared/schemas';
import { afterReview, effectiveMasteredDays, firstReviewDate, reviewPatch } from '../src/worker/lib/review';

const TODAY = '2026-10-07';

describe('間隔複習的規則（lib/review.ts）', () => {
	it('第一次複習排在隔天', () => {
		expect(REVIEW_INTERVALS[0]).toBe(1);
		expect(firstReviewDate(TODAY)).toBe('2026-10-08');
		expect(firstReviewDate('2026-12-31')).toBe('2027-01-01');
	});

	it('記得：進到下一個間隔（1、3、7、14、30 天）', () => {
		expect(afterReview({ reviewStage: 0, mastered: false }, 'remembered', TODAY, null)).toEqual({
			reviewStage: 1,
			nextReviewDate: '2026-10-10',
			mastered: false,
		});
		expect(afterReview({ reviewStage: 1, mastered: false }, 'remembered', TODAY, null)).toMatchObject({
			reviewStage: 2,
			nextReviewDate: '2026-10-14',
		});
		expect(afterReview({ reviewStage: 3, mastered: false }, 'remembered', TODAY, null)).toMatchObject({
			reviewStage: 4,
			nextReviewDate: '2026-11-06',
		});
	});

	it('最後一個間隔也記得：已掌握；有定期複習的間隔就排下次，沒有就不排', () => {
		const last = REVIEW_INTERVALS.length - 1;
		expect(afterReview({ reviewStage: last, mastered: false }, 'remembered', TODAY, null)).toEqual({
			reviewStage: last + 1,
			nextReviewDate: null,
			mastered: true,
		});
		expect(afterReview({ reviewStage: last, mastered: false }, 'remembered', TODAY, 30)).toEqual({
			reviewStage: last + 1,
			nextReviewDate: '2026-11-06',
			mastered: true,
		});
	});

	it('已掌握的題目定期複習：記得就再隔一個間隔、仍是已掌握（手動標成已掌握、輪數還少的也一樣）', () => {
		expect(afterReview({ reviewStage: 1, mastered: true }, 'remembered', TODAY, 60)).toEqual({
			reviewStage: 1,
			nextReviewDate: '2026-12-06',
			mastered: true,
		});
	});

	it('忘了：從頭開始，明天再複習；已掌握的也取消', () => {
		const restart = { reviewStage: 0, nextReviewDate: '2026-10-08', mastered: false };
		expect(afterReview({ reviewStage: 0, mastered: false }, 'forgot', TODAY, null)).toEqual(restart);
		expect(afterReview({ reviewStage: 5, mastered: true }, 'forgot', TODAY, 30)).toEqual(restart);
	});

	it('已掌握題目實際的間隔：筆記自己的設定優先（0 = 不提醒），沒有設定時照使用者的預設', () => {
		expect(effectiveMasteredDays(null, 30)).toBe(30);
		expect(effectiveMasteredDays(null, null)).toBeNull();
		expect(effectiveMasteredDays(0, 30)).toBeNull();
		expect(effectiveMasteredDays(7, null)).toBe(7);
	});
});

describe('編輯筆記對複習排程的影響（reviewPatch）', () => {
	const scheduled = { nextReviewDate: '2026-10-20', mastered: false, masteredReviewDays: null };
	const unscheduled = { nextReviewDate: null, mastered: false, masteredReviewDays: null };
	const mastered = { nextReviewDate: null, mastered: true, masteredReviewDays: null };

	it('沒有動到排程相關的欄位：不改排程', () => {
		expect(reviewPatch(scheduled, {}, TODAY, null)).toEqual({});
		expect(reviewPatch(mastered, {}, TODAY, 30)).toEqual({});
	});

	it('標成已掌握：依實際的間隔排下次複習，不提醒就清掉複習日', () => {
		expect(reviewPatch(scheduled, { mastered: true }, TODAY, null)).toEqual({ nextReviewDate: null });
		expect(reviewPatch(scheduled, { mastered: true }, TODAY, 30)).toEqual({ nextReviewDate: '2026-11-06' });
		expect(reviewPatch({ ...scheduled, masteredReviewDays: 0 }, { mastered: true }, TODAY, 30)).toEqual({ nextReviewDate: null });
	});

	it('改已掌握題目的間隔：重新排；值沒變（只改標題時會一起送回原本的值）不重排', () => {
		expect(reviewPatch(mastered, { masteredReviewDays: 7 }, TODAY, null)).toEqual({ nextReviewDate: '2026-10-14' });
		const weekly = { ...mastered, masteredReviewDays: 7, nextReviewDate: '2026-10-10' };
		expect(reviewPatch(weekly, { masteredReviewDays: 7, mastered: true }, TODAY, null)).toEqual({});
		expect(reviewPatch(weekly, { masteredReviewDays: null }, TODAY, 30)).toEqual({ nextReviewDate: '2026-11-06' });
		expect(reviewPatch(weekly, { masteredReviewDays: 0 }, TODAY, 30)).toEqual({ nextReviewDate: null });
	});

	it('取消已掌握：重新開始複習；本來就沒掌握的不重設', () => {
		expect(reviewPatch(mastered, { mastered: false }, TODAY, null)).toEqual({ reviewStage: 0, nextReviewDate: '2026-10-08' });
		expect(reviewPatch(scheduled, { mastered: false }, TODAY, null)).toEqual({});
	});

	it('加入排程：還沒排、也還沒掌握的才排到明天；已掌握的題目不看這個欄位', () => {
		expect(reviewPatch(unscheduled, { scheduleReview: true }, TODAY, null)).toEqual({ nextReviewDate: '2026-10-08' });
		expect(reviewPatch(scheduled, { scheduleReview: true }, TODAY, null)).toEqual({});
		expect(reviewPatch(mastered, { scheduleReview: true }, TODAY, null)).toEqual({});
	});

	it('移出排程：清掉複習日；已掌握的題目不看這個欄位（定期複習由間隔決定）', () => {
		expect(reviewPatch(scheduled, { scheduleReview: false }, TODAY, null)).toEqual({ nextReviewDate: null });
		expect(reviewPatch({ ...mastered, nextReviewDate: '2026-11-06' }, { scheduleReview: false }, TODAY, 30)).toEqual({});
	});

	it('同時送「標成已掌握」與「加入排程」：以已掌握為準，依間隔排程', () => {
		expect(reviewPatch(unscheduled, { mastered: true, scheduleReview: true }, TODAY, null)).toEqual({ nextReviewDate: null });
		expect(reviewPatch(unscheduled, { mastered: true, scheduleReview: true }, TODAY, 30)).toEqual({ nextReviewDate: '2026-11-06' });
		expect(reviewPatch(mastered, { mastered: false, scheduleReview: false }, TODAY, null)).toEqual({
			reviewStage: 0,
			nextReviewDate: null,
		});
	});
});
