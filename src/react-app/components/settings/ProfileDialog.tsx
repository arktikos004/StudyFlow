import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { PublicUser } from '../../../shared/api-types';
import { registerSchema } from '../../../shared/schemas';
import { useUpdateProfile } from '../../lib/queries';
import { KEEP_PHOTO, photoSavedMessage, type PhotoDraft } from '../../lib/profile-photo';
import { useDeleteAvatar, useUploadAvatar } from '../../lib/profile-queries';
import { Button, Dialog, Field, Input } from '../ui';
import { ProfilePhotoField } from './ProfilePhotoField';

const nameSchema = registerSchema.shape.displayName;
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/**
 * 「編輯個人資料」對話框：照片與暱稱（時區是設定，在「帳號與安全」卡）。
 * 儲存時先處理照片（上傳或移除），成功才存暱稱：
 * - 照片失敗：什麼都沒存，錯誤顯示在照片欄位（role="alert"），對話框留著可以再按一次。
 * - 照片成功、暱稱失敗（部分成功）：照片已經換好（預覽就是新的照片），暱稱欄位顯示錯誤，再按「儲存」只會存暱稱。
 * 狀態在每次打開時重設；新選照片的預覽網址（blob:）在換掉、關閉時 revoke。
 */
export function ProfileDialog({
	open,
	onClose,
	user,
	avatarSrc,
}: {
	open: boolean;
	onClose: () => void;
	user: PublicUser;
	avatarSrc: string | null;
}) {
	const formId = useId();
	const nameRef = useRef<HTMLInputElement>(null);
	const updateProfile = useUpdateProfile();
	const uploadAvatar = useUploadAvatar();
	const deleteAvatar = useDeleteAvatar();
	const [name, setName] = useState(user.displayName);
	const [draft, setDraft] = useState<PhotoDraft>(KEEP_PHOTO);
	const [nameError, setNameError] = useState<string>();
	const [photoError, setPhotoError] = useState<string>();
	const [saving, setSaving] = useState(false);

	// 每次打開都從目前的資料開始（在 render 中依 open 的變化重設，第一個畫面就是新的狀態）
	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) {
			setName(user.displayName);
			setDraft(KEEP_PHOTO);
			setNameError(undefined);
			setPhotoError(undefined);
		}
	}

	// 預覽網址：換成別的 draft 或元件卸載時釋放
	useEffect(
		() => () => {
			if (draft.kind === 'set') URL.revokeObjectURL(draft.url);
		},
		[draft],
	);

	const close = () => {
		setDraft(KEEP_PHOTO);
		onClose();
	};

	const trimmed = name.trim();
	const dirty = trimmed !== user.displayName || draft.kind !== 'keep';

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (saving) return;
		const parsed = nameSchema.safeParse(name);
		if (!parsed.success) {
			setNameError(parsed.error.issues[0].message);
			nameRef.current?.focus();
			return;
		}
		setNameError(undefined);
		setPhotoError(undefined);
		setSaving(true);
		try {
			if (draft.kind === 'set') await uploadAvatar.mutateAsync(draft.blob);
			else if (draft.kind === 'remove') await deleteAvatar.mutateAsync();
		} catch (err) {
			setPhotoError(errorText(err, draft.kind === 'set' ? '照片上傳失敗，請再試一次' : '照片移除失敗，請再試一次'));
			setSaving(false);
			return;
		}
		const photoMessage = photoSavedMessage(draft);
		if (draft.kind !== 'keep') setDraft(KEEP_PHOTO);
		if (parsed.data !== user.displayName) {
			try {
				// 成功的提示「已更新個人資料」由 useUpdateProfile 顯示（也涵蓋照片）
				await updateProfile.mutateAsync({ displayName: parsed.data });
			} catch (err) {
				setNameError(errorText(err, '暱稱儲存失敗，請再試一次'));
				setSaving(false);
				nameRef.current?.focus();
				return;
			}
		} else if (photoMessage) {
			toast.success(photoMessage);
		}
		setSaving(false);
		close();
	};

	return (
		<Dialog
			open={open}
			onClose={close}
			title="編輯個人資料"
			footer={
				<>
					<Button onClick={close}>取消</Button>
					<Button type="submit" form={formId} variant="primary" loading={saving} disabled={!dirty}>
						儲存
					</Button>
				</>
			}
		>
			<form id={formId} onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
				<ProfilePhotoField
					name={trimmed || user.displayName}
					currentSrc={avatarSrc}
					draft={draft}
					onDraftChange={(next) => {
						setDraft(next);
						setPhotoError(undefined);
					}}
					error={photoError}
					disabled={saving}
				/>
				<Field label="暱稱" hint="顯示在側欄與個人檔案，最多 30 個字" error={nameError}>
					{(id, aria) => (
						<Input
							ref={nameRef}
							id={id}
							{...aria}
							name="nickname"
							autoComplete="nickname"
							spellCheck={false}
							maxLength={30}
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								setNameError(undefined);
							}}
							autoFocus
						/>
					)}
				</Field>
			</form>
		</Dialog>
	);
}
