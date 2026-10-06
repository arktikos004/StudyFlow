# Sprint 3 Review 與回顧

由 Product Owner 撰寫。驗收基準是 develop `8b8d0b9`。

**依據的種類**
- 程式碼：`檔案:行號`（路徑省略 `src/react-app/`、`src/worker/`、`src/shared/` 時，以欄位內說明為準）。
- 測試：`test/*.spec.ts` 的 describe／it。PO 在 `8b8d0b9` 重跑 `npm test`：35 個測試檔、314 個測試全過。
- QA：qa-engineer 在 Sprint 3 開始時（`8a658ee`）的檢查結果。畫面截圖是修正之前拍的；修正之後以 s3/polish 的 `final-*.png` 與程式碼為準。
- 只靠程式碼與測試看不出來的項目，一律放進「手動驗收清單」，**沒有當成已確認**。

## 1. Sprint 1～3 的目標與結果

| Sprint | 目標 | 結果 |
|---|---|---|
| 1 地基 | 設計系統上線、科目整片色盤、資料模型與 API 一次到位 | 三條 lane 已合併（review 後修正）；QA 通過，無阻斷問題 |
| 2 功能與頁面 | 每頁照新設計改版，補齊目標、計時、任務、月曆、筆記、搜尋、成就 | 六條 lane 已合併；累積了一批共用元件遷移與畫面細節待辦 |
| 3 驗收 | code review、QA、設計審查、PO 驗收 | QA 有條件通過（無 Blocker）；設計審查高 3、中 12、低 15，已由 s3/polish、s3/design 處理；本文件完成逐條驗收 |

## 2. 逐條驗收

結果欄：通過／部分通過／不通過。「手」表示有項目列在第 4 節的手動驗收清單。

### 總表

| ID | 結果 | 說明 |
|---|---|---|
| UI-1 | 通過 | 手：Safari／實機的 iOS 縮放 |
| UI-2 | 通過 | 手：骨架畫面 |
| BUG-1 | 通過 | |
| SUB-1 | 通過 | |
| SUB-2 | 通過 | |
| SUB-3 | 通過 | |
| SUB-4 | 通過 | 手：計時環跟著變色只看過程式碼 |
| GOAL-1 | 通過 | |
| GOAL-2 | 通過 | |
| DASH-1 | 通過 | |
| TMR-1 | 通過 | |
| TMR-2 | 通過 | |
| TMR-3 | 通過 | 手：實際聽得到聲音、音量 |
| TSK-1 | 通過 | |
| TSK-2 | 部分通過 | 缺第 1 條的「觸控」：觸控長按拖曳沒有人實際操作過 |
| TSK-3 | 通過 | |
| TSK-4 | 通過 | |
| CAL-1 | 通過 | 手：手機單日時間軸實機 |
| CAL-2 | 部分通過 | 缺「匯入 Google 日曆後提醒是否生效」（驗收目的），RFC 5545 項目都通過 |
| DATA-1 | 通過 | |
| NOTE-1 | 通過 | |
| NOTE-2 | 通過 | 「衝刺不呼叫 /review」只有 QA 手動確認，沒有自動化測試 |
| APP-1 | 通過 | 手：chunk 載入失敗與 Safari 重試 |
| APP-2 | 通過 | |

沒有「不通過」的故事。

### UI-1 設計系統：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | tokens 與 DESIGN.md 一致，舊名稱留別名 | `index.css:7`（色彩 tokens）、`:70`（「Sprint 1 相容」別名）；設計審查：沒有 raw 色彩 |
| 2 | 對比、iOS 縮放、觸控目標、Segmented／Dialog／Field 無障礙 | QA：6 組主題色 × 淺深色 20 組主要搭配對比通過、觸控目標、Segmented／Dialog 焦點；`index.css:658`（手機 16px）；`ui.tsx:570-585`（radiogroup） |
| 3 | 數字用 Archivo、等寬 | `index.css:299-300`（`--font-num`）、`:695`、`:807`（`tabular-nums`） |
| 4 | DESIGN.md §7 共用小元件 | `ui.tsx` 匯出 `PageHeader`、`SectionLabel`、`StatStrip`（`charts.tsx`）、`Countdown`、`Unit`、`Duration`、`Figure`、`TableToggle`、`ToggleButton` 等（`ui.tsx:310-1392`） |
| 5 | 跳到主要內容、手機底部導覽實心底與膠囊 | `Layout.tsx:325`、`:410`（`#main-content`）、`:230`、`:415` |

### UI-2 各頁改版：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 總覽一個焦點、StatStrip | `pages/Dashboard.tsx:116`；`final-*.png`（總覽） |
| 2 | 計時頁是專注空間 | `pages/Timer.tsx`（`ProgressRing`、`Segmented`）；QA 計時頁截圖與按鈕大小 |
| 3 | 月曆 chip、鍵盤操作 | `components/calendar/chips.tsx`；`calendar.spec.ts`「月格與鍵盤移動」；QA：月曆鍵盤操作通過 |
| 4 | 筆記卡、搜尋 `<mark>` | `components/notes/card.tsx:12`（說明）、`Highlight`（`ui.tsx:1084`） |
| 5 | 考試頁倒數磚 | `pages/Events.tsx:40`（`CountdownTile`）；`polish-countdown.spec.ts` |
| 6 | Auth 兩欄、顯示密碼 | `pages/Auth.tsx:62`（`lg:grid-cols-2`）、`:81-92`；QA：品牌欄 chip 對比淺色 ≥ 11.8、深色 ≥ 13.8 |
| 7 | 不再用 emoji 當圖示 | PO 在 `src/react-app` 搜尋 emoji 區段字元，沒有結果；設計審查：沒有 emoji |

### BUG-1 筆記列表：通過

| 條件 | 依據 |
|---|---|
| 改用 `attachments.user_id` 查詢、記憶體篩選 | `routes/notes.ts:37-42` |
| 120 則以上仍正常 | `notes-v2.spec.ts`「筆記列表的照片（BUG-1）」：筆記超過 100 則時列表仍正常（建立 120 則） |

### SUB-1 科目完整色盤：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 8 個推薦色有名稱；新科目自動指派未用過的推薦色 | `shared/palette.ts:9-14`（名稱）、`lib/subject-color.ts:8`；`color.spec.ts`「推薦色沿用 SUBJECT_COLORS 的順序與名稱」 |
| 2 | 10 × 4 色盤、自訂方塊／色相／hex、「顏色格式錯誤」 | `ColorPicker.tsx:21`、`:260`（10 × 4）、`:449`（錯誤訊息）；`color.spec.ts`「色盤」「色碼解析」 |
| 3 | 一律經過 `subjectTone`、深色自動調整 | `color.spec.ts`「subjectTone」；`subjectTone` 在 `src/react-app` 有 18 處呼叫；`polish-subject-tile.spec.ts` |
| 4 | 太灰或太像時提醒、「改用建議色」 | `ColorPicker.tsx:156`；`color.spec.ts`「colorWarnings」 |
| 5 | 方向鍵、觸控 44px、兩塊 5 × 4 | `ColorPicker.tsx:173-182`、`:215`（`size-11`）、`:258-260`、`:335`；QA：色盤鍵盤操作通過 |

### SUB-2 科目圖示與排序：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | lucide 白名單圖示顯示在 SubjectTag | `subjects-v2.spec.ts`「科目圖示（SUB-2）」；`components/subjects.tsx:116`；`settings/IconPicker.tsx` |
| 2 | 上移／下移、各處依順序 | `settings/SubjectsCard.tsx:61`、`:71`；`routes/subjects.ts:26`（`sortOrder` 排序） |
| 3 | 排序 API 必須收到全部 id，否則 400；新科目排最後 | `routes/subjects.ts:43`、`:63`；`subjects-v2.spec.ts`「ids 必須剛好是本人全部的科目，否則回 400」「新科目排在最後」 |

### SUB-3 單科總覽頁：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 路由 `/subjects/:id`、非本人顯示「找不到此科目」 | `main.tsx:89`；`pages/Subject.tsx:680`；`subjects-v2.spec.ts`「別人的科目：總覽…回 404」 |
| 2 | 考試、可勾選任務、本週與 30 天時間、週目標、錯題數、「複習這科」 | `pages/Subject.tsx:568`；`subjects-v2.spec.ts`「單科總覽」 |
| 3 | 一次 API | 同上（`一次取得…`）；`routes/summary.ts` |

### SUB-4 App 主題色：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 6 組色、白字對比 ≥ 4.5:1（淺深） | `lib/theme.ts:77`（`ACCENTS`）；QA：6 組主題色 × 淺深色對比通過 |
| 2 | localStorage、`theme-init.js` 首繪前套用 | `public/theme-init.js`（`studyflow:accent`、`data-accent`） |
| 3 | 圖表與計時環跟著變色 | `components/charts.tsx:145`（`var(--accent)`）；計時環（`ProgressRing`）只看過程式碼，列入手動清單 |

### GOAL-1 每日／每週目標：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 設定頁、10–720／60–5040、可清除 | `shared/schemas.ts:29-30`、`:55-56`；`goals.spec.ts`「每日／每週讀書目標（GOAL-1）」兩則 it |
| 2 | 總覽進度、「已達成」、「設定目標」 | `components/dashboard/goals.tsx:20`、`:95`；`ui.tsx:897-940`（`GoalProgress`）；`#goals` 錨點 |
| 3 | 週一起算、依時區 | `shared/dates.ts:98`；`routes/dashboard.ts:50`；`goals.spec.ts`「列出…本週（週一起算）」 |
| 4 | 統計頁達成天數 | `pages/Stats.tsx:103-122`；`goals.spec.ts`「統計：達成每日目標的天數」 |

### GOAL-2 各科每週目標：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 編輯科目設定每週目標 | `shared/schemas.ts:100`；`goals.spec.ts`「各科每週目標（GOAL-2）」 |
| 2 | 科目色進度條、落後最多在前、封存不列入 | `dashboard/goals.tsx:74`（`sortByLag`）；`routes/dashboard.ts:45`（`archived = false`） |
| 3 | 加總超過時提醒但不阻擋 | `settings/GoalSumWarning.tsx:16`（「仍然可以儲存」） |

### DASH-1 一鍵專注與考試準備：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 任務列 ▶、帶入任務科目、計時中先詢問 | `dashboard/tasks.tsx:84`；`dashboard/hooks.ts:23-24`；QA 跨 lane 抽查通過 |
| 2 | 即將到來的考試顯示準備完成數與進度條 | `dashboard/upcoming.tsx:45`；`dashboard/exams.tsx:11`（`PrepProgress`） |

### TMR-1 自訂番茄鐘：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 專注 1–180、短休息 1–60、長休息 5–60（預設 15）、N 為 2–8（預設 4） | `lib/timer-core.ts:48-50`；`timer.spec.ts`「設定檢查與通知文字」 |
| 2 | 第 N 個長休息、「第 k／N 輪」、跨日歸零 | `timer.spec.ts`「當天第 N、2N 個番茄完成後進入長休息」「輪數跨日歸零」「第 k／N 輪（roundInfo）」 |
| 3 | 分別開關自動休息與自動專注 | `timer.spec.ts`「關閉自動開始休息」「休息結束後自動專注」「關閉自動專注」 |
| 4 | 延遲超過 1 分鐘不自動、不補記 | `timer.spec.ts`「延遲超過 1 分鐘…」「電腦睡了 3 小時…絕不補記」 |
| 5 | 舊 localStorage 缺欄位用預設值 | `timer.spec.ts`「舊版 localStorage 狀態（normalizeState）」 |

### TMR-2 編輯學習紀錄：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 切換日期、可編輯、與補登共用 `SessionDialog` | `pages/Timer.tsx:316`（前一天）、`:677`（`SessionDialog`）；`components/SessionDialog.tsx` |
| 2 | PATCH：別人的 404、引用別人的 id 400、規則同新增 | `sessions-edit.spec.ts`「規則和新增時一樣…」「學習紀錄編輯的跨使用者隔離」 |
| 3 | 儲存後各頁更新 | `sessions-edit.spec.ts`「編輯後，任務投入時間、總覽與統計都跟著更新」；`lib/timer.ts:296` invalidate；QA 抽查通過 |

### TMR-3 白噪音：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 三種噪音、音量、專注時播放、預設關閉 | `lib/noise.ts:7-18`（預設 `off`）；`pages/Timer.tsx:213`、`:662`（`focusRunning` 才播放） |
| 2 | Web Audio 即時產生 | `lib/noise.ts:103-112`（`createBuffer`，沒有音檔） |

此項沒有自動化測試；實際聲音列入手動清單。

### TSK-1 子任務清單：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 新增、勾選、刪除、排序；30 項／100 字，超過回 400 | `tasks-v2.spec.ts`「最多 30 項、每項最多 100 字…回 400」；`task-checklist.spec.ts` |
| 2 | 任務列顯示「2／5」 | `task-checklist.spec.ts`「進度「2／5」…」 |
| 3 | 全勾完詢問、不自動完成 | `forms/TaskDialog.tsx:84-88`；`tasks/ChecklistEditor.tsx:80`；`task-checklist.spec.ts`「justCompleted」 |

### TSK-2 看板拖曳：部分通過

| # | 條件 | 結果與依據 |
|---|---|---|
| 1 | 滑鼠與觸控拖曳；樂觀更新；失敗退回並 toast | 滑鼠與失敗退回：通過（`tasks/TaskBoard.tsx:84`；`task-patch.spec.ts`「樂觀更新的套用與還原」；QA：滑鼠拖曳換欄、PATCH 失敗退回原欄並提示）。**觸控：未驗證**，程式有設定（`TaskBoard.tsx:85`，長按 200ms），但 QA 的 CDP 無法模擬長按 |
| 2 | 拖到已完成記錄完成時間 | `task-sort.spec.ts`「拖到已完成時記下完成時間…」；QA：`completedAt` 有記錄 |
| 3 | 鍵盤用原本按鈕 | `TaskBoard.tsx:62`（說明）；`task-sort.spec.ts`「相鄰的欄」 |

缺的是第 1 條的觸控，交給手動清單。

### TSK-3 任務搜尋與排序：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 即時搜尋標題與說明、無結果顯示「找不到符合的任務」 | `task-sort.spec.ts`「搜尋（TSK-3）」；`pages/Tasks.tsx:156`、`:163` |
| 2 | 期限（預設，保留分組）、優先度、最新建立、預估時間 | `task-sort.spec.ts`「排序（TSK-3）」「分組（清單檢視）」 |
| 3 | `?q=&sort=` | `lib/task-queries.ts:75`（`useTaskListParams`）；`task-sort.spec.ts`「parseSort」 |

### TSK-4 實際投入時間：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 「已投入 45 分／預估 60 分」、超過用警示色 | `task-format.spec.ts`「已投入／預估時間（TSK-4）」；`tasks/TaskMeta.tsx:62`（`text-warning`）；QA：「已投入 50 分／預估 45 分，超過 5 分」 |
| 2 | 只加總本人、完成計時後自動更新 | `tasks-v2.spec.ts`「加總本人連結到該任務的學習時間」「任務的跨使用者隔離」；`lib/timer.ts:296` |

### CAL-1 週檢視與學習時段：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 月／週切換、週一到週日、預設 07:00 | `pages/Calendar.tsx:28`；`calendar/TimeGrid.tsx:14`；`calendar.spec.ts`「月格 42 天…週檢視是週一到週日」 |
| 2 | 依時區、科目色方塊、跨午夜兩段 | `calendar/layout.ts:90`；`calendar.spec.ts`「學習紀錄切成每天的時段（splitByDay）」 |
| 3 | 手機單日時間軸 | `pages/Calendar.tsx:58-59`（`min-width: 64rem` 以下單日）；實機列入手動清單 |
| 4 | 點時段開 `SessionDialog`、月格顯示分鐘 | `pages/Calendar.tsx:66`；`calendar/MonthView.tsx:24`；`calendar.spec.ts`「每天的讀書分鐘數」 |

### CAL-2 匯出 .ics：部分通過

| # | 條件 | 結果與依據 |
|---|---|---|
| 1 | 全部考試與截止日、可選包含任務期限 | 通過：`export.spec.ts`「行事曆匯出（CAL-2）」；QA：任務期限是全天事件 |
| 2 | RFC 5545：UID、CRLF、75 octets、跳脫、考試前一天 VALARM | 通過：`ics.spec.ts`（`escapeText`、`foldLine`、`buildCalendar`）；`worker/lib/ics.ts:84`；`routes/export.ts:176`（`-P1D`）、`:184`（`-PT15H`）；QA：全程 CRLF、無超長行、中文不切斷 |
| 3 | 只含本人、未登入 401 | 通過：`export.spec.ts`「匯出的跨使用者隔離」「未登入回 401」 |

缺的是「匯入 Google 日曆後 VALARM 實際會響」，QA 無法登入 Google，Apple 日曆與 Outlook 也沒有實測。檔案本身符合規範，但提醒是否生效取決於日曆軟體，所以標部分通過。

### DATA-1 匯出 JSON 與 CSV：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | JSON 備份內容；無密碼雜湊與 session | `export.spec.ts`「JSON 備份（DATA-1）」；QA：備份沒有密碼雜湊與 session |
| 2 | CSV：時區、BOM、防公式注入 | `csv.spec.ts`「csvCell」「toCsv」；`export.spec.ts`「CSV 匯出（DATA-1）」；QA：BOM、`'` 前綴、Asia/Taipei |
| 3 | 只含本人、未登入 401 | `export.spec.ts`「匯出的跨使用者隔離」；`test/qa-isolation.spec.ts` |

### NOTE-1 釘選筆記：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 釘選／取消、圖釘標示、置頂後依更新時間 | `notes-v2.spec.ts`「釘選的排最前面，其次依更新時間」；`components/notes/pin.tsx` |
| 2 | 篩選時釘選仍在最前 | `notes-v2.spec.ts`「套用篩選時，符合條件的釘選筆記仍然排在最前面」 |
| 3 | 不改最後更新與複習排程 | `notes-v2.spec.ts`同上第一則（「釘選不改變更新時間與複習排程」） |

### NOTE-2 考前衝刺複習：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 今天到期／考前衝刺、科目或標籤、隨機、含已掌握 | `components/notes/review.tsx:41`、`:511-521`；`notes-ui-cram.spec.ts`「考前衝刺的題庫」「洗牌與題目順序」 |
| 2 | 衝刺不影響間隔複習 | `review.tsx:428`（只有一般複習呼叫 `useReviewNote`）；QA：衝刺不改 `reviewStage`／`lastReviewedAt`。**無自動化測試**（專案沒有 jsdom），已列入待辦 |
| 3 | 考試卡「複習這科錯題」捷徑 | `pages/Events.tsx:97` |

### APP-1 全站搜尋 Ctrl/⌘+K：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 全頁開啟、手機按鈕、方向鍵／Enter／Esc、combobox | `components/CommandPalette.tsx:61`、`:315-318`；`Layout.tsx:344`；`shell-palette.spec.ts`「快速鍵」「上下鍵移動」；QA：⌘K／Ctrl+K、方向鍵、Esc |
| 2 | 分組、每組 5 筆、中文子字串、`?open=` | `routes/search.ts:12`；`search.spec.ts`「每類最多 5 筆」「搜尋任務、考試、筆記、科目…支援中文子字串」；`shell-palette.spec.ts`「搜尋結果的深連結」；QA：深連結開出對應對話框 |
| 3 | 快捷動作 | `lib/shell-palette.ts:28-30`；`shell-palette.spec.ts`「快捷動作的目的地符合驗收條件」 |

### APP-2 成就與里程碑：通過

| # | 條件 | 依據 |
|---|---|---|
| 1 | 約 12 個、即時計算、進度 | `routes/achievements.ts:67-69`；`achievements.spec.ts`「新使用者：12 個成就依固定順序列出」 |
| 2 | 全站 toast 一次、記在 localStorage | `Layout.tsx:132`、`:278`；`lib/shell-achievements.ts:7`；`shell-achievements.spec.ts`；QA：第一次靜默、補登第一筆後跳出「踏出第一步」 |
| 3 | 只有本人、沒有排行榜 | `achievements.spec.ts`「成就的跨使用者隔離」 |
| 4 | 番茄 ≥ 10 分、連續 7 天依目前目標、刪除收回 | `achievements.spec.ts`「番茄鐘只計入 mode = pomodoro 而且至少 10 分鐘」「連續 7 天達成每日目標…」 |

## 3. Definition of Done 檢查

依據 QA 與 Scrum Master 的整合檢查（integration `13e6dd8`），PO 在 `8b8d0b9` 重跑測試。

| DoD 項目 | 結果 | 依據 |
|---|---|---|
| zod 共用 schema、zh-TW 錯誤訊息 | 通過 | `shared/schemas.ts`；各 spec 的 400 案例 |
| 查詢限定使用者、`assertOwned` | 通過 | QA 跨使用者隔離：讀、改、刪、複習、照片、科目總覽 404，引用別人的 id 與重排 400；`test/qa-isolation.spec.ts` |
| 日期與時區慣例 | 通過 | `calendar.spec.ts`、`timer.spec.ts`（夏令時間、跨日）、QA：CSV 時區 |
| 介面符合 DESIGN.md、對比、觸控 44px、鍵盤、reduced motion | 通過（有保留） | QA 對比與觸控；`usePrefersReducedMotion`（`ui.tsx:1370`）；保留：DARK_BAND 見回顧 |
| 淺色、深色、手機寬度 | 通過 | QA 每頁淺深色 × 390／1280；`final-*.png` |
| 新 API 整合測試含跨使用者 | 通過 | 35 個測試檔、314 個測試全過（PO 重跑） |
| typecheck、lint、build | 通過 | typecheck 通過；lint 0 errors（11 warnings，react-refresh 與產生檔）；build 通過；`npm run check` 含 `wrangler deploy --dry-run` 通過 |
| migration 只新增、通過 grep | 通過 | `drizzle-kit check`；三個 grep 無輸出；有資料的暫存 D1 先套 0000、塞資料、再套 0001，筆數一致、關聯未被清成 NULL、`PRAGMA foreign_key_check` 無輸出 |
| code review、合併 | 通過 | 看板：各 lane 都有 review 紀錄 |

## 4. 給使用者的手動驗收清單

以下 PO 與 QA 都沒有實際操作過，**請你確認**。

1. **Google 日曆提醒（CAL-2）**
   1. 設定頁「下載行事曆」（可勾選包含任務期限）。
   2. Google 日曆：齒輪 > 設定 > 匯入與匯出 > 匯入；選一個新建的測試日曆。
   3. 打開匯入的考試事件，看通知是否有「1 天前」。
   4. 若沒有：Google 對匯入事件的 VALARM 有時會忽略，需改用日曆的預設通知。這時請告訴 PO，README 會註明改用 Apple 日曆或 Outlook，或手動加通知。
2. **Apple 日曆、Outlook 匯入 .ics**：事件、全天事件與提醒是否正確。
3. **看板觸控長按拖曳（TSK-2）**：手機上長按卡片後拖到另一欄，放開後狀態更新；試著斷網拖曳，確認會退回並提示。
4. **指令面板（APP-1）**：Safari 開啟；模擬 chunk 載入失敗（例如部署新版後用舊分頁開）時是否出現提示並可重試。
5. **載入中的骨架畫面**：用慢速網路看各頁。
6. **白噪音（TMR-3）**：三種噪音聽得到、音量可調、暫停或休息時停止（iOS Safari 需要先點一下才會出聲，請確認）。
7. **計時環與圖表跟著主題色變色（SUB-4）**：切換 6 組主題色，看計時環與統計圖。
8. **手機單日時間軸（CAL-1）**：實機看月曆週檢視。
9. **iOS Safari**：輸入欄聚焦時不會自動放大。

## 5. 回顧

**做得好的**
- 一開始就用 `DESIGN.md` 與 DoD 把規則寫死，QA 能逐條對照；API 都有跨使用者隔離測試，QA 又補了 `test/qa-isolation.spec.ts`。
- 後端 Sprint 1 一次到位，Sprint 2 的各頁 lane 可以平行做，沒有互相等資料。
- migration 只新增欄位與表，而且有在有資料的 D1 上演練。
- Agent 被中斷多次（用量上限 429、HTTP 403、stream watchdog、網路錯誤），都靠「先 commit 再喚醒」接續，沒有遺失改動。

**可以改進的**
- **跨 lane 重複造輪子**：倒數磚做了 4 份，另有 `TextLink`、`TableToggle`、`gridKeyTarget` 等。共用元件應該在第一波就定好並要求使用，而不是 Sprint 3 才遷移。
- **設計審查放在最後**：高 3、中 12、低 15 的問題都在 Sprint 3 才發現。下一版應在每個 Sprint 的中段做一次設計審查。
- **沒有 jsdom**：樂觀更新、衝刺不呼叫 `/review` 等前端行為只能靠 QA 手動確認。
- **QA 環境限制**：沒有觸控長按、Safari、Google 帳號，所以 TSK-2 與 CAL-2 沒法完全驗收。
- **截圖時間差**：QA 截圖在修正之前，修正後的畫面是 s3/polish 用模擬 API 資料拍的，不是真 D1。
- DARK_BAND 的改善需要改凍結檔 `src/shared/color.ts`，應該在 Sprint 1 就排進去。

**下一版的行動項目**（細項見 backlog「Sprint 3 結束時的待辦」）
1. 完成手動驗收清單，依結果決定 README 對 .ics 提醒的說法。
2. 補測試環境（jsdom 或 Playwright）後補上前端行為測試。
3. 設計審查改為每個 Sprint 中段做一次。
4. 先定共用元件清單，各 lane 開工前先看。
5. 處理後端改善與已知限制。
