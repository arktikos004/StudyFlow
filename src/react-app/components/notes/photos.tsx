import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { ATTACHMENT_MAX_PER_NOTE } from '../../../shared/schemas';
import type { PendingPhoto } from '../../lib/pending-photos';
import { Button, MiniIconButton } from '../ui';

/** 選照片：新筆記先暫存在本機，儲存筆記後再上傳；已有的加上暫存的不能超過上限 */
export function PhotoPicker({ count, onPick, disabled }: { count: number; onPick: (files: File[]) => void; disabled?: boolean }) {
	const input = useRef<HTMLInputElement>(null);
	const remaining = ATTACHMENT_MAX_PER_NOTE - count;
	return (
		<>
			<input
				ref={input}
				type="file"
				accept="image/*"
				multiple
				hidden
				onChange={(e) => {
					onPick(Array.from(e.target.files ?? []).slice(0, remaining));
					e.target.value = '';
				}}
			/>
			<Button size="sm" onClick={() => input.current?.click()} disabled={disabled || remaining <= 0}>
				<Camera className="size-4" aria-hidden />
				加入照片
				<span className="font-num text-ink-3 tabular-nums">
					{count}/{ATTACHMENT_MAX_PER_NOTE}
				</span>
			</Button>
		</>
	);
}

/** 待上傳的照片：虛線框加「儲存後上傳」，和已上傳的照片區分；可以移除 */
export function PendingPhotoGrid({ photos, onRemove }: { photos: PendingPhoto[]; onRemove: (photo: PendingPhoto) => void }) {
	if (photos.length === 0) return null;
	return (
		<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
			{photos.map((p, i) => (
				<li key={p.url} className="relative aspect-square">
					<div className="size-full overflow-hidden rounded-lg border border-dashed border-accent">
						<img src={p.url} alt="" className="size-full object-cover" />
					</div>
					<span className="absolute bottom-1 left-1 rounded-sm bg-card/90 px-1.5 text-caption text-ink-2">儲存後上傳</span>
					<MiniIconButton label={`移除第 ${i + 1} 張待上傳的照片`} onClick={() => onRemove(p)} className="absolute top-1 right-1" />
				</li>
			))}
		</ul>
	);
}
