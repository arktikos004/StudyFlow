import type { Subject } from '../../shared/api-types';
import { useSubjectMap, useSubjects } from '../lib/queries';
import { cn, Select } from './ui';

export function SubjectDot({ color, className }: { color?: string; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
			style={{ background: color ?? 'var(--line-strong)' }}
		/>
	);
}

/** 科目標籤：色點 + 名稱（文字維持中性色，顏色只用在色點上，確保可讀性） */
export function SubjectTag({ subjectId, className }: { subjectId: string | null | undefined; className?: string }) {
	const map = useSubjectMap();
	const s = subjectId ? map.get(subjectId) : undefined;
	if (!s) return null;
	return (
		<span className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-2', className)}>
			<SubjectDot color={s.color} />
			<span className="truncate">{s.name}</span>
		</span>
	);
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
