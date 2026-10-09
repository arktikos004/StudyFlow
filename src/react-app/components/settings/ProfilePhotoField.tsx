import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { AVATAR_ACCEPT, prepareAvatar } from '../../lib/profile-image';
import { draftPreview, photoNote, removeDraft, type PhotoDraft } from '../../lib/profile-photo';
import { Avatar, Button, InlineError } from '../ui';

/**
 * 頭像照片（由 props 控制，儲存時才真的上傳或移除）：96px 預覽、上傳／更換照片、移除照片。
 * - 選檔後在瀏覽器裡置中裁成正方形、縮到 512px、轉 JPEG（lib/profile-image.ts），處理中按鈕轉圈。
 * - 狀態說明用 aria-live 念出來（「新照片會在儲存後套用」）；照片處理失敗（讀不出來、不是圖片）是 role="alert"。
 *   上傳與移除的結果由 hook 的 toast 顯示，不在這裡。
 * - 預覽的首字跟著輸入中的暱稱（name）。
 */
export function ProfilePhotoField({
	name,
	currentSrc,
	draft,
	onDraftChange,
	disabled,
}: {
	name: string;
	currentSrc: string | null;
	draft: PhotoDraft;
	onDraftChange: (draft: PhotoDraft) => void;
	disabled?: boolean;
}) {
	const labelId = useId();
	const noteId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [processing, setProcessing] = useState(false);
	const [processError, setProcessError] = useState<string>();
	// 對話框在處理途中被關掉時，不再建立預覽網址（避免沒有人 revoke）
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const preview = draftPreview(draft, currentSrc);

	const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		// 清空，同一張照片再選一次也會觸發 change
		e.target.value = '';
		if (!file) return;
		setProcessing(true);
		setProcessError(undefined);
		try {
			const blob = await prepareAvatar(file);
			if (mounted.current) onDraftChange({ kind: 'set', blob, url: URL.createObjectURL(blob) });
		} catch (err) {
			if (mounted.current) setProcessError(err instanceof Error ? err.message : '照片處理失敗，請再試一次');
		} finally {
			if (mounted.current) setProcessing(false);
		}
	};

	const onRemove = () => {
		setProcessError(undefined);
		onDraftChange(removeDraft(currentSrc));
	};

	return (
		<div role="group" aria-labelledby={labelId} aria-describedby={noteId}>
			<p id={labelId} className="text-sm font-semibold text-ink-2">
				照片
			</p>
			<div className="mt-2 flex items-center gap-4">
				<Avatar name={name} src={preview} size="xl" />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap gap-2">
						<Button size="sm" onClick={() => inputRef.current?.click()} loading={processing} disabled={disabled}>
							{!processing && <ImageUp className="size-4" aria-hidden />}
							{preview ? '更換照片' : '上傳照片'}
						</Button>
						{preview && (
							<Button size="sm" variant="ghost" onClick={onRemove} disabled={disabled || processing}>
								<Trash2 className="size-4" aria-hidden />
								移除照片
							</Button>
						)}
					</div>
					<p id={noteId} aria-live="polite" className="mt-2 text-meta text-ink-3">
						{photoNote(draft)}
					</p>
					{processError && <InlineError className="mt-1">{processError}</InlineError>}
				</div>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept={AVATAR_ACCEPT}
				tabIndex={-1}
				aria-hidden
				className="sr-only"
				onChange={(e) => void onFile(e)}
			/>
		</div>
	);
}
