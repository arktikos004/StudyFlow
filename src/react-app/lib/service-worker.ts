import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';

/**
 * 註冊 Service Worker（離線也能開啟 App 外殼）。有新版本時跳提示，使用者按「重新載入」才換成新版，
 * 不會在編輯途中自動重新整理；不按的話，所有分頁都關掉後，下次開啟就是新版。
 */
export function registerServiceWorker() {
	const updateServiceWorker = registerSW({
		immediate: true,
		onNeedRefresh() {
			toast('有新版本', {
				id: 'app-update',
				description: '重新載入就會換成新版，正在編輯的內容請先儲存。',
				duration: Infinity,
				action: { label: '重新載入', onClick: () => void updateServiceWorker(true) },
			});
		},
	});
}
