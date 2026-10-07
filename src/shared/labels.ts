// 列舉值的 zh-TW 名稱。畫面與匯出檔（CSV、行事曆）用同一份，文字才會一致。

export const TASK_PRIORITY_LABEL = { high: '高', medium: '中', low: '低' } as const;
export const TASK_STATUS_LABEL = { todo: '待辦', doing: '進行中', done: '已完成' } as const;
export const EVENT_KIND_LABEL = { exam: '考試', deadline: '截止日' } as const;
export const STUDY_MODE_LABEL = { pomodoro: '番茄鐘', stopwatch: '碼錶', manual: '手動補登' } as const;
