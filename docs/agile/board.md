# Sprint 看板

由 Scrum Master 維護。狀態有五種：待辦 → 進行中 → 審查中 → 已合併，另外還有「已砍」。

## Sprint 0：啟動

| 項目 | 狀態 |
|---|---|
| 本機瀏覽 http://localhost:5173 | 已完成 |
| `develop` 分支、`worktree.baseRef: head`、各工具忽略 worktree | 已完成 |
| 重構：`lib/subject-color.ts`、`forms/*Dialog.tsx`（不改行為） | 已完成 |
| `DESIGN.md`、`docs/agile/*`、`.claude/agents/*`、`.claude/skills/*` | 已完成 |

## Sprint 1：地基

| Lane | Agent | 故事 | 狀態 |
|---|---|---|---|
| s1/backend | backend-engineer | 資料模型與 migration、所有新 API 與 hook、BUG-1 | 已合併（review：修正後合併） |
| s1/design | ui-designer | UI-1、SUB-4（tokens） | 已合併（review：修正後合併） |
| s1/color | frontend-engineer | SUB-1、拆分設定頁 | 已合併（review：修正後合併） |
| QA 把關 | qa-engineer（Sonnet） | 全套檢查、migration 演練 | 通過（無阻斷問題；無瀏覽器工具，畫面改做程式碼層級檢查） |

## Sprint 2：功能與頁面

| Lane | Agent | 故事 | 狀態 |
|---|---|---|---|
| s2/subjects | frontend-engineer | SUB-2、SUB-3、GOAL-1/2 設定卡、DATA-1/CAL-2 設定卡、SUB-4 設定卡 | 已合併（review：可合併） |
| s2/dashboard | frontend-engineer | 總覽與統計改版、GOAL-1/2、DASH-1 | 已合併（review：修正後合併） |
| s2/tasks | frontend-engineer | TSK-1～4、任務頁改版 | 進行中 |
| s2/timer | frontend-engineer | TMR-1～3、CAL-1、計時頁與月曆改版 | 已合併（review：月曆修正後合併、計時可合併） |
| s2/notes | frontend-engineer | NOTE-1/2、筆記頁與考試頁改版 | 已合併（review：修正後合併） |
| s2/shell | ui-designer | APP-1、APP-2、導覽、Auth 頁、品牌、動效 | 進行中 |

## Sprint 3：驗收

| 項目 | Agent | 狀態 |
|---|---|---|
| QA：全套檢查、截圖、a11y 抽查、匯出檔驗證 | qa-engineer | 待辦 |
| 設計審查 | ui-designer | 待辦 |
| 逐條驗收、README、Sprint review、回顧 | product-owner | 待辦 |
