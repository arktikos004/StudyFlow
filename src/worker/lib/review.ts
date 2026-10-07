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

/**
 * 複習一次之後的狀態：
 * - 忘了：從頭開始，明天再複習。
 * - 記得：進到下一個間隔；所有間隔都通過就是「已掌握」，不再排複習。
 */
export function afterReview(current: Pick<ReviewState, 'reviewStage'>, result: 'remembered' | 'forgot', todayStr: string): ReviewState {
	if (result === 'forgot') return { reviewStage: 0, nextReviewDate: firstReviewDate(todayStr), mastered: false };
	const reviewStage = current.reviewStage + 1;
	if (reviewStage >= REVIEW_INTERVALS.length) return { reviewStage, nextReviewDate: null, mastered: true };
	return { reviewStage, nextReviewDate: addDays(todayStr, REVIEW_INTERVALS[reviewStage]), mastered: false };
}

/**
 * 編輯筆記時對複習排程的影響，回傳要更新的欄位（沒有變動的不列）：
 * - 標成已掌握：不再排複習。
 * - 取消已掌握：重新開始複習。
 * - 加入排程（scheduleReview: true）：還沒排、也還沒掌握的才排到明天。
 * - 移出排程（scheduleReview: false）：清掉複習日。
 * 兩個欄位一起送時，scheduleReview 後套用。
 */
export function reviewPatch(
	current: Pick<ReviewState, 'nextReviewDate' | 'mastered'>,
	change: { mastered?: boolean; scheduleReview?: boolean },
	todayStr: string,
): Partial<Pick<ReviewState, 'reviewStage' | 'nextReviewDate'>> {
	const patch: Partial<Pick<ReviewState, 'reviewStage' | 'nextReviewDate'>> = {};
	if (change.mastered === true) {
		patch.nextReviewDate = null;
	} else if (change.mastered === false && current.mastered) {
		patch.reviewStage = 0;
		patch.nextReviewDate = firstReviewDate(todayStr);
	}
	if (change.scheduleReview === true && !current.nextReviewDate && !current.mastered) patch.nextReviewDate = firstReviewDate(todayStr);
	if (change.scheduleReview === false) patch.nextReviewDate = null;
	return patch;
}
