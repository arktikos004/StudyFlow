import type { CSSProperties } from 'react';
import type { Subject } from '../../shared/api-types';
import type { SubjectTone } from '../../shared/color';
import { useSubjectMap, useSubjects } from '../lib/queries';
import { useSubjectTone } from '../lib/subject-color';
import { cn, Select } from './ui';

/** 科目色點：color 傳科目儲存的原始顏色（留空代表未分類），依目前主題經 subjectTone 換算 */
export function SubjectDot({ color, className }: { color?: string | null; className?: string }) {
	const toneOf = useSubjectTone();
	return (
		<span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: toneOf(color).mark }} />
	);
}

/**
 * 螢光筆 chip 的外觀（純顯示）：ink 文字、科目 tint 底、1px ring、8px 圓點，名稱太長時截斷並附 title。
 * SubjectTag 與選色器的預覽共用；tone 由呼叫端用 useSubjectTone 或 subjectTone 算好。
 */
export function SubjectChip({
	name,
	tone,
	className,
	style,
}: {
	name: string;
	tone: SubjectTone;
	className?: string;
	style?: CSSProperties;
}) {
	return (
		<span
			title={name}
			className={cn('inline-flex h-5.5 max-w-full min-w-0 items-center gap-1.5 rounded-sm border px-2 text-xs text-ink', className)}
			style={{ background: tone.tint, borderColor: tone.ring, ...style }}
		>
			<span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: tone.mark }} />
			<span className="truncate">{name}</span>
		</span>
	);
}

/**
 * 科目標籤。文字一律是 ink 色，科目色只用在底色、外框與圓點。
 * - chip（預設）：螢光筆 chip。
 * - compact：圓點加名稱，用在空間很擠的地方。
 */
export function SubjectTag({
	subjectId,
	className,
	variant = 'chip',
}: {
	subjectId: string | null | undefined;
	className?: string;
	variant?: 'chip' | 'compact';
}) {
	const map = useSubjectMap();
	const toneOf = useSubjectTone();
	const subject = subjectId ? map.get(subjectId) : undefined;
	if (!subject) return null;
	const tone = toneOf(subject.color);
	if (variant === 'compact')
		return (
			<span title={subject.name} className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-2', className)}>
				<span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: tone.mark }} />
				<span className="truncate">{subject.name}</span>
			</span>
		);
	return <SubjectChip name={subject.name} tone={tone} className={className} />;
}

export function SubjectSelect({
	id,
	value,
	onChange,
	allowEmpty = true,
	emptyLabel = '不指定科目',
}: {
	id?: string;
	value: string | null | undefined;
	onChange: (v: string | null) => void;
	allowEmpty?: boolean;
	emptyLabel?: string;
}) {
	const { data: subjects = [] } = useSubjects();
	const active = subjects.filter((s: Subject) => !s.archived || s.id === value);
	return (
		<Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
			{allowEmpty && <option value="">{emptyLabel}</option>}
			{active.map((s) => (
				<option key={s.id} value={s.id}>
					{s.name}
				</option>
			))}
		</Select>
	);
}
