import { CircleAlert, RotateCw } from 'lucide-react';
import { useRouteError } from 'react-router';
import { Button, ButtonLink, Card, EmptyState } from './ui';

/**
 * 這一頁的程式檔下載失敗：部署新版後還開著的舊分頁（舊檔名已經不在），或離線時第一次進這一頁。
 * 各瀏覽器的訊息不同（Chrome、Safari、Firefox），重新載入就會拿到新版。
 */
const isChunkLoadError = (e: unknown) =>
	e instanceof TypeError && /dynamically imported module|importing a module script failed/i.test(e.message);

/** 頁面出錯時取代內容區（路由的 errorElement）：側欄與頁首還在，可以重新載入或回到總覽 */
export function PageError() {
	const chunkFailed = isChunkLoadError(useRouteError());
	return (
		<Card>
			<EmptyState
				icon={<CircleAlert />}
				title={chunkFailed ? '這一頁沒有載入成功' : '這一頁出了點問題'}
				description={
					chunkFailed
						? '可能是網路不穩，或 StudyFlow 剛更新了版本。重新載入就能繼續使用。'
						: '你的資料沒有受到影響。可以重新載入這一頁，或先回到總覽。'
				}
				action={
					<div className="flex flex-wrap justify-center gap-2">
						<Button variant="primary" onClick={() => window.location.reload()}>
							<RotateCw className="size-4" aria-hidden />
							重新載入
						</Button>
						{!chunkFailed && <ButtonLink to="/">回到總覽</ButtonLink>}
					</div>
				}
			/>
		</Card>
	);
}

/** 沒有版面可以放的時候（版面本身、登入頁、註冊頁出錯）：置中顯示同一個說明 */
export function AppError() {
	return (
		<main className="mx-auto max-w-xl px-4 py-16">
			<PageError />
		</main>
	);
}
