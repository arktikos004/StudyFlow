import type { ReviewMode } from '../../../lib/notes-params';
import { Segmented } from '../../ui';

/** 切換「今天到期」與「考前衝刺」 */
export function ModeSwitch({ value, onChange }: { value: ReviewMode; onChange: (m: ReviewMode) => void }) {
	return (
		<Segmented
			label="複習方式"
			value={value}
			onChange={onChange}
			options={[
				{ value: 'due', label: '今天到期' },
				{ value: 'cram', label: '考前衝刺' },
			]}
		/>
	);
}
