import {
	AlarmClock,
	Award,
	Brain,
	CalendarCheck,
	Clock,
	Flame,
	GraduationCap,
	Hourglass,
	ListChecks,
	Sparkles,
	Target,
	Timer,
	Trophy,
	type LucideIcon,
	type LucideProps,
} from 'lucide-react';
import { createElement } from 'react';

/**
 * 成就圖示：後端回傳 lucide 圖示名稱（kebab-case），這裡用白名單對應，只 import 用到的圖示（可 tree-shake），
 * 不要動態 import 整包 lucide。後端新增成就時要在這裡補上對應；沒有對應的名稱顯示 Award。
 */
const ACHIEVEMENT_ICONS: Readonly<Record<string, LucideIcon>> = {
	sparkles: Sparkles,
	clock: Clock,
	hourglass: Hourglass,
	trophy: Trophy,
	flame: Flame,
	'calendar-check': CalendarCheck,
	timer: Timer,
	'alarm-clock': AlarmClock,
	brain: Brain,
	'graduation-cap': GraduationCap,
	'list-checks': ListChecks,
	target: Target,
};

export function achievementIcon(name: string): LucideIcon {
	return Object.hasOwn(ACHIEVEMENT_ICONS, name) ? ACHIEVEMENT_ICONS[name] : Award;
}

/** 成就圖示元件（名稱 → 白名單圖示），其餘 props 照傳給 lucide 圖示 */
export function AchievementIcon({ name, ...props }: { name: string } & LucideProps) {
	return createElement(achievementIcon(name), props);
}
