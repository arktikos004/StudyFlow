import { SUBJECT_COLORS } from '../../shared/schemas';
import { useIsDark } from './theme';

// 分類色盤（dataviz 驗證過）：淺色與深色各自一組，同一科目在兩種模式都是同一個色相
const DARK_STEPS: Record<string, string> = {
	'#2a78d6': '#3987e5',
	'#eb6834': '#d95926',
	'#1baf7a': '#199e70',
	'#eda100': '#c98500',
	'#e87ba4': '#d55181',
	'#008300': '#008300',
	'#4a3aa7': '#9085e9',
	'#e34948': '#e66767',
};
export const NO_SUBJECT_COLOR = { light: '#898781', dark: '#898781' };

export function useSubjectColor() {
	const dark = useIsDark();
	return (hex: string | undefined | null) => {
		if (!hex) return dark ? NO_SUBJECT_COLOR.dark : NO_SUBJECT_COLOR.light;
		return dark ? (DARK_STEPS[hex.toLowerCase()] ?? hex) : hex;
	};
}

/** 下一個尚未使用的顏色（依固定順序，不循環產生新色） */
export function nextSubjectColor(used: string[]): string {
	return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[used.length % SUBJECT_COLORS.length];
}
