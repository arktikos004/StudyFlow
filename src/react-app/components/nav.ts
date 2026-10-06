import {
	CalendarDays,
	ChartColumn,
	GraduationCap,
	LayoutDashboard,
	ListChecks,
	NotebookPen,
	Settings,
	Timer,
	Trophy,
	type LucideIcon,
} from 'lucide-react';

export type NavItem = {
	to: string;
	label: string;
	/** 手機底部導覽用的短名稱 */
	short?: string;
	icon: LucideIcon;
	end?: boolean;
};

/** 側欄依用途分組，組與組之間靠空白分隔：安排 → 讀書 → 回顧 → 設定 */
export const NAV_GROUPS: NavItem[][] = [
	[
		{ to: '/', label: '總覽', icon: LayoutDashboard, end: true },
		{ to: '/calendar', label: '月曆', icon: CalendarDays },
		{ to: '/events', label: '考試與截止日', icon: GraduationCap },
		{ to: '/tasks', label: '學習任務', short: '任務', icon: ListChecks },
	],
	[
		{ to: '/timer', label: '學習計時', short: '計時', icon: Timer },
		{ to: '/notes', label: '筆記與錯題', short: '筆記', icon: NotebookPen },
	],
	[
		{ to: '/stats', label: '學習統計', icon: ChartColumn },
		{ to: '/achievements', label: '成就', icon: Trophy },
	],
	[{ to: '/settings', label: '設定', icon: Settings }],
];

export const NAV: NavItem[] = NAV_GROUPS.flat();

/** 手機底部只放最常用的四個，其餘收進「更多」 */
export const MOBILE_MAIN = ['/', '/tasks', '/timer', '/notes'];
