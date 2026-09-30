import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { formatDate, formatMinutes, formatMinutesShort, formatMonthDay, weekdayLabel } from '../lib/format';
import { ChartColumn, Table2 } from 'lucide-react';
import { Button, cn } from './ui';

// 科目色的邏輯在 lib/subject-color.ts；這裡保留 re-export，既有的 import 不用改
export { NO_SUBJECT_COLOR, nextSubjectColor, useSubjectColor } from '../lib/subject-color';

// ---- 共用 ----

// 軸線數字的字型（font-num、等寬數字）由 index.css 的 .recharts-cartesian-axis-tick-value 統一設定
const axisTick = { fill: 'var(--ink-3)', fontSize: 12 };

/** 分鐘數的整齊刻度：0、30m、1h、1.5h…，最多 5 條線 */
function minuteTicks(max: number): number[] {
	const step = [10, 15, 20, 30, 60, 90, 120, 180, 240, 360].find((s) => Math.ceil(max / s) <= 4) ?? 480;
	const n = Math.max(1, Math.ceil(max / step));
	return Array.from({ length: n + 1 }, (_, i) => i * step);
}

type BarShapeProps = { x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: Record<string, number> };

/**
 * 堆疊長條的一段：只有「這一疊最上面有數值的那段」才畫 4px 圓角，
 * 段與段之間用 2px 表面色空隙分隔（dataviz 規範）。
 */
function stackSegment(key: string, keysBottomToTop: string[]) {
	return function Segment({ x = 0, y = 0, width = 0, height = 0, fill, payload = {} }: BarShapeProps) {
		if (height <= 0) return <g />;
		const above = keysBottomToTop.slice(keysBottomToTop.indexOf(key) + 1);
		const isTop = above.every((k) => !payload[k]);
		const gap = !isTop && height > 2 ? 2 : 0;
		const top = y + gap;
		const h = height - gap;
		const r = isTop ? Math.min(4, width / 2, h) : 0;
		const d = `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + h} Z`;
		return <path d={d} fill={fill} />;
	};
}

/** 圖表 tooltip：圓角 10、陰影 md；數值在前、用數字字型 */
function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="min-w-36 rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-md">
			<div className="mb-1 font-semibold text-ink">{title}</div>
			{children}
		</div>
	);
}

/** tooltip 的一列：系列用一小段線當記號（不用方塊），數值是最醒目的元素 */
function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4 text-ink-2">
			<span className="flex items-center gap-1.5">
				{color && <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
				{label}
			</span>
			<span className="font-num font-semibold text-ink tabular-nums">{value}</span>
		</div>
	);
}

/** 圖例：記號跟著圖形走（長條圖用小方塊），文字用 ink-2，不用系列色 */
export function Legend({ items }: { items: { key?: string; label: string; color: string }[] }) {
	return (
		<ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
			{items.map((i) => (
				<li key={i.key ?? i.label} className="flex items-center gap-1.5">
					<span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: i.color }} aria-hidden />
					{i.label}
				</li>
			))}
		</ul>
	);
}

// ---- 數字卡 ----

/** 單張數字卡（Sprint 1 相容保留；新的總覽／統計請改用 StatStrip，不要做一排長得一樣的數字卡） */
export function StatTile({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
	return (
		<div className="rounded-xl border border-line bg-card p-4 shadow-sm">
			<div className="flex items-center gap-1.5 text-sm text-ink-2">
				{icon}
				{label}
			</div>
			<div className="mt-1.5 font-num text-2xl font-semibold tabular-nums">{value}</div>
			{sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
		</div>
	);
}

export type StatItem = { key?: string; label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode };

/**
 * 一張卡片、用分隔線分成幾格的數字列（手機 2 欄、sm 以上一列最多 4 格）。
 * 數值用 font-num 28/600、等寬數字；icon 會縮成 16px。
 * footer（可選）：放在數字下方、用分隔線隔開的一列，例如「3 題錯題待複習」加上「開始複習」的動作列。
 */
export function StatStrip({ items, className, footer }: { items: StatItem[]; className?: string; footer?: ReactNode }) {
	const cols = ['sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3', 'sm:grid-cols-4'][Math.min(4, Math.max(1, items.length)) - 1];
	return (
		<div className={cn('overflow-hidden rounded-xl border border-line bg-card shadow-sm', className)}>
			{/* 每格畫上框與左框，外圈多出來的一條被 -m-px + overflow-hidden 藏起來 */}
			<dl className={cn('-mt-px -ml-px grid grid-cols-2', cols)}>
				{items.map((it, i) => (
					<div
						key={it.key ?? i}
						className={cn(
							'flex min-w-0 flex-col border-t border-l border-line px-4 py-3.5 sm:px-5 sm:py-4',
							i === items.length - 1 && items.length % 2 === 1 && 'col-span-2 sm:col-span-1',
						)}
					>
						<dt className="flex min-w-0 items-center gap-1.5 text-sm text-ink-2 [&_svg]:size-4 [&_svg]:shrink-0">
							{it.icon}
							<span className="truncate">{it.label}</span>
						</dt>
						<dd className="mt-1 font-num text-num-lg font-semibold tabular-nums">{it.value}</dd>
						{it.sub && <dd className="mt-1 text-meta text-ink-3">{it.sub}</dd>}
					</div>
				))}
			</dl>
			{footer && <div className="border-t border-line">{footer}</div>}
		</div>
	);
}

/** 圖表／表格切換：每張圖都有表格檢視（dataviz）。文字寫出按下去會切到哪一種 */
export function TableToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
	return (
		<Button size="sm" variant="ghost" onClick={onToggle} aria-label={on ? '改用圖表檢視' : '改用表格檢視'}>
			{on ? <ChartColumn className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
			{on ? '圖表' : '表格'}
		</Button>
	);
}

// ---- 近 7 天學習時間（單一系列，不需要圖例） ----

export function MiniDailyBars({ data, today }: { data: { date: string; minutes: number }[]; today: string }) {
	return (
		<div
			className="h-36 w-full"
			role="img"
			aria-label={`近 7 天學習時間：${data.map((d) => `${formatMonthDay(d.date)} ${formatMinutes(d.minutes)}`).join('、')}`}
		>
			<ResponsiveContainer>
				<BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
					<CartesianGrid vertical={false} stroke="var(--chart-grid)" />
					<XAxis
						dataKey="date"
						tickFormatter={(d: string) => (d === today ? '今天' : weekdayLabel(d))}
						tick={axisTick}
						axisLine={{ stroke: 'var(--chart-axis)' }}
						tickLine={false}
					/>
					<YAxis hide domain={[0, (max: number) => Math.max(30, max)]} />
					<Tooltip
						cursor={{ fill: 'var(--subtle)' }}
						content={({ active, payload }: TooltipContentProps) =>
							active && payload?.[0] ? (
								<TooltipBox title={formatDate(String(payload[0].payload.date))}>
									<TooltipRow label="學習時間" value={formatMinutes(Number(payload[0].value))} />
								</TooltipBox>
							) : null
						}
					/>
					<Bar dataKey="minutes" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

// ---- 每日學習時間（依科目堆疊） ----

export type SeriesDef = { key: string; label: string; color: string };

export function DailyStackedBars({
	data,
	series,
	today,
	goal,
}: {
	data: { date: string; bySubject: Record<string, number>; minutes: number }[];
	series: SeriesDef[];
	today: string;
	/** 每日目標（分鐘）：畫一條虛線門檻；圖例請另外標示「每日目標」 */
	goal?: number | null;
}) {
	const rows = data.map((d) => ({
		date: d.date,
		total: d.minutes,
		...Object.fromEntries(series.map((s) => [s.key, d.bySubject[s.key] ?? 0])),
	}));
	const dense = data.length > 31;
	const ticks = minuteTicks(Math.max(30, goal ?? 0, ...data.map((d) => d.minutes)));
	const keys = series.map((s) => s.key);
	return (
		<div className="h-64 w-full">
			<ResponsiveContainer>
				<BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={dense ? 1 : '20%'}>
					<CartesianGrid vertical={false} stroke="var(--chart-grid)" />
					<XAxis
						dataKey="date"
						tickFormatter={(d: string) => (d === today ? '今天' : formatMonthDay(d))}
						tick={axisTick}
						axisLine={{ stroke: 'var(--chart-axis)' }}
						tickLine={false}
						minTickGap={16}
					/>
					<YAxis
						tickFormatter={(v: number) => formatMinutesShort(v)}
						tick={axisTick}
						axisLine={false}
						tickLine={false}
						width={48}
						ticks={ticks}
						domain={[0, ticks[ticks.length - 1]]}
					/>
					<Tooltip
						cursor={{ fill: 'var(--subtle)' }}
						content={({ active, payload }: TooltipContentProps) => {
							if (!active || !payload?.length) return null;
							const row = payload[0].payload as { date: string; total: number } & Record<string, number>;
							return (
								<TooltipBox title={formatDate(row.date)}>
									{series
										.filter((s) => row[s.key] > 0)
										.map((s) => (
											<TooltipRow key={s.key} color={s.color} label={s.label} value={formatMinutes(row[s.key])} />
										))}
									<div className="mt-1 border-t border-line pt-1">
										<TooltipRow label="合計" value={formatMinutes(row.total)} />
									</div>
								</TooltipBox>
							);
						}}
					/>
					{series.map((s) => (
						<Bar
							key={s.key}
							dataKey={s.key}
							stackId="day"
							fill={s.color}
							maxBarSize={24}
							isAnimationActive={false}
							shape={stackSegment(s.key, keys)}
						/>
					))}
					{goal ? <ReferenceLine y={goal} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 4" /> : null}
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

// ---- 各科目學習時間（水平長條，數值在尾端） ----

export function SubjectBars({ items }: { items: { key: string; label: string; color: string; minutes: number }[] }) {
	const max = Math.max(...items.map((i) => i.minutes), 1);
	const total = items.reduce((s, i) => s + i.minutes, 0);
	return (
		<ul className="space-y-3">
			{items.map((i) => (
				<li key={i.key}>
					<div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
						<span className="flex min-w-0 items-center gap-1.5">
							<span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: i.color }} aria-hidden />
							<span className="truncate">{i.label}</span>
						</span>
						<span className="shrink-0 font-num text-ink-2 tabular-nums">
							{formatMinutes(i.minutes)}
							<span className="ml-1.5 text-xs text-ink-3">{Math.round((i.minutes / total) * 100)}%</span>
						</span>
					</div>
					<div className="h-2.5 overflow-hidden rounded-full bg-subtle">
						<div className="h-full rounded-full" style={{ width: `${(i.minutes / max) * 100}%`, background: i.color }} />
					</div>
				</li>
			))}
		</ul>
	);
}

// ---- 每週任務完成情況（完成 + 未完成 堆疊） ----

export function WeeklyTaskBars({ data }: { data: { weekStart: string; due: number; done: number }[] }) {
	const rows = data.map((w) => ({ ...w, open: w.due - w.done }));
	return (
		<div className="h-52 w-full">
			<ResponsiveContainer>
				<BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
					<CartesianGrid vertical={false} stroke="var(--chart-grid)" />
					<XAxis
						dataKey="weekStart"
						tickFormatter={(d: string) => `${formatMonthDay(d)} 週`}
						tick={axisTick}
						axisLine={{ stroke: 'var(--chart-axis)' }}
						tickLine={false}
						minTickGap={8}
					/>
					<YAxis
						tick={axisTick}
						axisLine={false}
						tickLine={false}
						allowDecimals={false}
						width={40}
						domain={[0, (max: number) => Math.max(4, max)]}
					/>
					<Tooltip
						cursor={{ fill: 'var(--subtle)' }}
						content={({ active, payload }: TooltipContentProps) => {
							if (!active || !payload?.length) return null;
							const w = payload[0].payload as { weekStart: string; due: number; done: number };
							return (
								<TooltipBox title={`${formatDate(w.weekStart)} 起的一週`}>
									<TooltipRow color="var(--accent)" label="已完成" value={`${w.done} 項`} />
									<TooltipRow color="var(--chart-rest)" label="未完成" value={`${w.due - w.done} 項`} />
									<div className="mt-1 border-t border-line pt-1">
										<TooltipRow label="完成率" value={w.due ? `${Math.round((w.done / w.due) * 100)}%` : '—'} />
									</div>
								</TooltipBox>
							);
						}}
					/>
					<Bar
						dataKey="done"
						stackId="w"
						fill="var(--accent)"
						maxBarSize={24}
						isAnimationActive={false}
						shape={stackSegment('done', ['done', 'open'])}
					/>
					<Bar
						dataKey="open"
						stackId="w"
						fill="var(--chart-rest)"
						maxBarSize={24}
						isAnimationActive={false}
						shape={stackSegment('open', ['done', 'open'])}
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

// ---- 學習熱度圖（單一色相，由淺到深；顏色跟著主題色） ----

const HEAT_CLASS = ['bg-subtle', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'];
const HEAT_BINS = [0, 30, 60, 120]; // 分鐘：>0、≥30、≥60、≥120
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function heatLevel(min: number) {
	if (min <= 0) return 0;
	let lvl = 1;
	HEAT_BINS.forEach((b, i) => {
		if (i > 0 && min >= b) lvl = i + 1;
	});
	return lvl;
}

/** 一句話摘要，給 role="img" 報讀 */
function heatSummary(data: { date: string; minutes: number }[], today: string) {
	if (!data.length) return '學習熱度：沒有資料。';
	const since = `${formatDate(data[0].date)} 至今`;
	const studied = data.filter((d) => d.date <= today && d.minutes > 0);
	if (!studied.length) return `學習熱度：${since}還沒有學習紀錄。`;
	const total = studied.reduce((s, d) => s + d.minutes, 0);
	const best = studied.reduce((a, b) => (b.minutes > a.minutes ? b : a));
	return `學習熱度：${since}有 ${studied.length} 天讀書，共 ${formatMinutes(total)}；最多的一天是 ${formatDate(best.date)}，${formatMinutes(best.minutes)}。`;
}

const th = 'px-3 py-2 text-left font-semibold text-ink-2';
const td = 'px-3 py-1.5 font-num tabular-nums';

export function Heatmap({ data, today }: { data: { date: string; minutes: number }[]; today: string }) {
	const [table, setTable] = useState(false);
	const weeks: { date: string; minutes: number }[][] = [];
	data.forEach((d, i) => {
		if (i % 7 === 0) weeks.push([]);
		weeks[weeks.length - 1].push(d);
	});
	const summary = heatSummary(data, today);

	return (
		<div>
			{table ? (
				<div className="max-h-80 overflow-auto rounded-lg border border-line">
					<table className="w-full text-sm">
						<caption className="caption-bottom px-3 py-2 text-left text-meta text-ink-3">單位：分鐘（— 表示沒有紀錄）</caption>
						<thead className="sticky top-0 bg-subtle">
							<tr>
								<th scope="col" className={th}>
									週
								</th>
								{WEEKDAYS.map((w) => (
									<th key={w} scope="col" className={th}>
										{w}
									</th>
								))}
								<th scope="col" className={th}>
									合計
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{[...weeks].reverse().map((w) => (
								<tr key={w[0].date}>
									<th scope="row" className={cn(td, 'text-left font-normal text-ink-2')}>
										{formatMonthDay(w[0].date)} 起
									</th>
									{WEEKDAYS.map((_, i) => {
										const d = w[i];
										return (
											<td key={i} className={td}>
												{!d || d.date > today ? '' : d.minutes ? Math.round(d.minutes) : '—'}
											</td>
										);
									})}
									<td className={cn(td, 'font-semibold')}>{Math.round(w.filter((d) => d.date <= today).reduce((s, d) => s + d.minutes, 0)) || '—'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={summary}>
					<div className="mr-1 grid shrink-0 grid-rows-7 gap-1 text-caption leading-none text-ink-3">
						{['一', '', '三', '', '五', '', '日'].map((l, i) => (
							<span key={i} className="flex h-3.5 items-center">
								{l}
							</span>
						))}
					</div>
					{weeks.map((w) => (
						<div key={w[0].date} className="grid shrink-0 grid-rows-7 gap-1">
							{w.map((d) => (
								<div
									key={d.date}
									title={`${formatDate(d.date)}：${d.minutes ? formatMinutes(d.minutes) : '沒有紀錄'}`}
									className={cn(
										'size-3.5 rounded-[3px]',
										d.date > today ? 'bg-transparent' : HEAT_CLASS[heatLevel(d.minutes)],
										d.date === today && 'ring-1 ring-ink-2 ring-offset-1 ring-offset-card',
									)}
								/>
							))}
						</div>
					))}
				</div>
			)}
			<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
				{table ? (
					<span />
				) : (
					<div className="flex items-center gap-1.5 text-xs text-ink-3" aria-hidden>
						少
						{HEAT_CLASS.map((c) => (
							<span key={c} className={cn('size-3 rounded-[3px]', c)} />
						))}
						多（2 小時以上）
					</div>
				)}
				<TableToggle on={table} onToggle={() => setTable((v) => !v)} />
			</div>
		</div>
	);
}
