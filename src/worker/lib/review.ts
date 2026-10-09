import { addDays } from '../../shared/dates';
import { REVIEW_INTERVALS } from '../../shared/schemas';

// 間隔複習的規則（錯題，以及選擇加入排程的筆記）。都是純函式，路由只負責讀寫；test/review.spec.ts 直接測。

export type ReviewState = {
	/** 已經連續答對幾次（第幾個間隔） */
	reviewStage: number;
	/** 下次複習的當地日期；null = 沒有排程 */
	nextReviewDate: string | null;
	mastered: boolean;
};

/** 第一次複習的日期：加入排程的隔天 */
export const firstReviewDate = (todayStr: string) => addDays(todayStr, REVIEW_INTERVALS[0]);

/** 已掌握的題目實際用的複習間隔：筆記自己的設定（0 = 不提醒），沒有設定時照使用者的預設；null = 不提醒 */
export function effectiveMasteredDays(noteDays: number | null, userDays: number | null): number | null {
	if (noteDays === null) return userDays;
	return noteDays === 0 ? null : noteDays;
}

/** 已掌握的題目下次複習的日期：有間隔就是今天加上間隔，不提醒就不排 */
export const masteredNextDate = (todayStr: string, days: number | null) => (days ? addDays(todayStr, days) : null);

/**
 * 複習一次之後的狀態：
 * - 忘了：從頭開始，明天再複習（已掌握的也一樣，取消已掌握）。
 * - 記得：進到下一個間隔；所有間隔都通過就是「已掌握」，之後依 masteredDays 定期複習（null = 不再排）。
 * - 已掌握的題目（使用者選擇定期複習）記得：仍是已掌握，再隔 masteredDays 天。
 */
export function afterReview(
	current: Pick<ReviewState, 'reviewStage' | 'mastered'>,
	result: 'remembered' | 'forgot',
	todayStr: string,
	masteredDays: number | null,
): ReviewState {
	if (result === 'forgot') return { reviewStage: 0, nextReviewDate: firstReviewDate(todayStr), mastered: false };
	if (current.mastered)
		return { reviewStage: current.reviewStage, nextReviewDate: masteredNextDate(todayStr, masteredDays), mastered: true };
	const reviewStage = current.reviewStage + 1;
	if (reviewStage >= REVIEW_INTERVALS.length)
		return { reviewStage, nextReviewDate: masteredNextDate(todayStr, masteredDays), mastered: true };
	return { reviewStage, nextReviewDate: addDays(todayStr, REVIEW_INTERVALS[reviewStage]), mastered: false };
}

/**
 * 編輯筆記時對複習排程的影響，回傳要更新的欄位（沒有變動的不列）：
 * - 標成已掌握，或改了已掌握題目的複習間隔（值真的變了）：依實際的間隔排下次複習（不提醒時清掉）。
 * - 取消已掌握：重新開始複習。
 * - 加入排程（scheduleReview: true）：還沒掌握、也還沒排的才排到明天。
 * - 移出排程（scheduleReview: false）：清掉複習日。
 * 已掌握的題目只看複習間隔，不看 scheduleReview（同時送「標成已掌握」與「加入排程」時以已掌握為準）。
 */
export function reviewPatch(
	current: Pick<ReviewState, 'nextReviewDate' | 'mastered'> & { masteredReviewDays: number | null },
	change: { mastered?: boolean; scheduleReview?: boolean; masteredReviewDays?: number | null },
	todayStr: string,
	userMasteredDays: number | null,
): Partial<Pick<ReviewState, 'reviewStage' | 'nextReviewDate'>> {
	const patch: Partial<Pick<ReviewState, 'reviewStage' | 'nextReviewDate'>> = {};
	if (change.mastered ?? current.mastered) {
		const newlyMastered = change.mastered === true && !current.mastered;
		// 編輯時會把原本的值一起送回來：值沒變（例如只改標題）不重排
		const daysChanged = change.masteredReviewDays !== undefined && change.masteredReviewDays !== current.masteredReviewDays;
		if (newlyMastered || daysChanged) {
			const noteDays = change.masteredReviewDays === undefined ? current.masteredReviewDays : change.masteredReviewDays;
			patch.nextReviewDate = masteredNextDate(todayStr, effectiveMasteredDays(noteDays, userMasteredDays));
		}
		return patch;
	}
	if (change.mastered === false && current.mastered) {
		patch.reviewStage = 0;
		patch.nextReviewDate = firstReviewDate(todayStr);
	}
	if (change.scheduleReview === true && !current.nextReviewDate && !current.mastered) patch.nextReviewDate = firstReviewDate(todayStr);
	if (change.scheduleReview === false) patch.nextReviewDate = null;
	return patch;
}
