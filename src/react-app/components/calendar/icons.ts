import { Flag, GraduationCap, type LucideIcon } from 'lucide-react';
import type { EventItem } from '../../../shared/api-types';

/** 考試用 GraduationCap、截止日用 Flag（取代 📝／⏰） */
export const EVENT_ICON: Record<EventItem['kind'], LucideIcon> = { exam: GraduationCap, deadline: Flag };
