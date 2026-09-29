import { neutralTone, subjectTone, type SubjectTone } from '../../shared/color';
import { NO_SUBJECT_COLOR as NO_SUBJECT_HEX } from '../../shared/palette';
import { useIsDark } from './theme';

// 科目色的顯示一律經過 subjectTone（src/shared/color.ts）；這裡只負責接上目前的主題。
// 色盤資料（推薦色、DARK_STEPS、10 × 4 色格）在 src/shared/palette.ts。

/** 下一個尚未使用的推薦色（純函式放在 shared/palette.ts，測試環境也能用；這裡保留原本的 export） */
export { nextSubjectColor } from '../../shared/palette';

/** 「未分類」的灰色，兩種模式相同（保留物件形狀，既有的 import 不用改） */
export const NO_SUBJECT_COLOR = { light: NO_SUBJECT_HEX, dark: NO_SUBJECT_HEX };

/** 回傳 (hex) => 目前主題下的科目 mark 色（#rrggbb）；沒有科目時回傳「未分類」的灰色 */
export function useSubjectColor() {
	const dark = useIsDark();
	return (hex: string | undefined | null) => {
		if (!hex) return dark ? NO_SUBJECT_COLOR.dark : NO_SUBJECT_COLOR.light;
		return subjectTone(hex, dark).mark;
	};
}

/** 回傳 (hex) => 目前主題下的完整 tone（mark、tint、ring、onMark）；沒有科目時回傳「未分類」的 tone */
export function useSubjectTone() {
	const dark = useIsDark();
	return (hex: string | undefined | null): SubjectTone => (hex ? subjectTone(hex, dark) : neutralTone(dark));
}
