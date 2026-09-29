import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { SUBJECT_COLORS } from '../../shared/schemas';
import { formatDate, formatMinutes, formatMinutesShort, formatMonthDay, weekdayLabel } from '../lib/format';
import { useIsDark } from '../lib/theme';
import { cn } from './ui';

// 分類色盤（dataviz 驗證過）：淺色與深色各自一組，同一科目在兩種模式都是同一個色相
const DARK_STEPS: Record<string, string> = {
	'#2a78d6': '#3987e5',
	'#eb6834': '#d95926',
	'#1baf7a': '#199e70',
	'#eda100': '#c98500',
	'#e87ba4': '#d55181',
	'#008300': '#008300',
	'#4a3aa7': '#9085e9',
	'#e34948': '#e66767',
};
export const NO_SUBJECT_COLOR = { light: '#898781', dark: '#898781' };

export function useSubjectColor() {
	const dark = useIsDark();
	return (hex: string | undefined | null) => {
		if (!hex) return dark ? NO_SUBJECT_COLOR.dark : NO_SUBJECT_COLOR.light;
		return dark ? (DARK_STEPS[hex.toLowerCase()] ?? hex) : hex;
	};
}

/** 下一個尚未使用的顏色（依固定順序，不循環產生新色） */
export function nextSubjectColor(used: string[]): string {
	return SUBJECT_COLORS.find((c) => !used.includes(c)) ?? SUBJECT_COLORS[used.length % SUBJECT_COLORS.length];
}

// ---- 共用 ----

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

function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="min-w-36 rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-lg">
			<div className="mb-1 font-medium">{title}</div>
			{children}
		</div>
	);
}

function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4 text-ink-2">
			<span className="flex items-center gap-1.5">
				{color && <span className="size-2.5 rounded-sm" style={{ background: color }} />}
				{label}
			</span>
			<span className="font-medium text-ink tabular-nums">{value}</span>
		</div>
	);
}

export function Legend({ items }: { items: { key?: string; label: string; color: string }[] }) {
	return (
		<ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
			{items.map((i) => (
				<li key={i.key ?? i.label} className="flex items-center gap-1.5">
					<span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
					{i.label}
				</li>
			))}
		</ul>
	);
}

// ---- 數字卡 ----

export function StatTile({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
	return (
		<div className="rounded-xl border border-line bg-card p-4 shadow-card">
			<div className="flex items-center gap-1.5 text-sm text-ink-2">
				{icon}
				{label}
			</div>
			<div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
			{sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
		</div>
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
}: {
	data: { date: string; bySubject: Record<string, number>; minutes: number }[];
	series: SeriesDef[];
	today: string;
}) {
	const rows = data.map((d) => ({
		date: d.date,
		total: d.minutes,
		...Object.fromEntries(series.map((s) => [s.key, d.bySubject[s.key] ?? 0])),
	}));
	const dense = data.length > 31;
	const ticks = minuteTicks(Math.max(30, ...data.map((d) => d.minutes)));
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
							<span className="size-2.5 shrink-0 rounded-sm" style={{ background: i.color }} aria-hidden />
							<span className="truncate">{i.label}</span>
						</span>
						<span className="shrink-0 text-ink-2 tabular-nums">
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

// ---- 學習熱度圖（單一色相，由淺到深） ----

const HEAT_LIGHT = ['var(--subtle)', '#b7d3f6', '#86b6ef', '#3987e5', '#1c5cab'];
const HEAT_DARK = ['var(--subtle)', '#104281', '#1c5cab', '#3987e5', '#86b6ef'];
const HEAT_BINS = [0, 30, 60, 120]; // 分鐘：>0、≥30、≥60、≥120

function heatLevel(min: number) {
	if (min <= 0) return 0;
	let lvl = 1;
	HEAT_BINS.forEach((b, i) => {
		if (i > 0 && min >= b) lvl = i + 1;
	});
	return lvl;
}

export function Heatmap({ data, today }: { data: { date: string; minutes: number }[]; today: string }) {
	const dark = useIsDark();
	const ramp = dark ? HEAT_DARK : HEAT_LIGHT;
	const weeks: { date: string; minutes: number }[][] = [];
	data.forEach((d, i) => {
		if (i % 7 === 0) weeks.push([]);
		weeks[weeks.length - 1].push(d);
	});
	return (
		<div>
			<div className="flex gap-1 overflow-x-auto pb-1">
				<div className="mr-1 grid shrink-0 grid-rows-7 gap-1 text-[10px] leading-none text-ink-3">
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
								className={cn('size-3.5 rounded-[3px]', d.date === today && 'ring-1 ring-ink-2 ring-offset-1 ring-offset-card')}
								style={{ background: d.date > today ? 'transparent' : ramp[heatLevel(d.minutes)] }}
							/>
						))}
					</div>
				))}
			</div>
			<div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-ink-3">
				少
				{ramp.map((c) => (
					<span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
				))}
				多（2 小時以上）
			</div>
		</div>
	);
}
