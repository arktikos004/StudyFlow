import { useEffect } from 'react';

// 瀏覽器分頁的標題（WCAG 2.4.2）：每一頁顯示自己的名稱；計時中改顯示計時，切到別的分頁也看得到剩下的時間。

const APP_NAME = 'StudyFlow';
/** 和 index.html 的 <title> 相同：頁面還在載入、或沒有設定名稱時 */
const DEFAULT_TITLE = 'StudyFlow 學習管理';

let pageTitle: string | null = null;
let timerTitle: string | null = null;

function applyTitle() {
	const main = timerTitle ?? pageTitle;
	document.title = main ? `${main}｜${APP_NAME}` : DEFAULT_TITLE;
}

/** 這一頁的名稱（和導覽、頁面標題一致），離開這一頁時拿掉 */
export function usePageTitle(title: string) {
	useEffect(() => {
		pageTitle = title;
		applyTitle();
		return () => {
			pageTitle = null;
			applyTitle();
		};
	}, [title]);
}

/** 計時的狀態（例如「24:13 專注中」），比頁面名稱優先；null 表示沒有在計時 */
export function useTimerTitle(text: string | null) {
	useEffect(() => {
		timerTitle = text;
		applyTitle();
	}, [text]);
	// 只在卸載（登出）時拿掉；計時中每秒都會換字，不必每次先清掉再寫回去
	useEffect(
		() => () => {
			timerTitle = null;
			applyTitle();
		},
		[],
	);
}
