import {
	Atom,
	BookOpen,
	Brain,
	Briefcase,
	Calculator,
	ChartBar,
	CodeXml,
	Cpu,
	Database,
	Dna,
	Dumbbell,
	FlaskConical,
	Globe,
	Heart,
	Landmark,
	Languages,
	Leaf,
	Microscope,
	Music,
	Network,
	Palette,
	PenLine,
	Scale,
	Sigma,
	type LucideIcon,
} from 'lucide-react';
import { SUBJECT_ICONS, type SubjectIcon } from '../../shared/schemas';

// 科目圖示（SUB-2）：後端白名單 SUBJECT_ICONS 的每個 key 對應一個 lucide 圖示。
// 只 import 用到的 24 個圖示（lucide-react 可 tree-shake），不要整包引入。
// 畫面上的科目圖示一律透過 SubjectTag 顯示；這裡只給 SubjectTag 與圖示選擇器使用。

export type SubjectIconDef = {
	Icon: LucideIcon;
	/** zh-TW 名稱：選擇器的無障礙名稱與提示文字（描述圖示本身，不綁定科目） */
	label: string;
};

export const SUBJECT_ICON_MAP = {
	book: { Icon: BookOpen, label: '書本' },
	calculator: { Icon: Calculator, label: '計算機' },
	sigma: { Icon: Sigma, label: '總和符號' },
	flask: { Icon: FlaskConical, label: '燒瓶' },
	atom: { Icon: Atom, label: '原子' },
	dna: { Icon: Dna, label: 'DNA' },
	leaf: { Icon: Leaf, label: '葉子' },
	globe: { Icon: Globe, label: '地球' },
	languages: { Icon: Languages, label: '語言' },
	pen: { Icon: PenLine, label: '筆' },
	code: { Icon: CodeXml, label: '程式碼' },
	cpu: { Icon: Cpu, label: '晶片' },
	database: { Icon: Database, label: '資料庫' },
	network: { Icon: Network, label: '網路' },
	chart: { Icon: ChartBar, label: '長條圖' },
	landmark: { Icon: Landmark, label: '建築' },
	scale: { Icon: Scale, label: '天平' },
	briefcase: { Icon: Briefcase, label: '公事包' },
	palette: { Icon: Palette, label: '調色盤' },
	music: { Icon: Music, label: '音符' },
	dumbbell: { Icon: Dumbbell, label: '啞鈴' },
	heart: { Icon: Heart, label: '愛心' },
	brain: { Icon: Brain, label: '大腦' },
	microscope: { Icon: Microscope, label: '顯微鏡' },
} as const satisfies Record<SubjectIcon, SubjectIconDef>;

/** 選擇器的顯示順序（與 SUBJECT_ICONS 相同） */
export const SUBJECT_ICON_OPTIONS: readonly ({ key: SubjectIcon } & SubjectIconDef)[] = SUBJECT_ICONS.map((key) => ({
	key,
	...SUBJECT_ICON_MAP[key],
}));

export const isSubjectIcon = (v: unknown): v is SubjectIcon => typeof v === 'string' && Object.hasOwn(SUBJECT_ICON_MAP, v);

/** 資料庫裡的 key → 圖示；null、空字串或不在白名單（例如之後移除的圖示）時回傳 null，畫面就不顯示圖示 */
export function subjectIcon(key: string | null | undefined): SubjectIconDef | null {
	return isSubjectIcon(key) ? SUBJECT_ICON_MAP[key] : null;
}
