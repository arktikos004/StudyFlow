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
| s2/tasks | frontend-engineer | TSK-1～4、任務頁改版 | 已合併（review：修正後合併） |
| s2/timer | frontend-engineer | TMR-1～3、CAL-1、計時頁與月曆改版 | 已合併（review：月曆修正後合併、計時可合併） |
| s2/notes | frontend-engineer | NOTE-1/2、筆記頁與考試頁改版 | 已合併（review：修正後合併） |
| s2/shell | ui-designer | APP-1、APP-2、導覽、Auth 頁、品牌、動效 | 已合併（review：修正後合併） |

## Sprint 3：驗收

| 項目 | Agent | 狀態 |
|---|---|---|
| QA：全套檢查、截圖、a11y 抽查、匯出檔驗證 | qa-engineer（Sonnet） | 有條件通過（無阻斷；Major 2、Minor 3 交給 s3/polish 與 s3/design；新增隔離測試已合併） |
| 設計審查 | ui-designer（Sonnet，只讀） | 完成（高 3、中 12、低 15；交給 s3/polish 與 s3/design） |
| s3/polish：backlog 累積的頁面修正、共用元件遷移 | frontend-engineer | 已合併（第一輪 review：可合併；最後一輪 review：修正後合併） |
| s3/design：共用元件與設計系統的修正 | ui-designer | 已合併（review：修正後合併；DARK_BAND 驗證後維持原值） |
| 逐條驗收、README、Sprint review、回顧 | product-owner（Sonnet） | 完成（24 個故事：22 通過、2 部分通過〔TSK-2 觸控、CAL-2 Google 日曆提醒，待使用者手動驗證〕；見 sprint-review.md） |

## Sprint 4：個人檔案（使用者追加）

| Lane | Agent | 故事 | 狀態 |
|---|---|---|---|
| s4/profile-api | backend-engineer | PRO-1：頭像上傳 API、個人檔案摘要 API、migration 0002、hook 與整合測試 | 已合併（review：修正後合併；順手修好筆記照片上傳的同一個大小檢查漏洞） |
| s4/profile-ui | ui-designer | PRO-1：設定頁頂端的個人檔案、Avatar 元件、帳號與安全卡、側欄與手機選單的帳號區塊 | 已合併（review：A 修正後合併、B 可合併；最後的測試與文件由 Scrum Master 收尾） |

## Sprint 5：上線與整理（使用者追加）

| 項目 | 負責 | 狀態 |
|---|---|---|
| s5/followup：PRO-1 的已知限制（按取消真的中止、只提示一次成功、切回分頁更新使用者）、統計測試的時間邊界、PRO-2 成就的解鎖時間（migration 0003） | Scrum Master | 已合併（無頭 Chrome 實測 21 項通過；測試與實測都用「故意改壞」確認抓得到） |
| 第一次部署：Sprint 1–4 與 s5/followup（遠端 D1 套用 0001–0003） | Scrum Master | 完成（2026-10-07：先記下 Time Travel bookmark、匯出備份，套用 0001–0003 後 `npm run deploy`；push main 後 Workers Builds 又自動部署同一個 commit。不登入的檢查通過，正式資料完好） |
| 全 codebase clean code review | code-reviewer × 5（Sonnet，分區、只讀） | 完成：後端與共用 36 項、頁面 40 項、lib 24 項、共用元件與外殼 25 項、測試 20 項 |
| s5/clean-code：依 review 修正 | Scrum Master | 完成：44 個 commit（修 bug 12、重構 23、測試 7）。畫面截圖 74 張與基準相同；bug 修正各自用無頭 Chrome 實測，並確認拿掉修正時檢查會失敗。細目與留給使用者決定的項目見 backlog「Sprint 5 code review」 |
| 第二次部署：s5/clean-code（沒有新的 migration） | Scrum Master | 完成（2026-10-07 21:57：先記下 Time Travel bookmark 與目前的版本、匯出備份，確認遠端沒有待套用的 migration；`npm run deploy` 後不登入的檢查通過。push main 後 Workers Builds 又部署同一個 commit，再檢查一次通過，前端檔案的雜湊和本機建置相同） |

**測試檔改名對照**（Sprint 5 依功能重新命名；舊的 sprint-review.md 記錄的是當時的檔名）

| 原本 | 現在 |
|---|---|
| `qa-isolation.spec.ts` | `cross-user-isolation.spec.ts` |
| `notes-v2.spec.ts` | `notes.spec.ts` |
| `subjects-v2.spec.ts` | `subjects.spec.ts` |
| `tasks-v2.spec.ts` | `tasks.spec.ts` |
| `sessions-edit.spec.ts` | `study-sessions.spec.ts` |
| `profile-upload-limit.spec.ts` | `upload-size-limit.spec.ts` |
| `profile.spec.ts` | `avatar.spec.ts`、`profile-summary.spec.ts` |
| `resources.spec.ts` | 依功能併入 subjects、tasks、study-sessions、notes、cross-user-isolation |
| `achievement-columns.spec.ts` | 併入 `achievement-display.spec.ts` |

