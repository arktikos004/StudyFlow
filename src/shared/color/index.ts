// 科目色（DESIGN.md §3）對外的入口。App 只從這裡 import；換算與度量的細節在同一個資料夾的其他檔案。
export { hexToHsv, hsvToHex, parseHex, type Hsv } from './convert';
export { neutralTone, subjectTone, TONE_SURFACES, type SubjectTone } from './subject-tone';
export { colorLabel, colorWarnings, suggestColor, type NamedColor } from './advice';
