import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { Subject } from '../../shared/api-types';
import type { SubjectTone } from '../../shared/color';
import { firstGrapheme } from '../lib/polish-format';
import { useSubjectMap, useSubjects } from '../lib/queries';
import { useSubjectTone } from '../lib/subject-color';
import { subjectIcon } from '../lib/subject-icons';
import { cn, Select } from './ui';

/** 科目色點：color 傳科目儲存的原始顏色（留空代表未分類），依目前主題經 subjectTone 換算 */
export function SubjectDot({ color, className }: { color?: string | null; className?: string }) {
	const toneOf = useSubjectTone();
	return (
		<span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: toneOf(color).mark }} />
	);
}

/** 科目圖示（SubjectTag 內部用）：跟著文字顏色（ink），不用科目色 */
function TagIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
	const def = subjectIcon(icon);
	if (!def) return null;
	return <def.Icon aria-hidden className={cn('shrink-0', className)} strokeWidth={2} />;
}

/**
 * 螢光筆 chip 的外觀（純顯示）：ink 文字、科目 tint 底、1px ring、8px 圓點，有圖示時接在圓點後面；
 * 名稱太長時截斷並附 title。SubjectTag 與選色器的預覽共用；tone 由呼叫端用 useSubjectTone 或 subjectTone 算好。
 */
export function SubjectChip({
	name,
	tone,
	icon,
	className,
	style,
}: {
	name: string;
	tone: SubjectTone;
	/** SUBJECT_ICONS 的 key；null 或省略就不顯示圖示 */
	icon?: string | null;
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
			<TagIcon icon={icon} className="-mx-0.5 size-3" />
			<span className="truncate group-hover/subject-link:underline">{name}</span>
		</span>
	);
}

/**
 * 科目圖示方塊的外觀（純顯示）：科目 mark 底、onMark 圖示；沒有圖示時顯示名稱的第一個字。
 * 裝飾用、aria-hidden（所以不加 title），名稱要由旁邊的文字提供；不可放進按鈕或連結當唯一內容。
 * - 第一個字是文字，對比門檻比圖示高：用 19px 粗體（WCAG 的大字，門檻 3:1）。onMark 會在白色與深色文字之間
 *   選對比較高的那個，48 個色盤色在淺色、深色下最低 4.24／4.39，任意自訂色也都在 3:1 以上（test/polish-subject-tile.spec.ts）。
 * - 第一個字以字素切（firstGrapheme），emoji、組合字不會被切半。
 * SubjectTag 的 icon 版與「手上已經有科目資料」的地方（單科總覽的標題，資料來自同一次 API）共用；
 * tone 由呼叫端用 useSubjectTone 算好。大小用 className 調整（預設 40px）。
 */
export function SubjectIconTile({
	name,
	tone,
	icon,
	className,
}: {
	name: string;
	tone: SubjectTone;
	/** SUBJECT_ICONS 的 key；null 或省略就顯示名稱的第一個字 */
	icon?: string | null;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				'grid size-10 shrink-0 place-items-center rounded-lg text-[1.1875rem] leading-none font-bold [&_svg]:size-5',
				className,
			)}
			style={{ background: tone.mark, color: tone.onMark }}
		>
			{subjectIcon(icon) ? <TagIcon icon={icon} /> : firstGrapheme(name)}
		</span>
	);
}

/**
 * 科目標籤。文字一律是 ink 色，科目色只用在底色、外框與圓點；科目圖示只透過這個檔案的元件顯示。
 * - chip（預設）：螢光筆 chip（圓點＋圖示＋名稱）。
 * - compact：圓點＋圖示＋名稱，用在空間很擠的地方。
 * - icon：只有圖示方塊（SubjectIconTile），裝飾用、aria-hidden，
 *   名稱要由旁邊的文字提供（例如單科總覽頁的標題）。大小用 className 調整（預設 40px）。
 *
 * asLink：連到單科總覽 `/subjects/:id`（名稱加上「的科目總覽」給螢幕報讀器；觸控裝置點擊範圍 44px 高）。
 * SubjectTag 常常放在按鈕或連結裡，所以預設不是連結；已經在互動元素裡時不要加 asLink。
 */
export function SubjectTag({
	subjectId,
	className,
	variant = 'chip',
	asLink = false,
}: {
	subjectId: string | null | undefined;
	className?: string;
	variant?: 'chip' | 'compact' | 'icon';
	asLink?: boolean;
}) {
	const map = useSubjectMap();
	const toneOf = useSubjectTone();
	const subject = subjectId ? map.get(subjectId) : undefined;
	if (!subject) return null;
	const tone = toneOf(subject.color);

	if (variant === 'icon') return <SubjectIconTile name={subject.name} tone={tone} icon={subject.icon} className={className} />;

	const tag =
		variant === 'compact' ? (
			<span title={subject.name} className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-2', !asLink && className)}>
				<span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: tone.mark }} />
				<TagIcon icon={subject.icon} className="-mx-0.5 size-3" />
				<span className="truncate group-hover/subject-link:underline">{subject.name}</span>
			</span>
		) : (
			<SubjectChip name={subject.name} tone={tone} icon={subject.icon} className={asLink ? undefined : className} />
		);
	if (!asLink) return tag;
	return (
		<Link
			to={`/subjects/${subject.id}`}
			className={cn(
				'group/subject-link relative inline-flex max-w-full min-w-0 rounded-sm',
				// 觸控裝置：chip 只有 22px 高，用 ::after 把點擊範圍上下各延伸 11px（共 44px）
				'pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-[11px]',
				className,
			)}
		>
			{tag}
			<span className="sr-only">的科目總覽</span>
		</Link>
	);
}

export function SubjectSelect({
	id,
	value,
	onChange,
	allowEmpty = true,
	emptyLabel = '不指定科目',
	...aria
}: {
	id?: string;
	value: string | null | undefined;
	onChange: (v: string | null) => void;
	allowEmpty?: boolean;
	emptyLabel?: string;
	/** 由 Field 傳入（提示／錯誤訊息），或沒有可見標籤時用 aria-label 命名 */
	'aria-describedby'?: string;
	'aria-invalid'?: boolean | 'true' | 'false';
	'aria-label'?: string;
}) {
	const { data: subjects = [] } = useSubjects();
	const active = subjects.filter((s: Subject) => !s.archived || s.id === value);
	return (
		<Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} {...aria}>
			{allowEmpty && <option value="">{emptyLabel}</option>}
			{active.map((s) => (
				<option key={s.id} value={s.id}>
					{s.name}
				</option>
			))}
		</Select>
	);
}
