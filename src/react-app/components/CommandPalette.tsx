import {
	ArrowDown,
	ArrowUp,
	CalendarClock,
	CircleAlert,
	CircleCheck,
	CornerDownLeft,
	FilePlus,
	FileQuestionMark,
	FolderPlus,
	GraduationCap,
	ListChecks,
	ListPlus,
	NotebookPen,
	Play,
	Search,
	SearchX,
	Timer as TimerIcon,
	type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { SEARCH_QUERY_MAX } from '../../shared/schemas';
import { EVENT_KIND_LABEL, formatDate } from '../lib/format';
import { useSearch } from '../lib/queries';
import { matchesQuery, PAGE_KEYWORDS, QUICK_ACTIONS, resultHref, stepIndex, type QuickActionId } from '../lib/shell-palette';
import { useTimerState } from '../lib/timer';
import { NAV } from './nav';
import { SubjectDot, SubjectTag } from './subjects';
import { cn, Highlight, Kbd, Spinner } from './ui';

/** 每一組最多顯示幾筆（後端也是每類 5 筆） */
const GROUP_LIMIT = 5;
/** 停止輸入多久後才送出搜尋 */
const DEBOUNCE_MS = 160;

const ACTION_ICON: Record<QuickActionId, LucideIcon> = {
	focus: Play,
	'new-task': ListPlus,
	'new-mistake': FilePlus,
	'new-subject': FolderPlus,
};

type Option = {
	/** 在整個清單裡唯一，例如 task:abc */
	key: string;
	to: string;
	icon: ReactNode;
	title: ReactNode;
	meta?: ReactNode;
};
type Group = { key: string; label: string; options: Option[] };

const iconClass = 'size-[18px]';

/**
 * 全站指令面板（APP-1）：Ctrl/⌘K 或頁首的搜尋按鈕開啟，由 Layout 掛載，關閉時整個卸載（下次打開是空的）。
 *
 * 無障礙：WAI-ARIA combobox（input role="combobox" + aria-activedescendant），焦點一直留在輸入框；
 * listbox 內用 role="group" 分組（組名以 aria-labelledby 指向組標題）。上下鍵移動（循環）、Enter 開啟、Esc 關閉。
 * 中文輸入法選字時（isComposing）不處理上下鍵與 Enter，也不送出搜尋。
 *
 * onClose：要求 Layout 卸載面板。焦點在卸載時處理：選了項目就移到新頁面的主要內容，否則還給打開前的元素。
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
	const navigate = useNavigate();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const downOnBackdrop = useRef(false);
	const uid = useId();
	const listboxId = `${uid}-listbox`;
	const optionId = (i: number) => `${uid}-opt-${i}`;

	// value：輸入框的原始內容；text：已確定的文字（注音選字中不更新），比對與搜尋都用 text
	const [value, setValue] = useState('');
	const [text, setText] = useState('');
	const [composing, setComposing] = useState(false);
	const trimmed = text.trim();

	// 防抖：停止輸入 DEBOUNCE_MS 後才查詢；清空時立即回到快捷動作
	const [debounced, setDebounced] = useState('');
	useEffect(() => {
		if (composing) return;
		const id = setTimeout(() => setDebounced(trimmed), trimmed ? DEBOUNCE_MS : 0);
		return () => clearTimeout(id);
	}, [trimmed, composing]);
	const term = trimmed ? debounced : '';
	const search = useSearch(term);
	const settled = !!term && term === trimmed && !search.isFetching;

	const timer = useTimerState();
	const timerActive = timer.phase !== 'idle';

	const groups = useMemo<Group[]>(() => {
		const actionOptions: Option[] = QUICK_ACTIONS.filter((a) => matchesQuery([a.label, ...a.keywords], trimmed)).map((a) => {
			// 已經在計時：「開始專注」改成「回到計時」，不會讓人以為會重開一輪
			const resume = a.id === 'focus' && timerActive;
			const Icon = resume ? TimerIcon : ACTION_ICON[a.id];
			return {
				key: `action:${a.id}`,
				to: a.to,
				icon: <Icon className={iconClass} aria-hidden />,
				title: resume ? '回到計時' : a.label,
			};
		});
		const pageOptions: Option[] = NAV.filter((n) => matchesQuery([n.label, n.short ?? '', ...(PAGE_KEYWORDS[n.to] ?? [])], trimmed)).map(
			(n) => ({
				key: `page:${n.to}`,
				to: n.to,
				icon: <n.icon className={iconClass} aria-hidden />,
				title: trimmed ? <Highlight text={n.label} query={trimmed} /> : n.label,
			}),
		);

		if (!trimmed)
			return [
				{ key: 'actions', label: '快捷動作', options: actionOptions },
				{ key: 'pages', label: '前往', options: pageOptions },
			];

		// 有輸入：本機比對到的動作與頁面排最前面（立即出現，搜尋結果回來時不會把它擠走），接著是後端的四組
		const local = [...actionOptions, ...pageOptions].slice(0, GROUP_LIMIT);
		const data = search.data;
		const result: Group[] = [{ key: 'local', label: '動作與頁面', options: local }];
		if (data) {
			result.push(
				{
					key: 'tasks',
					label: '任務',
					options: data.tasks.slice(0, GROUP_LIMIT).map((t) => ({
						key: `task:${t.id}`,
						to: resultHref('task', t.id),
						icon:
							t.status === 'done' ? <CircleCheck className={iconClass} aria-hidden /> : <ListChecks className={iconClass} aria-hidden />,
						title: <Highlight text={t.title} query={trimmed} />,
						meta: (
							<>
								<span>{t.status === 'done' ? '已完成' : t.dueDate ? `${formatDate(t.dueDate)} 到期` : '沒有期限'}</span>
								<SubjectTag subjectId={t.subjectId} variant="compact" />
							</>
						),
					})),
				},
				{
					key: 'events',
					label: '考試與截止',
					options: data.events.slice(0, GROUP_LIMIT).map((ev) => {
						const Icon = ev.kind === 'exam' ? GraduationCap : CalendarClock;
						return {
							key: `event:${ev.id}`,
							to: resultHref('event', ev.id),
							icon: <Icon className={iconClass} aria-hidden />,
							title: <Highlight text={ev.title} query={trimmed} />,
							meta: (
								<>
									<span>
										{EVENT_KIND_LABEL[ev.kind]}，{formatDate(ev.date)}
									</span>
									<SubjectTag subjectId={ev.subjectId} variant="compact" />
								</>
							),
						};
					}),
				},
				{
					key: 'notes',
					label: '筆記與錯題',
					options: data.notes.slice(0, GROUP_LIMIT).map((n) => {
						const Icon = n.kind === 'mistake' ? FileQuestionMark : NotebookPen;
						return {
							key: `note:${n.id}`,
							to: resultHref('note', n.id),
							icon: <Icon className={iconClass} aria-hidden />,
							title: <Highlight text={n.title} query={trimmed} />,
							meta: (
								<>
									<span>{n.kind === 'mistake' ? '錯題' : '筆記'}</span>
									<SubjectTag subjectId={n.subjectId} variant="compact" />
								</>
							),
						};
					}),
				},
				{
					key: 'subjects',
					label: '科目',
					options: data.subjects.slice(0, GROUP_LIMIT).map((s) => ({
						key: `subject:${s.id}`,
						to: resultHref('subject', s.id),
						icon: <SubjectDot color={s.color} className="size-3" />,
						title: <Highlight text={s.name} query={trimmed} />,
						meta: '科目總覽',
					})),
				},
			);
		}
		return result;
	}, [trimmed, search.data, timerActive]);

	const visible = groups.filter((g) => g.options.length > 0);
	const options = visible.flatMap((g) => g.options);

	// 目前選項以 key 記住：結果更新後還在就留在原處，不在了就回到第一個
	const [activeKey, setActiveKey] = useState<string | null>(null);
	const found = options.findIndex((o) => o.key === activeKey);
	const activeIndex = options.length ? Math.max(0, found) : -1;
	const active = activeIndex >= 0 ? options[activeIndex] : undefined;

	useEffect(() => {
		if (activeIndex >= 0) document.getElementById(`${uid}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
	}, [activeIndex, uid]);

	// 打開：showModal 並把焦點放在輸入框（使用者明確要搜尋，觸控裝置也直接叫出鍵盤）。
	// 卸載（Esc、點背景、再按一次 Ctrl/⌘K、選了項目）：選了項目就把焦點移到新頁面的主要內容，否則還給打開前的元素。
	const navigated = useRef(false);
	useLayoutEffect(() => {
		const el = dialogRef.current;
		if (!el) return;
		const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (!el.open) el.showModal();
		inputRef.current?.focus();
		return () => {
			if (el.open) el.close();
			const target = navigated.current
				? document.getElementById('main-content')
				: prev?.isConnected
					? prev
					: document.getElementById('main-content');
			target?.focus({ preventScroll: true });
		};
	}, []);

	const select = (o: Option) => {
		navigated.current = true;
		navigate(o.to);
		onClose();
	};

	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		// 注音／倉頡選字中：上下鍵與 Enter 是給輸入法的；Esc 只取消選字，不關閉面板
		if (e.nativeEvent.isComposing || e.keyCode === 229) {
			if (e.key === 'Escape') e.preventDefault();
			return;
		}
		switch (e.key) {
			case 'ArrowDown':
			case 'ArrowUp': {
				e.preventDefault();
				const next = stepIndex(activeIndex, e.key === 'ArrowDown' ? 1 : -1, options.length);
				if (next >= 0) setActiveKey(options[next].key);
				break;
			}
			case 'Enter':
				if (active) {
					e.preventDefault();
					select(active);
				}
				break;
		}
	};

	const showEmpty = !!trimmed && settled && !search.isError && options.length === 0;
	const resultCount = visible.filter((g) => g.key !== 'local').reduce((n, g) => n + g.options.length, 0);
	const status = !trimmed
		? ''
		: search.isError && term === trimmed
			? '搜尋失敗'
			: settled
				? resultCount
					? `找到 ${resultCount} 筆結果`
					: `找不到「${trimmed}」的結果`
				: '';
	const loading = !!trimmed && !settled && !search.isError;
	let index = -1;

	return (
		<dialog
			ref={dialogRef}
			aria-label="快速搜尋"
			className={cn(
				'sf-palette m-0 mx-auto mt-[max(0.5rem,env(safe-area-inset-top))] mb-auto flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-lg outline-none',
				'sm:mt-[12dvh] sm:max-h-[76dvh] sm:w-full sm:max-w-xl',
			)}
			onCancel={(e) => {
				e.preventDefault();
				onClose();
			}}
			onPointerDown={(e) => {
				downOnBackdrop.current = e.target === e.currentTarget;
			}}
			onClick={(e) => {
				// 點背景關閉（按下與放開都在背景上才算，拖選文字到外面不會誤關）
				if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
				downOnBackdrop.current = false;
			}}
		>
			<div className="group flex h-14 shrink-0 items-center gap-3 border-b border-line pr-2 pl-4">
				<Search className="size-5 shrink-0 text-ink-3 transition-colors duration-120 group-focus-within:text-accent-ink" aria-hidden />
				<input
					ref={inputRef}
					type="text"
					role="combobox"
					aria-label="搜尋任務、考試、筆記、科目，或輸入動作"
					aria-expanded={options.length > 0}
					aria-controls={listboxId}
					aria-activedescendant={active ? optionId(activeIndex) : undefined}
					aria-autocomplete="list"
					autoComplete="off"
					autoCorrect="off"
					autoCapitalize="off"
					spellCheck={false}
					enterKeyHint="go"
					maxLength={SEARCH_QUERY_MAX}
					placeholder="搜尋任務、考試、筆記、科目…"
					value={value}
					onChange={(e) => {
						setValue(e.target.value);
						if (!(e.nativeEvent as InputEvent).isComposing) setText(e.target.value);
					}}
					onCompositionStart={() => setComposing(true)}
					onCompositionEnd={(e) => {
						setComposing(false);
						setText(e.currentTarget.value);
					}}
					onKeyDown={onKeyDown}
					className="h-full min-w-0 flex-1 bg-transparent text-base text-ink caret-accent outline-none placeholder:text-ink-3 sm:text-[1.0625rem]"
				/>
				{loading && <Spinner className="size-4" />}
				<button
					type="button"
					onClick={() => onClose()}
					className="inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-dense text-ink-2 transition-colors duration-120 hover:bg-subtle hover:text-ink sm:h-9 sm:px-2 pointer-coarse:h-11"
				>
					<span className="sm:hidden">取消</span>
					<span className="hidden sm:inline-flex" aria-hidden>
						<Kbd>Esc</Kbd>
					</span>
					<span className="sr-only max-sm:hidden">關閉</span>
				</button>
			</div>

			<p role="status" className="sr-only">
				{status}
			</p>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:max-h-[min(28rem,60dvh)]">
				<div id={listboxId} role="listbox" aria-label={trimmed ? '搜尋結果' : '快捷動作與頁面'} className="p-2">
					{visible.map((g) => {
						const labelId = `${uid}-group-${g.key}`;
						return (
							<div key={g.key} role="group" aria-labelledby={labelId} className="not-first:mt-2">
								<div id={labelId} role="presentation" className="px-3 pt-1.5 pb-1 text-caption font-semibold text-ink-3">
									{g.label}
								</div>
								{g.options.map((o) => {
									index += 1;
									const i = index;
									const isActive = i === activeIndex;
									return (
										<div
											key={o.key}
											id={optionId(i)}
											role="option"
											aria-selected={isActive}
											onMouseMove={() => {
												if (!isActive) setActiveKey(o.key);
											}}
											// 不讓輸入框失去焦點（combobox 的焦點一直在輸入框）
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => select(o)}
											className={cn(
												'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 transition-colors duration-120 ease-out',
												isActive ? 'bg-accent-soft' : '',
											)}
										>
											<span
												aria-hidden
												className={cn(
													'grid size-8 shrink-0 place-items-center rounded-md transition-colors duration-120 ease-out',
													isActive ? 'bg-card text-accent-ink' : 'bg-subtle text-ink-2',
												)}
											>
												{o.icon}
											</span>
											<span className="flex min-w-0 flex-1 flex-col">
												<span className="truncate text-dense text-ink">{o.title}</span>
												{o.meta && (
													<span className="flex min-w-0 items-center gap-x-2 overflow-hidden text-meta whitespace-nowrap text-ink-3 [&>span:first-child]:shrink-0">
														{o.meta}
													</span>
												)}
											</span>
											{isActive && (
												<CornerDownLeft className="hidden size-4 shrink-0 text-accent-ink sm:block pointer-coarse:hidden" aria-hidden />
											)}
										</div>
									);
								})}
							</div>
						);
					})}
				</div>

				{showEmpty && (
					<div className="flex flex-col items-center gap-1 px-6 pt-6 pb-8 text-center">
						<SearchX className="mb-1 size-6 text-ink-3" aria-hidden />
						<p className="text-dense font-semibold text-ink">找不到「{trimmed}」</p>
						<p className="text-meta text-ink-3">換個關鍵字試試，或清空搜尋使用快捷動作</p>
					</div>
				)}
				{search.isError && term === trimmed && (
					<p className="mx-4 mb-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
						<CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
						{search.error instanceof Error ? search.error.message : '搜尋失敗，請稍後再試'}
					</p>
				)}
			</div>

			<div
				className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2 text-caption text-ink-3 sm:flex pointer-coarse:hidden"
				aria-hidden
			>
				<span className="inline-flex items-center gap-1">
					<Kbd>
						<ArrowUp className="size-3" />
					</Kbd>
					<Kbd>
						<ArrowDown className="size-3" />
					</Kbd>
					選擇
				</span>
				<span className="inline-flex items-center gap-1">
					<Kbd>
						<CornerDownLeft className="size-3" />
					</Kbd>
					開啟
				</span>
				<span className="inline-flex items-center gap-1">
					<Kbd>Esc</Kbd>
					關閉
				</span>
			</div>
		</dialog>
	);
}
