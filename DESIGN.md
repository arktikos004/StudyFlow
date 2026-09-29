# StudyFlow 設計系統：藍筆與螢光筆（Ink & Highlighter）

白天是紙上的藍筆字，晚上反過來。科目色是唯一鮮豔的顏色，像螢光筆一樣標記學生自己的科目。
適用於 `src/react-app/**`。拿不定主意時：外框更安靜，科目更清楚。

參考來源（已安裝在 `.claude/skills/`）：
- frontend-design（Anthropic）
- impeccable（pbakaus）
- web-design-guidelines（Vercel）

另外也參考了：
- Dammyjay93/interface-design 的做法。
- ui-ux-pro-max 的優先級規則。
- 本機的 dataviz skill（科目色與圖表）。

## 1. 原則

1. **操作優先，不做裝飾**：這是每天用的工具。好掃讀、一致、符合平台習慣，比表現手法重要。
2. **每個畫面一個焦點**：學生來這頁要做的那件事，在大小、對比、位置上都勝出。
3. **科目是螢光筆**：科目色是唯一有表情的顏色，外框只用墨色與紙色。
4. **數字是聲音**：計時、倒數、統計用 `font-num`，文字用系統中文字型。
5. **紅色代表現在就要處理**：只用於逾期、3 天內的考試、刪除等破壞性操作。紅色不用來標記內容類型，也不當裝飾。
6. **每個狀態都要設計**：
   - 互動：default、hover、active、focus-visible、disabled、loading。
   - 頁面：empty、error、offline。
7. **無障礙內建**：
   - 對比：文字 ≥ 4.5:1，圖形與控制項邊界 ≥ 3:1。
   - 操作：觸控目標 ≥ 44px，支援 WAI-ARIA 鍵盤操作。
   - 動效：支援 reduced motion。

## 2. 色彩 tokens

`index.css` 的 `:root` 和 `[data-theme='dark']` 定義 tokens，再透過 `@theme inline` 提供給 Tailwind 使用。

| token | 淺色 | 深色 | 用途 |
|---|---|---|---|
| page | #f7f6f2 | #0c0f18 | 畫布：紙／墨夜 |
| card | #fdfcfa | #151924 | 靜止的表面 |
| subtle | #f0ede9 | #1e232f | hover、軌道、內嵌欄 |
| line | #e2dfd9 | #292e3a | 分隔線、卡片邊框、圖表格線 |
| line-strong | #c1bdb5 | #424755 | 圖表軸線、強分隔線 |
| line-field | #8f8c84 | #646975 | 輸入框、選單、核取方塊的邊框（≥ 3:1） |
| ink | #161d31 | #f3f0ea | 主要文字 |
| ink-2 | #4c5058 | #c4c0b8 | 次要文字、標籤 |
| ink-3 | #64676f | #9f9b92 | meta、placeholder（在任何表面上都 ≥ 4.8:1） |
| accent | #2d53ca | #7da1f9 | 藍筆：主要動作、焦點、今天 |
| accent-hover | #2345b4 | #96b6ff | |
| accent-ink | #284ab2 | #9fbdff | 連結、強調色文字 |
| accent-soft | #e5edff | #1d2c51 | 目前所在的導覽項目、強調 badge |
| on-accent | #ffffff | #080e21 | accent、danger、success 填色上的文字與圖示 |
| danger／soft | #be222a／#ffebe9 | #f37671／#481b1a | 紅筆：緊急、破壞性操作 |
| success／soft | #1d7339／#e0f7e4 | #65c67d／#16311d | 完成、休息階段 |
| warning／soft | #935a11／#fff0d2 | #eebb58／#3b2b07 | 今天到期、待複習 |
| mark | #f8ef96 | #574e0e | 螢光筆黃：只用於 `::selection` 和搜尋結果 |
| chart-rest | #c1bdb5 | #6c727e | 圖表中的「未完成」等其餘項目 |
| heat-1…4 | #cfdeff #98b7f8 #5f87e7 #2f58c8 | #233459 #345197 #537bd9 #8caffe | 熱度圖（heat-0 = subtle） |
| backdrop | rgb(22 29 49 / .4) | rgb(0 0 0 / .6) | 對話框背景遮罩 |

- **元件只能使用 token。**
  - 不在元件裡寫 raw hex。
  - 每一組新的顏色搭配，都要在淺色和深色兩種模式下檢查對比。
- **瀏覽器表面也要套用主題**：
  - `::selection` 用 mark 底、ink 字。
  - `accent-color` 和 `caret-color` 用 accent。
  - `scrollbar-color` 用 line-strong。
  - `theme-color` meta 用 page。
- **主題色（SUB-4）**：`data-accent` 提供 6 組經過驗證的強調色，每一組都要有淺色與深色版本的 `accent*` 與 `on-accent`。在 `public/theme-init.js` 裡於第一次繪製前套用。
- **Sprint 1 相容規則**：舊的 token 名稱都要保留，可以用別名代替。例如 `--chart-grid`、`--chart-axis`、`--chart-rest`、`--shadow`。

## 3. 科目色

- **儲存**：使用者選的原始 `#rrggbb`。
- **顯示**：一律透過 `subjectTone(hex, dark)`（`src/shared/color.ts`），回傳 `{ mark, tint, ring, onMark }`：
  - 淺色的 mark：OKLCH 的 L 夾在 0.43–0.77，C ≥ 0.10，色相不變。
  - 深色的 mark：
    - 推薦色用既有的 DARK_STEPS。
    - 其他顏色把 L 0.43–0.77 線性對應到 0.55–0.67，C 夾在 0.10–0.16。
  - tint：`color-mix(in oklab, mark 14%（深色 22%）, var(--card))`。
  - ring：mark 35% 疊在透明上。
  - onMark：`#fff` 或 ink，選對比較高的那個。
- **文字永遠不用科目色。** chip 是 ink 色的字配上科目 tint 底色，全部 48 色在淺色下都 ≥ 12.9:1，深色下 ≥ 11.2:1。
- **推薦色**：色盲友善，順序固定，對應的名稱依序是藍、橘、青綠、琥珀、粉紅、綠、靛紫、紅。

  `#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #4a3aa7 #e34948`
- **更多顏色（10 色相 × 4 色調）**：

| 色調 | 紅 | 橘 | 琥珀 | 草綠 | 綠 | 青 | 天藍 | 藍 | 紫 | 桃紅 |
|---|---|---|---|---|---|---|---|---|---|---|
| 亮 | #ff8a82 | #ff8f4b | #e2a500 | #99c336 | #4fce74 | #00cdb4 | #00c3f5 | #86b1ff | #b89eff | #fe7fc0 |
| 明 | #e8605b | #e16c10 | #bb8800 | #7ba200 | #24ae56 | #00aa95 | #00a1cb | #568ef9 | #9b79ee | #db5fa1 |
| 中 | #c43f3e | #b65400 | #966c00 | #628200 | #008c3f | #008777 | #0081a3 | #396ed6 | #7e5acc | #b94082 |
| 深 | #a51e24 | #904100 | #7d5a00 | #4c6500 | #006e30 | #006f4f | #00628c | #1f53b8 | #653eae | #9a2068 |

- **灰色**：保留給「未分類」（#898781）。
- **堆疊圖**：超過 8 個科目時，多的併入「其他」。
- **選色器的提醒**：只提醒、不阻擋。
  - 觸發條件：
    - C < 0.10（太灰）。
    - 和圖表上相鄰的科目太像：ΔE < 15，或色盲模擬下 ΔE < 8。
    - 和任何一個科目 ΔE < 8（幾乎一樣）。
  - 提醒旁附「改用建議色」。
- **驗證**：色盤有改動時，必須用 dataviz skill 的 `validate_palette.js` 驗證淺色與深色兩種模式。

## 4. 字型與排版

- **文字**：`system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', 'Segoe UI', sans-serif`。
- **數字**：`--font-num` 是 `'Archivo Variable'` 加上文字的字型堆疊。
  - 套件：`@fontsource-variable/archivo`，引入 `standard.css`（字重加字寬）。
  - 一律使用 `tabular-nums lining-nums`；計時和倒數加上 `font-stretch: semi-condensed`。
  - 要實際量「1111」和「0000」的寬度是否相同。不同就代表不支援 tnum，改用系統字型。
- **字重**：只用 400、600、700。微軟正黑體會把 500 顯示成 400。
- **字級**：

| 用途 | 大小 / 行高 | 字重 |
|---|---|---|
| num-xl（計時） | clamp(3.5rem, 15vw, 5.5rem) / 1 | |
| num-lg（倒數、統計） | 1.75rem / 1.1 | |
| h1 | 1.5rem / 1.3（手機 1.375rem） | 700 |
| h2 | 1.125rem | 600 |
| h3 | 1rem | 600 |
| body | 1rem / 1.6 | |
| dense | .9375rem | |
| meta | .8125rem | |
| caption | .75rem（最小，不能再小） | |

- **字距**：中文字距為 0，不可為負；32px 以上的數字用 −0.02em。
- **長文**：最寬 38em，行高 1.75。
- **輸入框**：小於 sm 時 16px（避免 iOS 自動放大），sm 以上 15px。
- **meta 的串接**：用「，」或分開的 span。
  - 不用「・」或「 · 」串接。
  - 連結後面不加「→」，改用 ChevronRight 圖示。

## 5. 間距、圓角、層次

- **間距**：以 4px 為單位。
  - 組內 4–12；組與組之間 16–24。
  - 區塊之間：手機 24、桌面 32。
  - 卡片內距：手機 16、桌面 20。
  - 內層間距不超過外層的一半。
- **圓角**：用 `@theme` 定義。

  | 大小 | 用途 |
  |---|---|
  | sm 6 | badge、chip、色票 |
  | md 8 | 分段按鈕的項目 |
  | lg 10 | 按鈕、輸入框 |
  | xl 14 | 卡片 |
  | 2xl 20 | 對話框、bottom sheet |
  | full | 膠囊、圓點 |

  巢狀時，內層圓角 = 外層圓角 − 內距。
- **層次**：邊框表示結構，陰影表示高度（帶 ink 色調、分層）。

  | 陰影 | 淺色 | 深色 |
  |---|---|---|
  | sm（靜止） | `0 1px 0 rgb(22 29 49/.04), 0 1px 2px rgb(22 29 49/.05)` | `0 1px 0 rgb(0 0 0/.35)` |
  | md（浮起） | `0 1px 2px rgb(22 29 49/.06), 0 6px 16px -4px rgb(22 29 49/.12)` | `0 1px 2px rgb(0 0 0/.4), 0 8px 20px -6px rgb(0 0 0/.55), inset 0 1px 0 rgb(255 255 255/.04)` |
  | lg（覆蓋層） | `0 2px 6px rgb(22 29 49/.08), 0 24px 48px -12px rgb(22 29 49/.24)` | `0 2px 8px rgb(0 0 0/.5), 0 28px 56px -12px rgb(0 0 0/.7)` |

## 6. 動效

- **Easing**：
  - 進場用 `--ease-out: cubic-bezier(0.16,1,0.3,1)`。
  - 離場用 `--ease-in: cubic-bezier(0.7,0,0.84,0)`。
  - 滑動的指示塊用 `--ease-in-out: cubic-bezier(0.65,0,0.35,1)`。
- **時長**：

  | 時長 | 用途 |
  |---|---|
  | 120ms | 按壓、hover |
  | 180ms | 切換、核取方塊、分段按鈕 |
  | 240ms | popover、toast |
  | 320ms | bottom sheet／對話框進場（離場 200ms） |
  | 600ms | 唯一刻意設計的時刻：專注完成 |

- **只動畫 transform、opacity、顏色。**
  - 不用 `transition: all`。
  - 不動畫 width、height、top、left。
- **`prefers-reduced-motion`**：
  - 拿掉位移和縮放。
  - 保留 120ms 以內的淡入淡出與顏色變化。

## 7. 元件

**基本元件**
- **Button**：
  - 變體：primary、secondary、ghost、danger、soft，另有尺寸 lg。
  - 高度 h-10，觸控裝置 44px；圓角 lg；15px；primary 與 danger 字重 600。
  - 按下時下沉 1px 並加深填色；loading 時保留文字；只有圖示的按鈕要有 aria-label，觸控目標 44px。
- **Field**：
  - 標籤 14/600 ink-2。
  - 提示 13 ink-3；錯誤 13 danger 加圖示。兩者都用 aria-describedby 連到欄位，錯誤時加 aria-invalid。
  - 輸入框：在卡片上用 page 色內嵌底；邊框 line-field；focus 時邊框變 accent，外加 3px 的 accent/20 光環。
- **Badge**：
  - 高 20px，12px 字，圓角 sm。
  - 狀態一律是圖示加文字；標籤用 outline；錯題、筆記用中性色加圖示。
- **Segmented**：
  - 採 WAI-ARIA radio group：roving tabindex、方向鍵、Home／End。
  - 項目 h-9，觸控裝置 40px。

**版面元件**
- **Card**：
  - 圓角 xl，邊框 line，陰影 sm。
  - 只有可互動的卡片才有 hover 效果。
  - 變體：inset、plain。
  - 卡片裡不放卡片。
- **CardHeader**：h2，可加 meta，動作用文字加 ChevronRight。
- **PageHeader**：h1，下面放即時摘要，或什麼都不放。
- **StatStrip**：
  - 一張卡片，用分隔線分成幾格。
  - 數值用 font-num 28/600。
  - 不做成一排長得一樣的數字卡。
- **EmptyState**：
  - page 版：圖示圓、標題、一句邀請，加上 primary 動作。
  - inline 版：一行文字加 ghost 動作。

**覆蓋層**
- **Dialog**：
  - 用 aria-labelledby 指向標題。
  - 小於 sm 時是 bottom sheet：拖曳把手、safe-area 內距、由下滑入；sm 以上置中。
  - 觸控裝置不自動 focus；加上 `overscroll-behavior: contain`。
  - **關閉後仍然卸載內容**，表單靠這個重設狀態。

**App 專屬元件**
- **SubjectTag**：
  - chip 版：ink 文字、科目 tint 底、1px ring、8px 圓點。
  - compact 版：圓點加名稱。
  - 科目圖示只透過 SubjectTag 顯示。
- **共用小元件**（Sprint 1 由設計師提供）：
  - ProgressBar、ProgressRing
  - Switch、Checkbox
  - Highlight（`<mark>`）
  - Kbd
  - Countdown 數字
  - GoalProgress
  - keyframes

**導覽**
- **側欄**：
  - 用 page 色底，靠空白分組。
  - 目前頁面：accent-soft 底、字重 600、較粗的圖示。
  - 第一個可聚焦元素是「跳到主要內容」連結。
- **手機底部導覽**：
  - 實心底，12px 標籤。
  - 目前頁面在圖示後面加上膠囊底。
  - 計時中，「計時」那格顯示即時進度環。

**頁面元件**
- **計時**：進度環是科目 mark 疊在 tint 軌道上；數字用 font-num；番茄數以圓點顯示；`role="timer"`。
- **月曆**：
  - 結構是 grid → row → gridcell，可用方向鍵移動。
  - 今天：accent 圓底；選取中：內框 ring。
  - chip 用科目 tint 加圖示。
- **圖表**：遵守 dataviz 的規則：
  - 2 個以上的系列要有圖例。
  - 每張圖都有表格檢視。
  - 堆疊段之間留 2px 空隙。
  - 顏色跟著科目走。

## 8. 該做／不要做

**該做**
- 用 token，tint 用 `color-mix`；所有科目色都經過 `subjectTone()`。
- 每個狀態都是圖示加文字；會變動的數字一律用等寬數字。
- 觸控目標 44px；手機輸入框 16px；到處都看得到焦點。
- 動詞開頭的文案：「儲存」「開始專注」「新增第一題錯題」。
- 用即時摘要取代口號式的副標。

**不要做**
- emoji 或符號當圖示；連結後面加「→」；用「・」串接 meta。
- 一排長得一樣的卡片；卡片裡放卡片；超過 1px 的彩色側條；靜態卡片的 hover 浮起。
- 漸層文字、毛玻璃／模糊、裝飾性或零散的動畫、`transition: all`。
- 用科目色當文字色；把紅色用在不緊急的地方；灰色的科目色。
- 用字重 500 做層次；中文負字距；小於 12px 的文字；觸控裝置自動 focus；raw hex。
