# StudyFlow 學生學習管理系統

把考試日期、學習任務、讀書時間、複習筆記與錯題集中在同一個地方，並用圖表呈現學習狀況的 Web 系統。

🔗 **線上版本：<https://studyflow.sekinv.com>**（可安裝成手機 App）

> 國立彰化師範大學「高等教育深耕（揚鷹計畫）— 啟導揚學」適性學習類成果作品。

## 功能

| 功能 | 說明 |
|---|---|
| 總覽 | 今天／本週學習時數、連續學習天數、今天要處理的任務、即將到來的考試倒數、近 7 天學習時間 |
| 考試與截止日 | D-Day 倒數、地點與備註；可為考試建立準備任務並追蹤完成進度 |
| 學習任務 | 依期限分組（逾期／今天／未來 7 天／之後）的清單與看板檢視，優先度、預估時間、連結考試 |
| 月曆 | 在同一個月曆看到考試、截止日與任務期限，依科目上色 |
| 學習計時 | 番茄鐘（可調專注／休息時間）與碼錶；重新整理或切換分頁不會中斷；時間到會通知；離線時先暫存，恢復連線後自動補送；可手動補登 |
| 筆記與錯題 | Markdown 筆記、錯題（題目／錯誤答案／正解／錯誤原因）、拍照上傳、標籤與全文搜尋 |
| 間隔複習 | 錯題依 1、3、7、14、30 天間隔排入複習，答錯重來，全部通過即「已掌握」 |
| 學習統計 | 每日學習時間（依科目堆疊）、各科時間占比、每週任務完成率、16 週學習熱度圖、錯題掌握度；每張圖都有表格檢視 |
| 其他 | 多使用者帳號、深色模式、手機版介面、PWA（可安裝、離線開啟） |

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
| `users` | 帳號、密碼雜湊、暱稱、時區 |
| `sessions` | 登入 session（只存 token 的 SHA-256） |
| `login_attempts` | 登入／註冊失敗次數（防暴力破解） |
| `subjects` | 科目與顏色 |
| `events` | 考試與截止日 |
| `tasks` | 學習任務（可連結考試） |
| `study_sessions` | 每一段學習時間 |
| `notes` | 筆記與錯題、複習排程 |
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
test/               API 整合測試
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
| `npm test` | 執行 API 整合測試 |
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
