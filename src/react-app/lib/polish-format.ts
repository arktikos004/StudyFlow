// s3/polish 的格式化函式（lib/format.ts 在 Sprint 2 凍結）。

/**
 * 文字的第一個字素：emoji（含膚色、ZWJ 組合、國旗）與組合字不會被切半。
 * 不支援 Intl.Segmenter 的環境退回以碼位切（Array.from），至少不會把代理對切開。
 * 前後空白先去掉；空字串回傳 ''。
 */
export function firstGrapheme(text: string): string {
	const s = text.trim();
	if (!s) return '';
	if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
		const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
		if (!first.done) return first.value.segment;
	}
	return Array.from(s)[0] ?? '';
}
