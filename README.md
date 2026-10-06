# StudyFlow 學生學習管理系統

把考試日期、學習任務、讀書時間、複習筆記與錯題集中在同一個地方，並用圖表呈現學習狀況的 Web 系統。

🔗 **線上版本：<https://studyflow.sekinv.com>**（可安裝成手機 App）

> 國立彰化師範大學「高等教育深耕（揚鷹計畫）— 啟導揚學」適性學習類成果作品。

## 功能

以下只列出已合併、並通過 Sprint 3 產品驗收的功能（驗收紀錄見 [docs/agile/sprint-review.md](docs/agile/sprint-review.md)）。

| 功能 | 說明 |
|---|---|
| 總覽 | 今天／本週學習時數與目標進度（達成時顯示「已達成」）、連續學習天數、今天要處理的任務（可直接按 ▶ 開始專注）、即將到來的考試倒數與準備進度、各科每週目標進度（落後最多的在前）、近 7 天學習時間 |
| 科目 | 從 8 個色盲友善的推薦色或整片色盤（10 × 4）挑色，也可自訂 hex；顏色太灰或和其他科目太像會提醒；可選圖示、用上移／下移調整順序；單科總覽頁（`/subjects/:id`）集中該科的考試、任務、讀書時間與錯題 |
| 學習目標 | 在設定頁設定每日、每週與各科每週的讀書目標；統計頁顯示達成每日目標的天數；各科目標加總超過每週目標時提醒（不阻擋） |
| 考試與截止日 | 倒數（今天／明天／N 天後，3 天內的考試以紅色標示）、地點與備註；可為考試建立準備任務並追蹤完成進度；「複習這科錯題」捷徑 |
| 學習任務 | 依期限分組的清單與看板檢視；子任務清單（「2／5」，全部勾完時詢問是否一併完成）；搜尋與排序（期限、優先度、最新建立、預估時間，存在網址參數）；顯示實際投入時間與預估的比較；看板可用滑鼠拖曳換欄，鍵盤用卡片上的按鈕 |
| 月曆 | 月檢視與週檢視（週一到週日的時間軸）；同時看到考試、截止日、任務期限與實際讀書的時段（依使用者時區，跨午夜會分成兩段）；手機寬度的週檢視改為單日時間軸 |
| 學習計時 | 番茄鐘（自訂專注／短休息／長休息與每幾輪長休息、可分別開關自動休息與自動專注）與碼錶；重新整理或切換分頁不會中斷；電腦睡眠後不會補記不在時的番茄；可編輯或補登學習紀錄；離線時先暫存、恢復連線後補送；可選白噪音、粉紅噪音、棕噪音（用 Web Audio 即時產生，預設關閉） |
| 筆記與錯題 | Markdown 筆記、錯題、拍照上傳、標籤與全文搜尋（命中處標出）；可釘選重要筆記 |
| 間隔複習與考前衝刺 | 錯題依 1、3、7、14、30 天間隔排入複習；另有「考前衝刺」模式，可依科目或標籤一次練完未掌握的錯題，衝刺的作答不影響間隔複習的排程 |
| 學習統計 | 每日學習時間、各科時間占比、每週任務完成率、16 週學習熱度圖、錯題掌握度；每張圖都有表格檢視 |
| 全站搜尋 | 在任何頁面按 Ctrl／⌘ + K（手機點頁首的搜尋按鈕）搜尋任務、考試、筆記、科目，或執行快捷動作；可用方向鍵、Enter、Esc 操作 |
| 成就 | 約 12 個里程碑徽章（累積時數、連續天數、番茄數、掌握錯題等），由現有資料即時計算；只有本人看得到，沒有排行榜 |
| 匯出 | 設定頁可下載 JSON 備份（不含密碼雜湊與登入資訊）、CSV（學習紀錄與任務，UTF-8 BOM、依時區、防公式注入）與 .ics 行事曆（考試與截止日，考試前一天提醒） |
| 外觀與其他 | 6 組主題色、淺色／深色模式、手機版介面、PWA（可安裝、離線開啟）、多使用者帳號 |

### 已知限制

- **.ics 提醒**：檔案內含提醒，但匯入 Google 日曆後提醒是否生效尚未實際驗證（Google 對匯入事件的提醒有時會忽略）；Apple 日曆與 Outlook 也尚未實測。必要時請在日曆裡手動加通知。
- **看板的觸控拖曳**：程式已支援長按拖曳，但尚未在實機上驗證；滑鼠與鍵盤操作已驗證。
- **還原**：目前只能匯出備份，不能從備份還原。
- **子任務**：項目不能改名（要刪掉再新增），任務搜尋不比對子任務。
- **指令面板**：「開始專注」只前往計時頁，不會自動開始計時。
- **成就**：「已看過」的紀錄存在各瀏覽器，換瀏覽器可能會再跳一次通知。
- **PWA 圖示**：固定為藍筆版，不跟主題色。
- **部署新版後**：已開著的舊分頁可能載入不到新檔案，頁面會提示重新整理。

## 系統架構

```
            瀏覽器 / 手機 PWA
   React 19 + React Router + TanStack Query
                   │  HTTPS（同一個網域）
                   ▼
┌──────────── Cloudflare Workers ─────────────┐
│  Static Assets：前端檔案（SPA）             │
│  Hono API：/api/*                           │
│   ├─ 登入驗證 middleware（session cookie）  │
│   ├─ zod 輸入驗證（與前端共用 schema）      │
│   └─ Drizzle ORM                            │
└──────────┬──────────────────────┬───────────┘
           ▼                      ▼
   Cloudflare D1（SQLite）   Cloudflare R2
   使用者、任務、紀錄…       錯題照片（不公開）
```

- **前端**：React 19、TypeScript、Vite、Tailwind CSS v4、Recharts、vite-plugin-pwa
- **後端**：Hono（跑在 Cloudflare Workers）、Drizzle ORM、zod
- **資料**：Cloudflare D1（SQLite）、Cloudflare R2（物件儲存）
- **測試**：Vitest + `@cloudflare/vitest-plugin`（測試直接跑在 Workers 執行環境 workerd 中）

## 資料庫設計

| 資料表 | 用途 |
|---|---|
| `users` | 帳號、密碼雜湊、暱稱、時區、每日與每週讀書目標 |
| `sessions` | 登入 session（只存 token 的 SHA-256） |
| `login_attempts` | 登入／註冊失敗次數（防暴力破解） |
| `subjects` | 科目、顏色、圖示、排序、每週目標 |
| `events` | 考試與截止日 |
| `tasks` | 學習任務（可連結考試）、子任務清單 |
| `study_sessions` | 每一段學習時間 |
| `notes` | 筆記與錯題、釘選、複習排程 |
| `attachments` | 照片（實際檔案在 R2） |

Schema 定義在 [src/worker/db/schema.ts](src/worker/db/schema.ts)，migration 由 drizzle-kit 產生在 [migrations/](migrations/)。

設計慣例：「時間點」（例如開始讀書的時刻）存 UTC 毫秒，「日曆日期」（考試日、期限）存使用者當地的 `YYYY-MM-DD`，統計時依使用者時區分組，避免跨時區造成日期錯位。

## 安全設計

- 密碼使用 PBKDF2-SHA256（100,000 次迭代，每個帳號有獨立的 salt），以固定時間比對
- Session token 為 256-bit 亂數，放在 `HttpOnly`、`Secure`、`SameSite=Lax` cookie；資料庫只存雜湊值
- 同一帳號 15 分鐘內登入失敗 10 次即暫時鎖定；註冊有 IP 頻率限制
- 所有資料查詢都限定目前使用者；引用科目、考試、任務時也會驗證擁有者（有自動化測試）
- 上傳的照片以檔案內容判斷真實格式（不相信副檔名），R2 bucket 不公開，每次讀取都驗證身分
- CSRF 防護（檢查 Origin）、CSP、`X-Frame-Options` 等安全標頭；Markdown 不渲染原始 HTML

## 專案結構

```
src/
  react-app/        前端
    pages/          各頁面（總覽、月曆、任務、計時、筆記、統計、設定…）
    components/     共用元件、表單、圖表
    lib/            API client、資料查詢 hooks、計時器、主題
  worker/           後端（Hono）
    routes/         API 路由
    db/schema.ts    資料表定義
    lib/            密碼、session、頻率限制、統計計算
  shared/           前後端共用：驗證 schema、API 型別、日期工具
migrations/         D1 SQL migration
test/               API 整合測試與前端純函式測試
public/             PWA 圖示、安全標頭設定（_headers）
```

## 本機開發

需要 Node.js 20 以上。

```bash
npm install
npm run db:migrate:local   # 建立本機 D1 資料表
npm run dev                # http://localhost:5173
```

本機開發時 D1 與 R2 由 Wrangler 在 `.wrangler/` 內模擬，不會動到正式資料。

| 指令 | 說明 |
|---|---|
| `npm test` | 執行測試（API 整合測試與前端純函式測試；Sprint 3 結束時為 35 個檔案、314 個測試） |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run lint` | ESLint |
| `npm run check` | 型別檢查 + 建置 + 部署預演 |

### 修改資料表

1. 修改 `src/worker/db/schema.ts`
2. `npm run db:generate` 產生新的 migration
3. `npm run db:migrate:local` 套用到本機；上線前 `npm run db:migrate:remote` 套用到正式資料庫

## 部署

部署在 Cloudflare Workers，網域 `studyflow.sekinv.com`（設定在 [wrangler.jsonc](wrangler.jsonc) 的 `routes`）。

- **自動部署**：Cloudflare Workers Builds 連結本 GitHub repo，push 到 `main` 後自動建置部署
- **手動部署**：`npm run deploy`

第一次建立環境時使用的指令（已完成）：

```bash
npx wrangler d1 create studyflow-db --location apac
npx wrangler r2 bucket create studyflow-uploads --location apac
npm run db:migrate:remote
npm run deploy
```
