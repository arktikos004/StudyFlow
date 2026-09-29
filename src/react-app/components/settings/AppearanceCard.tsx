import { Monitor, Moon, Sun } from 'lucide-react';
import { setThemeMode, useThemeMode, type ThemeMode } from '../../lib/theme';
import { Card, CardHeader, Segmented } from '../ui';

/** 外觀：目前只有深淺色切換（SUB-4 的主題色會加在這張卡片） */
export function AppearanceCard() {
	const mode = useThemeMode();
	return (
		<Card>
			<CardHeader title="外觀" />
			<div className="px-4 pb-5 sm:px-5">
				<Segmented<ThemeMode>
					label="佈景主題"
					value={mode}
					onChange={setThemeMode}
					options={[
						{
							value: 'system',
							label: (
								<span className="inline-flex items-center gap-1.5">
									<Monitor className="size-4" aria-hidden />
									跟隨系統
								</span>
							),
						},
						{
							value: 'light',
							label: (
								<span className="inline-flex items-center gap-1.5">
									<Sun className="size-4" aria-hidden />
									淺色
								</span>
							),
						},
						{
							value: 'dark',
							label: (
								<span className="inline-flex items-center gap-1.5">
									<Moon className="size-4" aria-hidden />
									深色
								</span>
							),
						},
					]}
				/>
			</div>
		</Card>
	);
}
