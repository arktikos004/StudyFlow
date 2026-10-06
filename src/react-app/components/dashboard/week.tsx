import { useState } from 'react';
import { formatDate, formatMinutes } from '../../lib/format';
import { MiniDailyBars } from '../charts';
import { Card, CardHeader, MoreLink, TableToggle } from '../ui';

/** 總覽的「近 7 天學習時間」：單一系列的長條圖（不需要圖例），附表格檢視 */
export function WeekCard({ days, today }: { days: { date: string; minutes: number }[]; today: string }) {
	const [table, setTable] = useState(false);
	const total = days.reduce((s, d) => s + d.minutes, 0);
	return (
		<Card>
			<CardHeader
				title="近 7 天學習時間"
				meta={total > 0 ? `共 ${formatMinutes(total)}` : undefined}
				action={
					<>
						<TableToggle on={table} onToggle={() => setTable((v) => !v)} />
						<MoreLink to="/stats" className="ml-1">
							詳細統計
						</MoreLink>
					</>
				}
			/>
			<div className="px-3 pb-3 sm:px-4 sm:pb-4">
				{table ? (
					<table className="w-full text-sm">
						<caption className="sr-only">近 7 天每天的學習時間</caption>
						<thead className="bg-subtle">
							<tr>
								<th scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">
									日期
								</th>
								<th scope="col" className="px-3 py-2 text-right font-semibold text-ink-2">
									學習時間
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{[...days].reverse().map((d) => (
								<tr key={d.date}>
									<th scope="row" className="px-3 py-1.5 text-left font-normal text-ink-2">
										{d.date === today ? `今天 ${formatDate(d.date)}` : formatDate(d.date)}
									</th>
									<td className="px-3 py-1.5 text-right font-num tabular-nums">{d.minutes > 0 ? formatMinutes(d.minutes) : '—'}</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<MiniDailyBars data={days} today={today} />
				)}
			</div>
		</Card>
	);
}
