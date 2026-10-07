import { onlineManager } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { PublicUser } from '../../../shared/api-types';
import { registerSchema } from '../../../shared/schemas';
import { useDeleteAvatar, useUpdateProfile, useUploadAvatar } from '../../lib/account-queries';
import { KEEP_PHOTO, type PhotoDraft } from '../../lib/profile-photo';
import {
	photoWasSaved,
	saveFailureMessage,
	saveProfile,
	saveSuccessMessage,
	type SaveInput,
	type SaveResult,
} from '../../lib/profile-save';
import { Button, Dialog, ErrorNote, Field, Input } from '../ui';
import { ProfilePhotoField } from './ProfilePhotoField';

const nameSchema = registerSchema.shape.displayName;

/**
 * 「編輯個人資料」對話框：照片與暱稱（時區是設定，在「帳號與安全」卡）。
 * 儲存的流程在 lib/profile-save.ts（有單元測試）：先處理照片（上傳或移除），成功才存暱稱。
 * - 全部存好：關掉對話框，只提示一次（只改照片是「已更新照片」或「已移除照片」，有改暱稱是「已更新個人資料」）。
 * - 照片失敗：什麼都沒存，對話框留著（新選的照片還在），可以再按一次。
 * - 照片成功、暱稱失敗或剛好斷線（部分成功）：照片已經換好（預覽就是新的照片），焦點回到暱稱，再按「儲存」只會存暱稱。
 * - 離線時不送出（TanStack Query 離線時會把 mutation 暫停、連線後才補送），直接提示。
 * - 儲存途中關掉對話框（取消、Esc、點背景、關閉鈕、手機往下拉）就中止這一輪：進行中的請求會真的被取消（AbortController），
 *   不會再存暱稱，也不會動到重新打開後的狀態。請求在取消之前就完成的話，提示已經存好的部分；
 *   hook 會重新取得使用者，畫面以伺服器為準。
 * 失敗的原因除了 hook 的 toast，對話框裡也有一份 role="alert"（對話框是 modal，toast 在外面，螢幕報讀器不一定念得到）。
 * 暱稱的格式錯誤（空白、太長）在送出前檢查，顯示在欄位旁邊。
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
	const [failure, setFailure] = useState<string>();
	const [saving, setSaving] = useState(false);
	// 進行中的這一輪儲存：關閉、開關、卸載時中止（進行中的請求會真的被取消）
	const inFlight = useRef<AbortController | null>(null);

	// 每次打開都從目前的資料開始（在 render 中依 open 的變化重設，第一個畫面就是新的狀態）
	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		setSaving(false);
		if (open) {
			setName(user.displayName);
			setDraft(KEEP_PHOTO);
			setNameError(undefined);
			setFailure(undefined);
		}
	}
	// open 改變或卸載時，進行中的儲存一律中止（即使不是經過下面的 close 關掉的）
	useEffect(
		() => () => {
			inFlight.current?.abort();
		},
		[open],
	);

	// 預覽網址：換成別的 draft 或元件卸載時釋放
	useEffect(
		() => () => {
			if (draft.kind === 'set') URL.revokeObjectURL(draft.url);
		},
		[draft],
	);

	const close = () => {
		inFlight.current?.abort();
		setSaving(false);
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
		setFailure(undefined);
		const input: SaveInput = { draft, name: parsed.data === user.displayName ? null : parsed.data };
		const controller = new AbortController();
		inFlight.current = controller;
		const { signal } = controller;
		setSaving(true);
		const result = await saveProfile(input, {
			uploadPhoto: (file) => uploadAvatar.mutateAsync({ file, signal }),
			removePhoto: () => deleteAvatar.mutateAsync({ signal }),
			updateName: (displayName) => updateProfile.mutateAsync({ displayName, signal }),
			isOnline: () => onlineManager.isOnline(),
			isCurrent: () => !signal.aborted,
		});
		showResult(result, input);
	};

	/** 依這一輪的結果提示並更新畫面。成功只提示一次；失敗的 toast 由各自的 hook 顯示（離線時 hook 不會被呼叫，這裡自己提示） */
	const showResult = (result: SaveResult, input: SaveInput) => {
		const success = saveSuccessMessage(result, input);
		if (success) toast.success(success);
		// 對話框已經被關掉（也可能又打開了）：這一輪不算數，不碰任何狀態
		if (result.status === 'abandoned') return;
		setSaving(false);
		if (result.status === 'saved') {
			close();
			return;
		}
		const message = saveFailureMessage(result, input);
		if (message) setFailure(message);
		if (result.status === 'offline' && message) toast.error(message);
		// 照片已經存好（部分成功）：預覽改用目前的照片，再按「儲存」只會存暱稱
		if (photoWasSaved(result)) setDraft(KEEP_PHOTO);
		// 只剩暱稱沒存時焦點回到暱稱；其他情況（照片失敗、一開始就離線）焦點留在「儲存」，方便再按一次
		if (result.status === 'name-failed' || photoWasSaved(result)) nameRef.current?.focus();
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
						setFailure(undefined);
					}}
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
								setFailure(undefined);
							}}
							autoFocus
						/>
					)}
				</Field>
				{/* 這次儲存沒有完成的原因（含離線與部分成功）：在對話框裡面，螢幕報讀器一定念得到 */}
				{failure && <ErrorNote error={new Error(failure)} />}
			</form>
		</Dialog>
	);
}
