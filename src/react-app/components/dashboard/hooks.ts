import { useSubjectMap } from '../../lib/queries';
import { useSubjectColor } from '../../lib/subject-color';

/** 回傳 (subjectId) => 科目色（subjectTone 的 mark）；沒有科目時回傳 undefined，進度條改用主題色 */
export function useSubjectMark() {
	const subjects = useSubjectMap();
	const colorOf = useSubjectColor();
	return (subjectId: string | null | undefined) => {
		const s = subjectId ? subjects.get(subjectId) : undefined;
		return s ? colorOf(s.color) : undefined;
	};
}
