import { Toaster } from 'sonner';
import { useIsDark } from '../lib/theme';

/** 全站的 toast。不用 richColors：底色、文字、圖示顏色都由 index.css 以 tokens 設定（深色模式對比也足夠） */
export function ThemedToaster() {
	const dark = useIsDark();
	return (
		<Toaster
			position="top-center"
			theme={dark ? 'dark' : 'light'}
			closeButton
			// 手機（含加到主畫面的 PWA）避開瀏海與狀態列
			mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
		/>
	);
}
