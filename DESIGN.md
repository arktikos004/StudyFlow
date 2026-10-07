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

`index.css` 的 `:root, [data-theme='light']` 和 `[data-theme='dark']` 定義 tokens，再透過 `@theme inline` 提供給 Tailwind 使用（`bg-page`、`text-ink-2`、`border-line-field`、`bg-heat-3`、`bg-backdrop`…，表格裡每個 token 都有對應的 `--color-*`）。

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
| heat-1…4 | accent 以 24／45／70／100% 混入 card | accent 以 10／40／72% 混入 accent-soft；heat-4 = accent 與 accent-ink 各半 | 熱度圖（heat-0 = subtle），跟著主題色；藍筆時為淺 #c7d5f2 #9ab2e9 #6689dc #2d53ca、深 #263660 #415890 #607ec7 #8eaffc |
| backdrop | rgb(22 29 49 / .4) | rgb(0 0 0 / .6) | 對話框背景遮罩 |
| scrim／on-scrim | rgb(12 15 24 / .9)／#f3f0ea | rgb(0 0 0 / .85)／#f3f0ea | 深色遮罩（Sprint 3）：照片燈箱這類「看內容」的覆蓋層，淺色模式也要夠暗（`backdrop:bg-scrim`）；on-scrim 是遮罩上的文字與圖示。取代 raw 的 `black` |
| logo-tile／logo-ink | accent／card | ink／accent-soft | 品牌標誌的底與 S（Sprint 2）：淺色是主題色的底、紙色的 S；深色反過來是紙色的底、深色主題色的 S。跟著主題色 |
| logo-mark | #ffd84a | #ffcf33 | 品牌標誌的螢光筆黃，**只用在標誌裡**（介面的螢光筆仍是 mark） |

- **元件只能使用 token。**
  - 不在元件裡寫 raw hex。
  - 每一組新的顏色搭配，都要在淺色和深色兩種模式下檢查對比。
- **瀏覽器表面也要套用主題**：
  - `::selection` 用 mark 底、ink 字。
  - `accent-color` 和 `caret-color` 用 accent。
  - `scrollbar-color` 用 line-strong。
  - `theme-color` meta 用 page。
- **主題色（SUB-4）**：`<html data-accent>` 提供 6 組經過驗證的強調色，每一組都有淺色與深色版本的 `accent`、`accent-hover`、`accent-ink`、`accent-soft`、`on-accent`。
  - 選擇存在 localStorage 的 `studyflow:accent`，`public/theme-init.js` 在第一次繪製前套用（同時套用 `data-theme` 與 `theme-color`），不會閃爍。
  - 程式介面在 `lib/theme.ts`：`ACCENTS`（id、zh-TW 名稱、`preview.light／dark`）、`AccentId`、`useAccent()`、`setAccent(id)`。新增色組時 `theme-init.js` 的清單要同步。
  - heat-*、圖表的 accent 系列、計時環、焦點框都直接用 accent token，換色組時一起變。

  | id | 名稱 | 淺色 accent／hover／ink／soft／on | 深色 accent／hover／ink／soft／on |
  |---|---|---|---|
  | blue（預設） | 藍筆 | #2d53ca #2345b4 #284ab2 #e5edff #ffffff | #7da1f9 #96b6ff #9fbdff #1d2c51 #080e21 |
  | lake | 湖水青 | #006c82 #005d70 #005d71 #d8f2fa #ffffff | #38afcc #64c0d9 #78c7dd #003440 #001218 |
  | green | 墨綠 | #00614f #005242 #005847 #d8f4eb #ffffff | #51ad95 #72bda8 #87c9b5 #08362c #01140e |
  | grape | 葡萄紫 | #7e46bd #6e3aa9 #6c39a4 #f0e8ff #ffffff | #b48feb #c5a5f5 #caaef5 #35244b #130a1e |
  | berry | 莓果 | #a8328a #952679 #912776 #fce5f3 #ffffff | #db84bf #e89ccf #eaa6d3 #431f38 #1a0815 |
  | graphite | 鉛筆 | #5a616e #4d545f #4e5560 #eaedf2 #ffffff | #9ba2ad #afb4be #b5bbc3 #2a2e35 #0b0f17 |

  - **對比（實際計算，WCAG）**，6 組中的最低值：

    | 組合 | 淺色 | 深色 | 門檻 |
    |---|---|---|---|
    | on-accent／accent | 6.00（葡萄紫） | 7.01（墨綠） | 4.5 |
    | on-accent／accent-hover | 7.39 | 8.63 | 4.5 |
    | on-accent／按下（accent 混 12% 黑） | 7.76 | 5.04 | 4.5 |
    | on-accent／danger、success 填色 | 6.08、5.89 | 6.90、8.96 | 4.5 |
    | accent-ink／card、page、subtle | 7.30、6.93、6.42 | 9.08、9.90、8.13 | 4.5 |
    | accent-ink／accent-soft（badge、導覽） | 6.40 | 7.02 | 4.5 |
    | accent／page、card（焦點框） | 5.55、5.86 | 7.07、6.49 | 3 |
    | accent／accent-soft（進度條填色與軌道） | 5.06 | 4.93 | 3 |
    | heat-4／card | 5.86 | 7.77 | 3 |

  - **Sprint 2 新增的組合（s2/shell，實際計算，6 組主題色中的最低值）**：

    | 組合 | 淺色 | 深色 | 門檻 |
    |---|---|---|---|
    | 導覽標籤（桌面）：danger／danger-soft、warning／warning-soft | 5.31、5.02 | 5.28、7.74 | 4.5 |
    | 導覽標籤（手機實心）：on-accent／danger、on-accent／warning | 6.08、5.66 | 6.90、10.73 | 4.5 |
    | 手機實心標籤的外形：danger、warning 對 card | 5.93、5.52 | 6.39、9.93 | 3 |
    | 指令面板目前選項：ink、ink-2、ink-3、accent-ink 對 accent-soft | 14.07、6.80、4.75、6.40 | 11.73、7.35、4.81、7.02 | 4.5 |
    | 指令面板：ink／mark（關鍵字標示）、ink-3／subtle | 14.17、4.85 | 7.38、5.67 | 4.5 |
    | 成就徽章（已解鎖）：on-accent／accent；徽章對 card | 6.00、5.86 | 7.01、6.49 | 4.5、3 |
    | 成就徽章（未解鎖）：ink-3 圖示／card、line-field 虛線框／card | 5.52、3.28 | 6.33、3.19 | 3 |
    | 已解鎖 badge：success／success-soft | 5.22 | 6.66 | 4.5 |
    | 標誌：S／底（on-accent≈card／accent；深色 accent-soft／ink） | 6.00 | 11.73 | 3 |
    | 標誌的底對 page | 5.55 | 16.83 | 3 |
    | 焦點框：accent 對 accent-soft、subtle | 5.06、5.14 | 4.93、5.81 | 3 |

  - **Sprint 3 新增的組合（s3/design，實際計算；主題色取 6 組中的最低值）**：

    | 組合 | 淺色 | 深色 | 門檻 |
    |---|---|---|---|
    | on-scrim／scrim（疊在 page；疊在 card） | 13.27；13.13 | 18.23；18.04 | 4.5 |
    | 燈箱的關閉鈕（card 底）對 scrim | 14.72 | 1.18（靠 ink 圖示 15.43 與 line 邊框辨識） | 3 |
    | SectionLabel：danger、warning、success 對 page | 5.63、5.23、5.45 | 6.96、10.83、9.05 | 4.5 |
    | SectionLabel：ink-2、ink-3（數量）對 page | 7.48、5.23 | 10.55、6.91 | 4.5 |
    | 倒數磚：ink、ink-2、ink-3 對 subtle | 14.35、6.93、4.85 | 13.81、8.66、5.67 | 4.5 |
    | 倒數磚：danger／danger-soft、warning／warning-soft | 5.31、5.02 | 5.28、7.74 | 4.5 |
    | ToggleButton 按下：accent-ink 對 accent-soft；hover 時；按住時 | 6.40、5.58、4.96 | 7.02、6.04、5.31 | 4.5 |
    | ToggleButton 圖示版未按下：ink-3 對 card、page | 5.52、5.23 | 6.33、6.91 | 3 |
    | MiniIconButton：ink 圖示對「card 90% 疊在全黑／全白照片」 | 13.05／16.34 | 15.77／11.60 | 3 |
    | MiniIconButton、StretchedButton 的焦點框：accent 對 card、page | 5.86、5.55 | 6.49、7.07 | 3 |
    | ErrorNote 的「重新載入」：ink 對 card；焦點框 accent 對 danger-soft | 16.33；5.23 | 15.43；5.36 | 4.5；3 |
    | SearchInput 的放大鏡與清除鈕：ink-3 對 page | 5.23 | 6.91 | 3 |

    - ToggleButton 忙碌中（opacity .7）的文字只有 3.33（淺色葡萄紫）：它是 `aria-disabled` 的暫時狀態（儲存的幾百毫秒），WCAG 不要求停用中的元件達到對比。
    - ErrorNote 的按鈕是 secondary（card 底、line-strong 框），對 danger-soft 底只有 1.1–1.6：按鈕靠文字「重新載入」辨識，邊框不是辨識的必要條件（同其他 secondary 按鈕）。
  - **Sprint 4 新增的組合（s4/profile-ui，PRO-1；從 index.css 讀出 token 實際計算，主題色取 6 組中的最低值，括號是最低的那一組）**：

    | 組合 | 淺色 | 深色 | 門檻 |
    |---|---|---|---|
    | Avatar 首字：on-accent／accent | 6.00（葡萄紫） | 7.01（墨綠） | 4.5 |
    | Avatar 圓（主題色）對 card、page、subtle（hover） | 5.86、5.55、5.14 | 6.49、7.07、5.81 | 3 |
    | 個人檔案的徽章：on-accent 圖示／accent；徽章對 card、對 subtle（hover） | 6.00；5.86、5.14 | 7.01；6.49、5.81 | 3 |
    | 成就格的焦點框：accent 對 card、subtle（hover 中） | 5.86、5.14 | 6.49、5.81 | 3 |
    | 「開始第一次專注」：accent-ink 對 card | 7.30（湖水青） | 9.08（鉛筆） | 4.5 |
    | 暱稱 ink、Email ink-2、加入時間與副標 ink-3 對 card | 16.33、7.89、5.52 | 15.43、9.68、6.33 | 4.5 |
    | 「+N」：ink-2 對 card | 7.89 | 9.68 | 4.5 |
    | 成就格 hover：ink-2 標籤、ink 數值、ink-3（／12、徽章文字、箭頭）對 subtle | 6.93、14.35、4.85 | 8.66、13.81、5.67 | 4.5 |
    | 側欄帳號列：ink 暱稱、ink-3 Email 對 page；hover 時 ink-3 對 subtle | 15.48、5.23；4.85 | 16.83、6.91；5.67 | 4.5 |
    | 登出：ink-2 對 page（側欄）、card（手機選單） | 7.48、7.89 | 10.55、9.68 | 4.5 |
    | 照片處理失敗：danger 對 card | 5.93 | 6.39 | 4.5 |

    - 照片的邊緣是 ink 10% 的 1px 細線（`outline-ink/10`，疊在照片上），只是讓白底照片在紙色上有邊，不承擔辨識（照片旁邊一定有暱稱）。
    - 骨架（載入中的 subtle 方塊）對 card 只有約 1.1：它是暫時的裝飾，`aria-busy` 與 sr-only「載入中」負責告知狀態。
  - **語意撞色（OKLab ΔE×100）**：莓果和 danger 14.2／11.0；墨綠和 success 7.7／9.2（計時環的專注與休息階段靠文字標籤區分）。
  - **不收錄琥珀橘**：和 warning（ΔE 4.7）、danger（ΔE 8.6）幾乎同色，主要按鈕與「今天到期」會分不出來，所以改收錄中性的「鉛筆」。紅、橘、黃系一律不做主題色。
- **局部預覽**：任何元素都可以加 `data-theme="light|dark"` 或 `data-accent="…"`，只影響該區塊的 tokens（例如設定頁的深淺色對照、色組色票）。
  - 權重：只給 `data-accent`（0,1,0）< 祖先組合（0,2,0）< 同一個元素同時給兩者（0,3,0），所以預覽時盡量把兩個屬性放在同一個元素上。
  - Tailwind 的 `dark:` 變體仍以 `<html>` 為準；局部預覽請用 tokens，不要用 `dark:`。
  - heat-* 只在有 `data-theme` 的元素上重新計算；只加 `data-accent` 的色票不會改變熱度圖色階。
- **Sprint 1 相容規則**：舊的 token 名稱都要保留，可以用別名代替。
  - `--chart-grid` = line、`--chart-axis` = line-strong、`--chart-rest` 保留原值、`--shadow` = `--elevation-sm`、工具類 `shadow-card` = `shadow-sm`。

## 3. 科目色

- **儲存**：使用者選的原始 `#rrggbb`。
- **顯示**：一律透過 `subjectTone(hex, dark)`（`src/shared/color.ts`），回傳 `{ mark, tint, ring, onMark }`：
  - 淺色的 mark：OKLCH 的 L 夾在 0.43–0.77，C ≥ 0.10，色相不變。
  - 深色的 mark：
    - 推薦色用既有的 DARK_STEPS。
    - 其他顏色把 L 0.43–0.77 線性對應到 0.55–0.67，C 夾在 0.10–0.16。
  - tint：`color-mix(in oklab, mark 14%（深色 22%）, var(--card))`。
  - ring：mark 35% 疊在透明上。
  - onMark：`#fff` 或深色文字，選對比較高的那個；深色模式的深色文字用 `#0c0f18`（深色的 page 色）。
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
      - 色盲只判定 protan 與 deutan；tritan 只計算、不列入判定，和 dataviz 驗證器的判定方式一致（推薦色的琥珀↔粉紅在 tritan 下只有 5.8）。
    - 和任何一個科目幾乎一樣：淺色 ΔE < 8，或兩色的**深色 mark** ΔE < 5（深色也要判定）。
  - 推薦色彼此之間不提醒「幾乎一樣」（它們是驗證過的一組）；但兩個科目用了同一個推薦色時仍然提醒。
  - 提醒旁附「改用建議色」；建議色必須在淺色與深色兩種模式下都通過以上檢查。
- **色格排版**：
  - 精確指標（滑鼠）且容器夠寬（≥ 22.25rem）：10 × 4 一整塊，格子 **32–44px**，隨容器寬度縮放（`clamp(2rem, (100cqw − 2.25rem) / 10, 2.75rem)`）。
  - 觸控裝置或窄容器：兩塊 5 × 4，每格 44px。
- **驗證**：色盤有改動時，必須用 dataviz skill 的 `validate_palette.js` 驗證淺色與深色兩種模式。
- **DARK_BAND 評估（Sprint 3，結論：維持 0.55–0.67）**。設計審查建議放寬到 0.52–0.72（或折衷 0.54–0.70），讓同色相的 4 個色調在深色更好分辨。用 dataviz 的 `validate_palette.js`（深色、surface 是 card #151924）與 `subjectTone` 實際重算 48 色的深色 mark：

  | DARK_BAND | 驗證器的深色色帶（L 0.48–0.67） | mark 對 card 最低 | onMark／mark 最低（< 4.5 的色數） | 同色相相鄰色調 ΔE：最小／平均（< 5 的對數） | 亮↔深 ΔE 平均 | 深色「幾乎一樣」的配對 | 40 色中彼此 ΔE ≥ 5 的色數 |
  |---|---|---|---|---|---|---|---|
  | **0.55–0.67（現行）** | 通過 | 3.52 | 4.39（8／48） | 2.9／3.7（29／30） | 10.6 | 46 | 21 |
  | 0.52–0.72（建議） | **不通過**：「亮」列 10 色 L 0.713–0.715 | 3.22 | 4.39（2／48） | 4.1／5.8（1／30） | 17.2 | 13 | 38 |
  | 0.54–0.70（折衷） | **不通過**：「亮」列 10 色 L 0.694–0.696 | 3.43 | 4.39（3／48） | 3.4／4.7（25／30） | 13.9 | 41 | 22 |
  | 0.51–0.67（色帶內放寬到底） | 通過 | 3.01 | 4.43（2／48） | 3.2／4.7（26／30） | 13.9 | 36 | 24 |
  | 0.48–0.67 | 通過 | **2.70**（5 色 < 3:1） | 4.46（2／48） | 2.3／5.5（5／30） | 16.3 | 16 | 34 |

  - 共同的數字：推薦 8 色在深色用 DARK_STEPS，不受色帶影響，驗證器淺色（surface #fdfcfa）與深色都 PASS（CVD 最差 9.1／8.4、一般視覺最差 19.6／19.3）；最亮端（琥珀 #c98500，L 0.670）的 onMark 是 6.23；chip 的 ink／tint 在所有候選下都 ≥ 10.8。
  - 「更多顏色」每一列（10 色相並排）在淺色與深色、任何色帶下都過不了驗證器的相鄰檢查（例如紫↔藍 deutan ΔE 0.2–0.4）：色格是選色器，不是固定順序的圖表色盤，所以由選色器的提醒負責，和色帶無關。
  - 不採用建議值的原因：上緣超過 0.67 就離開 dataviz 的深色色帶（深色表面上太亮的 mark 會比文字還搶眼）；上緣固定 0.67 時，下緣最多只能放到約 0.51（再低 mark 對 card 就低於 3:1），同色相相鄰色調的 ΔE 平均只從 3.7 變成 4.7，30 對裡仍有 26 對低於「幾乎一樣」的 5，改善有限。
  - 真的要讓深色的 4 個色調分得開，需要改深色的換算方式（例如色調之間固定 ΔL，或「深」色調改降 chroma），不是調整線性色帶的端點；這屬於 `src/shared/color.ts`，留給之後負責色彩的 lane。
  - 「幾乎一樣」的提醒維持深色 ΔE < 5：在現行色帶下會把同色相相鄰色調標成「深色模式下幾乎一樣」，這正是要提醒的事。

## 4. 字型與排版

- **文字**：`system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', 'Segoe UI', sans-serif`。
- **數字**：`--font-num` 是 `'Archivo Variable'` 加上文字的字型堆疊（中文等其他字元落回文字字型）。工具類是 `font-num`。
  - 套件：`@fontsource-variable/archivo`，在 `main.tsx` 引入 `standard.css`（字重 100–900、字寬 62–125%）。自架，符合 CSP `font-src 'self'`；workbox 也快取 woff2。
  - 一律使用 `tabular-nums lining-nums`；計時和倒數加上 `font-stretch: semi-condensed`。
  - **tnum 實測結論（Sprint 1）：支援。** fontTools 讀 GSUB 有 `tnum`（`.tf` 字形，所有數字等寬）；Chrome 實測 `tabular-nums` 時「1111」和「0000」在字重 400／600／700、字寬 100%／87.5% 下都等寬（例如 600／100% 都是 92.64px@40px），不加 tnum 時不等寬（400：83.42 vs 91.64）。
  - 圖表軸線的數字由 `index.css` 統一套用數字字型與等寬數字，不必逐一設定。
- **字重**：只用 400、600、700。微軟正黑體會把 500 顯示成 400。
- **字級**：

| 用途 | 大小 / 行高 | 字重 | 工具類 |
|---|---|---|---|
| num-xl（計時） | clamp(3.5rem, 15vw, 5.5rem) / 1 | 600 | `text-num-xl` |
| num-lg（倒數、統計） | 1.75rem / 1.1 | 600 | `text-num-lg` |
| h1 | 1.5rem / 1.3（手機 1.375rem） | 700 | `text-h1` |
| h2 | 1.125rem / 1.4 | 600 | `text-h2` |
| h3 | 1rem / 1.5 | 600 | `text-h3` |
| body | 1rem / 1.6 | | `text-base` |
| dense | .9375rem / 1.55 | | `text-dense` |
| meta | .8125rem / 1.5 | | `text-meta` |
| caption | .75rem / 1.5（最小，不能再小） | | `text-caption`（= `text-xs`） |

- **字距**：中文字距為 0，不可為負；32px 以上的數字用 −0.02em。
- **長文**：最寬 38em，行高 1.75。
- **輸入框**：小於 sm 時 16px（避免 iOS 自動放大），sm 以上 15px。
- **meta 的串接**：用「，」或分開的 span。
  - 不用「・」或「 · 」串接。
  - 連結後面不加「→」，改用 ChevronRight 圖示。

## 5. 間距、圓角、層次

- **間距**：以 4px 為單位。
  - 組內 4–12；組與組之間 16–24。
  - 區塊之間：手機 24、桌面 32。用 `--section-gap`（Sprint 3）：直向堆疊用 `PageStack`，格線用 `gap-section`，頁首用 `PageHeader`（自帶 `mb-section`）。
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
  - 原始值是 `--elevation-sm／md／lg`，工具類是 `shadow-sm／md／lg`；`shadow-card` 是 `shadow-sm` 的別名。
  - 深色模式靠較亮的表面表示高度（例如 Segmented 選中的項目用 line 色底）。

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
  | 320ms | bottom sheet／對話框進場（離場不做動畫：立即關閉，內容同時卸載） |
  | 600ms | 唯一刻意設計的時刻：專注完成 |

  時長也有 token：`--dur-press` 120、`--dur-toggle` 180、`--dur-pop` 240、`--dur-sheet` 320、`--dur-moment` 600；Tailwind 直接寫 `duration-120`、`duration-180`。
- **動畫工具類**：`animate-fade-in`（120ms）、`animate-pop-in`（240ms，popover）、`animate-complete`（600ms，只給「專注完成」用）。
- **對話框**：只有進場動畫（`@starting-style`＋`transition-behavior: allow-discrete`）：手機由下滑入、sm 以上輕微放大淡入；關閉時立即消失，因為內容同時卸載。
- **Sprint 2 的殼層動效（s2/shell）**：都只表達狀態，不做裝飾。
  - 指令面板：240ms，從上方落下 0.5rem 並放大淡入（`.sf-palette`）；關閉立即消失、內容卸載。
  - 手機底部導覽：目前頁面的膠囊底由中間展開（`.sf-tab-pill::before`，scaleX 0.5 → 1、180ms），圖示不跟著縮放；文字顏色同步 180ms。
  - 導覽數量標籤：出現與數字改變時播一次 `animate-pop-in`（完成一項、數字減一時看得到）。
  - toast（sonner）：套件自己的進場；sonner 在 reduced motion 時會關掉所有 toast 動畫。
  - reduced motion：指令面板改成 120ms 淡入、膠囊底只淡入不縮放、標籤只淡入。
- **只動畫 transform、opacity、顏色。**
  - 不用 `transition: all`。
  - 不動畫 width、height、top、left；進度條用 translateX，不動畫寬度。
- **`prefers-reduced-motion`**：
  - 拿掉位移和縮放（按下的 1px 下沉、Switch 滑動、對話框滑入都拿掉）。
  - 保留 120ms 以內的淡入淡出與顏色變化；`animate-pop-in`／`animate-complete` 自動改成只淡入。

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
  - 版型：stacked（預設，標籤在上）；inline（Sprint 2）標籤與提示在左、欄位在右，用在設定列、短數字欄位。
- **Badge**：
  - 高 20px，12px 字，圓角 sm。
  - 狀態一律是圖示加文字；標籤用 outline；錯題、筆記用中性色加圖示。
- **Segmented**：
  - 採 WAI-ARIA radio group：roving tabindex、方向鍵、Home／End。
  - 項目 h-9，觸控裝置 40px。
- **Avatar**（Sprint 4，PRO-1）：
  - 圓形。有照片時顯示照片（`object-cover`，邊緣 ink 10% 的 1px 細線）；沒有照片、或照片載入失敗（例如離線）時，顯示暱稱的第一個字素（`firstGrapheme`，emoji、組合字不切半；拉丁字母轉大寫），accent 底、on-accent 字，跟著主題色。載入失敗後，連回網路（`online` 事件）時會再試一次，側欄的頭像不會一直停在首字。
  - 照片載入中是 subtle 底，不先閃一下首字；失敗才換成首字，src 換了會重新載入。
  - 尺寸：sm 32（側欄）、md 40（手機選單）、lg 72（個人檔案）、xl 96（編輯對話框的預覽）。首字 600。
  - 無障礙：旁邊已經有暱稱文字時是裝飾（`aria-hidden`、`alt=""`）；單獨出現時給 `label`（`role="img"`）。
  - 不可當成按鈕或連結的唯一內容；要可以點時，整列（頭像＋暱稱）一起當連結。

**版面元件**
- **Card**：
  - 圓角 xl，邊框 line，陰影 sm。
  - 只有可互動的卡片才有 hover 效果。
  - 變體：inset、plain。
  - 卡片裡不放卡片。
- **CardHeader**：h2，可加 meta，動作用文字加 ChevronRight。圖示直接傳 lucide 元件（18px、ink-3 由元件決定）。
- **PageHeader**：h1，下面放即時摘要，或什麼都不放；上方可以放 eyebrow（日期這類小字）。下方間距是區塊間距（手機 24、桌面 32）。
- **SectionLabel**（Sprint 3）：卡片外的分組標題、卡片內的欄位小標。13px（或 14px）／600／ink-2，圖示 16px；有語氣時圖示和文字一起變成 danger／warning／success，仍然是圖示加文字。
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
- **確認對話框（useConfirm）的焦點規則**（Sprint 2）：
  - `tone: 'danger'`（預設）：刪除、放棄等破壞性操作。確認鈕是 danger，**預設焦點在「取消」**，連按 Enter 不會誤刪。
  - `tone: 'primary'`：非破壞性、可以復原的確認（例如「要一併完成任務嗎？」）。確認鈕是 primary，**預設焦點在確認鈕**，Enter 直接確認。
  - 兩者在觸控裝置都不自動 focus（同 Dialog）。確認鈕文字寫出動作（「刪除」「完成任務」），不要寫「確定」，除非真的沒有更具體的動詞。
- **指令面板（CommandPalette）**（Sprint 2，APP-1）：
  - 開啟：任何頁面按 Ctrl+K（macOS ⌘K；macOS 的 Ctrl+K 在輸入欄位裡保留給「刪到行尾」）；桌面側欄 Logo 下方的「搜尋」鈕、手機頁首的搜尋圖示鈕。其他對話框開著時不開，避免離開頁面遺失表單。
  - 外觀：上方錨定（桌面距頂 12dvh、寬 36rem；手機貼齊上緣、左右 8px），card 底、圓角 2xl、陰影 lg；輸入列 56px，focus 時下緣線變 accent；目前選項是 accent-soft 底，圖示方塊轉成 card 底 accent-ink；關鍵字用 `<mark>`。
  - 無障礙：WAI-ARIA combobox（input `role="combobox"`、`aria-expanded`、`aria-controls`、`aria-activedescendant`、`aria-autocomplete="list"`），listbox 內 `role="group"`＋`aria-labelledby` 分組；焦點一直在輸入框。上下鍵循環、Enter 開啟、Esc 關閉；注音選字中（isComposing）不攔截上下鍵、Enter、Esc。結果數以 `role="status"` 報讀。
  - 內容：空白時「快捷動作」（開始專注／計時中改成回到計時、新增任務、新增錯題、新增科目）與「前往」各頁；有輸入時先列本機比對到的動作與頁面，再列任務、考試與截止日、筆記與錯題、科目，每組最多 5 筆。搜尋防抖 160ms。
  - 焦點：沒有選項就關閉時還給打開前的元素；選了項目就移到新頁面的 `#main-content`（目標頁用 `?open=` 開對話框時，對話框會接手焦點）。
  - 指令面板是「觸控裝置不自動 focus」的例外：使用者明確按了搜尋，輸入框直接聚焦。
  - 載入失敗（部署新版後的舊分頁、網路中斷）：錯誤邊界只關閉面板並 toast「搜尋載入失敗…」，Layout 不受影響；下次打開會重新下載（加上 `?retry=N` 繞過瀏覽器對失敗模組的快取）。
  - 輸入中、結果還沒更新時，上一個關鍵字的後端結果淡化並 `aria-disabled`，不能選，也不標示新關鍵字；本機的動作與頁面照常可選。

**App 專屬元件**
- **SubjectTag**（`components/subjects.tsx`）：
  - chip 版（`SubjectChip`）：22px 高、ink 文字、科目 tint 底、1px ring（科目 mark 35%）、8px 圓點，有科目圖示時接在圓點後面（12px）；名稱太長時截斷並附 `title`。
  - compact 版：8px 圓點＋圖示＋名稱（12px ink-2），用在空間很擠的地方。
  - `asLink`：連到 `/subjects/:id`，名稱後加 sr-only「的科目總覽」；觸控裝置用 `::after` 把點擊範圍上下延伸到 44px。已經在按鈕或連結裡時不要加。
  - icon 版（`SubjectIconTile`，單科總覽頁的標題方塊）：40px、圓角 lg、科目 mark 底、onMark 圖示（20px），**純裝飾**（aria-hidden、沒有 `title`），旁邊一定要有可見的科目名稱；不可放進按鈕或連結當唯一內容。
    - 沒有科目圖示時顯示名稱的第一個字：**19px 粗體**（WCAG 的大字，門檻 3:1），以字素切（`Intl.Segmenter`，`lib/format.ts` 的 `firstGrapheme`），emoji、組合字不會被切半。
    - 對比（`test/subject-tile-contrast.spec.ts` 實際計算）：onMark／mark 在 48 色中最低 4.24（淺色）／4.39（深色），6／48 與 8／48 低於 4.5:1，但以大字的 3:1 計算全部通過；「未分類」的灰色與任意自訂色（抽樣 4000 色）也都 ≥ 3:1。圖示是圖形（≥ 3:1），同樣全部通過。
  - 科目圖示只透過 `components/subjects.tsx` 的元件顯示。
- **成就（Achievements 頁）**（Sprint 2，APP-2）：
  - 徽章：已解鎖是藍筆塗滿（accent 底、on-accent 圖示、外圈 4px accent-soft 像蓋章）＋ success 的「已解鎖」badge；未解鎖是 1.5px line-field 虛線框、ink-3 圖示（還沒描上墨的鉛筆稿）＋進度條與「3／25 個」。狀態都有文字，不只靠顏色。
  - 解鎖日期（Sprint 5，PRO-2）：已解鎖的在 badge 旁邊加上日期（`<time>`，13px ink-3 等寬數字，依 `user.timezone`；「10 月 7 日」，不是今年時加上年份，`unlockedDate`）。sm 以上在右欄、badge 下面靠右；手機接在 badge 右邊，不多佔一行。開始記錄解鎖時間之前就解鎖的沒有日期（`unlockedAt` 為 null）。
  - 這頁的焦點是「下一個目標」：最接近解鎖的成就、還差多少、一個前往的動作。其餘依讀書時數／連續天數／番茄鐘／錯題與任務分組，每組一張卡片、列之間用分隔線（不做一排一樣的卡片）。
  - 圖示：後端回傳 lucide 名稱，前端用白名單（`lib/achievement-icons.ts` 的 `AchievementIcon`）對應，不動態 import 整包。
  - 新解鎖的 toast 由 Layout 全站跳一次：「解鎖成就「名稱」」＋說明＋「查看」動作；同時解鎖多個時合併成一則。
- **個人檔案（設定頁最上面，Sprint 4，PRO-1）**（`components/settings/ProfileSection.tsx`；外觀在 `ProfileHeader`、`ProfileStats`）：
  - 整頁寬的一張卡片，放在設定頁兩欄卡片的上方（`PageStack` 的第一個區塊）。上半是身分：Avatar lg、暱稱（h2，1.25rem／1.4／700，前面有 sr-only「個人檔案：」）、Email（14px ink-2）、加入時間（13px ink-3，「2026 年 9 月加入」，依 `user.timezone`，`<time dateTime="2026-09">`）。
    - 暱稱的字級比卡片標題（h2 18／600）大一階、比頁面 h1（24）小，只用在這裡。
    - Email 只在「@」與「.」前面換行（`<wbr>`），長的學校信箱不會從單字中間斷開。
  - 「編輯個人資料」是 secondary（Pencil 圖示）：設定頁只有一個 primary，對話框裡的「儲存」才是 primary。手機撐滿寬度、放在身分下面；sm 以上靠右。
  - 下半是累積數字：同一張卡片裡用分隔線分格（卡片裡不放卡片，做法同 StatStrip），手機 2×2、lg 以上一列 4 格。每格是 dt（16px 圖示＋14px ink-2 標籤）、dd 數值（font-num 28／600，單位用 `Unit`）、dd 副標（13px ink-3）。
    - 學習累積（Hourglass）：未滿 1 小時用分鐘，之後用小時、無條件捨去到一位小數（和成就頁的進度一致），100 小時以上取整數；副標「共 32 次學習」。
    - 連續天數（Flame）：副標「最長 12 天」；目前就是最長紀錄時寫「目前就是最長紀錄」；都是 0 時寫「今天讀書就能開始累積」。
    - 完成量（ListChecks）：完成的任務數；副標「已掌握 7 題錯題」。
    - 成就（Trophy）：「5／12 個」（念成「已解鎖 5 個，共 12 個」）＋已解鎖的徽章（成就頁的章縮成 28px：accent 底、on-accent 圖示、外圈 2px accent-soft）。一列放不下時最後一格是「+N」（card 底、line-strong 細框），放得下幾個由實際寬度決定（`badgeCapacity`）。徽章依解鎖時間排列，最近解鎖的在前（Sprint 5，PRO-2），「+N」收起的是最舊的；開始記錄解鎖時間之前就解鎖的排在最後、依成就的固定順序。清單的 `aria-label` 是「已解鎖的徽章，最近解鎖的在前」。
    - 成就那一格整格連到 `/achievements`：標籤是連結，`::after` 蓋滿這一格（hover 時 subtle 底），右上角 ChevronRight；焦點框畫在 `::after`、內縮 2px，右下角跟著卡片的內圓角（這一格在 2×2 與一列 4 格時都在卡片右下角）。徽章名稱給螢幕報讀器（sr-only），看得到的人點進成就頁看名稱。
  - 新帳號（還沒有學習紀錄）：數字都是 0，「學習累積」的副標換成下一步「開始第一次專注」（`MoreLink` 到 `/timer`，accent-ink，不用 primary）；成就格寫「還沒有解鎖的徽章」。版面和有資料時一樣高。
  - 載入中：格子與標籤照常，數值與副標換成 subtle 骨架（同高，載入完不跳動），`aria-busy`。載入失敗：數字那半換成 `ErrorNote`（可以重新載入），頭像與暱稱照常；已經有數字時，背景重新整理失敗就繼續顯示舊的。
- **編輯個人資料對話框**（`ProfileDialog`、`ProfilePhotoField`）：
  - 只放照片與暱稱；時區是設定，在「帳號與安全」卡。
  - 照片：96px 預覽、「上傳照片／更換照片」（secondary sm，ImageUp）、「移除照片」（ghost sm，Trash2，有照片時才出現）。選檔用隱藏的 `<input type="file" accept="image/jpeg,image/png,image/webp">`。
    - 選了照片就在瀏覽器裡置中裁成正方形、縮到最大 512×512、轉 JPEG（透明的地方鋪白、依 EXIF 轉正，`lib/profile-image.ts`），處理中按鈕轉圈；儲存時才真的上傳。
    - 轉好的 JPEG 超過後端上限（`AVATAR_MAX_BYTES`，1MB）時先降低品質重試，仍太大就在選照片時提示「照片太大（上限 1MB），請換一張照片」，不送出（不等後端回 413）。選檔的格式清單用共用的 `AVATAR_TYPES`。
    - 預覽跟著變更走：新選的照片、移除後的首字（首字跟著輸入中的暱稱）。下方說明用 `aria-live` 念出狀態：「JPEG、PNG 或 WebP，會置中裁成正方形」「新照片會在儲存後套用」「儲存後會移除照片，改用暱稱的第一個字」。照片讀不出來時是 danger 文字＋圖示（`role="alert"`）。
  - 暱稱：`Field`＋`Input`（`autoComplete="nickname"`、最多 30 字），空白或太長在送出前檢查，錯誤在欄位旁、焦點回到欄位。
  - 儲存：先處理照片（上傳或移除），成功才存暱稱。成功只提示一次：整輪存好時由對話框跳 toast（`saveSuccessMessage`：有改暱稱是「已更新個人資料」，只改照片是「已更新照片」或「已移除照片」）；頭像的 hook 不提示成功。失敗時除了 hook 的 toast，對話框裡也有一行 `role="alert"` 的訊息（對話框是 modal，toast 在對話框外面，螢幕報讀器不一定念得到）：照片失敗時什麼都沒存、對話框留著（新選的照片與輸入的暱稱都還在）；照片成功但暱稱失敗時，訊息會說明照片已經換好，再按「儲存」只會存暱稱。沒有變更時「儲存」停用。
  - 儲存途中關掉對話框（取消、Esc、點背景、手機往下拖）就中止這一輪：進行中的請求會真的被取消（`AbortController`，`lib/api.ts` 的 `signal`；中止的請求不跳錯誤訊息），後面的步驟不再執行，重新打開也不會卡在儲存中。請求在取消之前就完成的部分照實提示（例如照片已經換好時跳「已更新照片」），hook 也會重新取得使用者，畫面以伺服器為準。流程是 `lib/profile-save.ts` 的純函式 `saveProfile`，每個等待結束後都確認「這一輪還算數」（`isCurrent`）。
  - 離線時不送出：直接 toast「目前離線，連上網路後再儲存」。TanStack Query 離線時會把 mutation 暫停、連線後才補送，不擋的話按鈕會一直轉圈，連回網路後還會補存使用者已經放棄的變更（帳號與安全卡的時區同樣處理）。照片存好之後、送出暱稱之前會再檢查一次：這時才斷線，對話框裡會說明照片已經存好、暱稱還沒儲存。
- **帳號與安全卡**（`components/settings/AccountCard.tsx`，取代原本的「個人資料」與「變更密碼」兩張卡）：
  - 三段用分隔線分開：Email（`<dl>`，唯讀文字，不用停用的輸入框；附「登入時使用，目前無法變更」）、時區、密碼。
  - 時區：Select＋「儲存」（secondary，改了才能按；不在選單變動時自動儲存，因為鍵盤上下鍵會直接改值）。選項附上 GMT 偏移（「Asia/Taipei（GMT+8）」，零偏移寫 GMT+0），說明「用來判斷「今天」與統計每天的學習時間」。成功時 toast「已更新時區」（讀書目標卡是「已更新讀書目標」：`useUpdateProfile` 的成功訊息由呼叫端決定）。
  - 密碼：平常只有一列（「密碼」＋「變更後，其他裝置會登出」＋「變更密碼」按鈕，`aria-expanded`、ChevronDown 轉 180°），按了才在下面展開表單（漸進揭露，不用對話框）。送出中不能取消或收起（結果要有地方顯示）。
    - 表單：目前密碼、新密碼（至少 8 個字元）、確認新密碼，`autoComplete` 正確，另有隱藏的 username（Email）讓密碼管理工具知道是哪個帳號。錯誤在欄位旁、送出時焦點到第一個錯誤；目前密碼不對（後端 400）標在「目前密碼」，其他失敗在按鈕上方。
    - 「取消」ghost、「更新密碼」secondary；成功時 toast「密碼已更新，其他裝置已登出」、收起、焦點回到「變更密碼」。滑鼠操作時展開後焦點進「目前密碼」，觸控裝置不自動 focus。
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
  - 第一個可聚焦元素是「跳到主要內容」連結；Logo 下方是像輸入框的「搜尋」鈕（右側 Kbd 提示 ⌘K／Ctrl K，`aria-keyshortcuts`）。
  - **帳號列**（Sprint 4，PRO-1，左下角）：Avatar sm＋暱稱（14／600 ink）＋Email（13px ink-3，太長時截斷，`title` 是完整的 Email），整列是連到 `/settings` 的連結（個人檔案在設定頁最上面），hover 時 subtle 底，約 56px 高（兩行文字加上下各 8px 的內距）。名稱念成「小安，demo@example.com，查看個人檔案」；頭像是裝飾。已經在設定頁時再點會捲回最上面。下面一列是「登出」，維持一眼看得到，不藏進選單。
- **手機底部導覽**：
  - 實心底，12px 標籤。
  - 目前頁面在圖示後面加上膠囊底。
  - 計時中，「計時」那格顯示即時進度環。
  - 頁首右側是搜尋圖示鈕（44px），開指令面板。
  - **「更多」選單**（bottom sheet）：最上面是帳號列（Avatar md＋暱稱 15／600＋Email＋ChevronRight，連到 `/settings`，點了關閉選單），分隔線，其他頁面，分隔線，最下面一列「登出」（20px 圖示，和上面的項目對齊）。
- **導覽數量標籤**（Sprint 2）：
  - 學習任務＝逾期＋今天到期；筆記與錯題＝待複習。0 時不顯示，超過 99 顯示 99+。
  - 顏色依語意：有逾期是 danger，否則 warning。桌面是 soft 膠囊（`bg-*-soft text-*`）靠右；手機是實心膠囊（`bg-danger／bg-warning`＋on-accent 字＋2px card 外圈）疊在圖示右上角。
  - 數字本身 aria-hidden，報讀文字接在名稱後面：「學習任務，3 項待處理，其中 1 項逾期」「筆記與錯題，2 項待複習」。
- **換頁**：路徑改變時捲回頂端；上一頁／下一頁交給瀏覽器還原；只改網址參數（篩選、`?open=`）不捲動。

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

### 跨頁慣例（Sprint 3 設計審查定案）

設計審查發現各頁各做各的地方，統一成下面的規則。改頁面時照這裡做；需要新的例外，先寫進這一節再做。

- **頁首**：一律用 `PageHeader`，不自己寫 `<header>`。
  - 標題上方的小字（例如總覽的日期）用 `eyebrow`；即時摘要用 `description`；動作用 `actions`。
  - PageHeader 自帶下方間距（手機 24、桌面 32），後面的第一個區塊不要再加 `mt-*`。
- **區塊間距**（§5：手機 24、桌面 32）：
  - 直向堆疊用 `<PageStack>`；兩欄以上的格線用 `gap-section`（例如 `grid items-start gap-section lg:grid-cols-5`），欄內再用 `<PageStack>`。
  - 兩者都讀 `--section-gap`（24px，md 以上 32px）。不再手寫 `space-y-5`、`gap-5`、`space-y-6`、`mt-6 md:mt-8`。
  - 卡片內部不算區塊：照 §5 的「組內 4–12、組與組之間 16–24」。
- **每個畫面只有一個 primary**：
  - 有資料時：primary 在頁首的 `actions`，其他動作用 secondary／ghost。
  - **資料為空時**：頁首不放主要動作，由 `EmptyState` 的 primary 負責；篩選列也隱藏（沒有東西可以篩）。
  - 篩選後沒有結果不算「資料為空」：頁首的 primary 與篩選列照常顯示，EmptyState 的動作用 secondary（例如「清除篩選」）。
- **篩選列**：
  - 順序固定：搜尋（`flex-1`）→ 檢視或種類的 Segmented → 狀態 → 科目 → 排序。沒有的項目直接跳過，其餘順序不變。
  - 篩選列到內容一律 `mb-5`（20px：篩選列和它篩的內容是同一個區塊，所以不用區塊間距）。容器是 `mb-5 flex flex-wrap items-center gap-2`。
  - 搜尋框用 `SearchInput`（放大鏡、清除鈕、Esc 清空），不自己組。
- **倒數磚**（考試、截止日、任務期限的「還有幾天」）：
  - 紅色（`bg-danger-soft text-danger`）只給 **3 天內（含今天）的考試**，而且一定加 `AlarmClock` 圖示。
  - 截止日與任務期限在 3 天內用 warning（`bg-warning-soft text-warning`），加 `CalendarClock` 圖示。
  - 其他是中性：`bg-subtle`，數字 ink、說明 ink-2；已經過去的整塊 ink-3。
  - 文案全站統一：「今天」「明天」「N 天後」「已結束」。不用「還有 N 天」「D-N」「D-Day」「已過 N 天」。
  - 24 小時內而且有時間的項目可以改成即時倒數（h:mm:ss 加「後開始」「後截止」）。
  - 數字用 `NumDisplay`／`Countdown`（font-num、等寬數字）。
- **CardHeader**：
  - 圖示：同一頁要嘛每張卡片都有、要嘛都沒有。直接傳 lucide 元件（`icon={Clock}`），大小與顏色由 CardHeader 決定，不在呼叫端寫 `size-[18px] text-ink-3`。
  - 附註放 `meta`（「3 項」「近 7 天」），不寫在標題的括號裡。
- **小標**：卡片外的分組標題（「已釘選 2」「已逾期 1」）和卡片內的欄位小標（「題目」「正確答案」）用 `SectionLabel`，不自己組 class。
- **日期範圍**：寫成「9/7（一）至 10/6（二）」，用「至」，不用破折號（–、—、~）。
- **載入失敗**：`ErrorNote` 傳 `onRetry`（通常是 query 的 `refetch`），讓使用者不必重新整理頁面。
- **例外**（只有這幾個）：
  - 外觀設定的深淺色預覽可以有邊框：它是畫面的縮圖，不算卡片裡的卡片。
  - raw 的 `white`／`black` 只允許出現在選色器的把手（`ColorPicker.tsx`：把手必須在任何顏色上都看得見）。照片燈箱的背景用 `bg-scrim`，不用 `black`。另一個例外是 `lib/profile-image.ts` 轉檔用的 canvas 底色 `#ffffff`：那是 JPEG 影像的底色（透明的地方鋪白），不是介面的顏色。
  - 指令面板的輸入框用 `outline-none`，改以輸入列的下緣線變 accent 表示焦點。其他輸入框都用 `Input`／`SearchInput` 的邊框加光環。
  - 整格或整張卡可點（標題按鈕的 `::after` 蓋滿容器）一律用 `StretchedButton`，不自己寫。非自己寫不可時：
    - 按鈕本身的焦點框用 `focus-visible:outline-0`（寬度歸零）關掉，全站統一這個寫法，不用 `outline-none`。
    - 焦點框畫在 `::after` 上（`focus-visible:after:outline-2 focus-visible:after:outline-accent`）。
    - 容器有 `overflow-hidden` 時加 `focus-visible:after:-outline-offset-2`，否則焦點框畫在容器外面會被裁掉。
    - 容器要 `relative`；同一格裡其他可以點的元素加 `relative z-10` 才會疊在上面。
    - 整格是「前往另一頁」時要用連結（`<Link>`），StretchedButton 是按鈕，不適用：照上面的規則自己寫（例如個人檔案的成就格）。格子在有圓角的卡片角落時，`::after` 也要給同樣的內圓角，焦點框才不會被裁掉。

### 元件 API（Sprint 1 定案，給 Sprint 2 各 lane）

元件的預設樣式放在 `index.css` 的 `@layer components`（`.sf-btn`、`.sf-field`、`.sf-dialog`），頁面傳入的 `className` 工具類一定蓋得過（例如 `className="h-12 text-base"`、`text-danger`）。頁面不要直接寫 `.sf-*`，請用元件。

**`components/ui.tsx`**

| 元件 | Props（新 prop 都是可選的） | 說明 |
|---|---|---|
| `Button` | `variant: 'primary'｜'secondary'（預設）｜'ghost'｜'danger'｜'soft'`、`size: 'sm'｜'md'（預設）｜'lg'｜'icon'`、`loading` | 40px（觸控 44px；sm 32px，觸控裝置另有至少 44×44 的 `::after` 點擊範圍（Sprint 3 修正：原本只有 42px 高）；lg 48px；icon 36px、觸控 44px）。`loading` 保留文字並加 `aria-busy`。只有圖示時一定要給 `aria-label`。型別 `ButtonVariant`、`ButtonSize` |
| `Input`、`Textarea` | 原生屬性 | 手機 16px、sm 以上 15px；page 色內嵌底、line-field 邊框、focus 時 accent 邊框加光環；`aria-invalid` 時變紅 |
| `Select` | 原生屬性 | 右側 ChevronDown。**`className` 套在外層容器**（寬度、版面），select 填滿容器 |
| `Field` | `label`、`hint`、`error`、`children: (id, aria) => …`、`className`；**Sprint 2**：`layout?: 'stacked'（預設）｜'inline'`（型別 `FieldLayout`） | `aria` 是 `FieldAria`（`aria-describedby`、`aria-invalid`），請展開到欄位上：`{(id, aria) => <Input id={id} {...aria} />}`。舊寫法 `(id) =>` 會自動把 aria 補到回傳的元素上。inline：標籤與提示／錯誤在左欄、欄位在右欄垂直置中，右欄寬度由欄位決定，請給欄位寬度（`className="w-24"`） |
| `Card` | `as: 'section'｜'div'｜'article'｜'li'`、`variant: 'default'｜'inset'｜'plain'`、`interactive` | 只有整張可點的卡片才加 `interactive` |
| `CardHeader` | `title`、`icon`、`meta`、`action` | 標題是 h2（18px／600）；meta 例如「3 項」 |
| `PageHeader` | `title`、`description`（ReactNode）、`actions` | h1；description 放即時摘要 |
| `Badge` | `tone: 'neutral'｜'accent'｜'danger'｜'success'｜'warning'｜'outline'`、`icon` | 20px 高；圖示自動縮成 12px；型別 `BadgeTone` |
| `EmptyState` | `icon`、`title`、`description`、`action`、`variant: 'page'｜'inline'`、`className` | inline 版：一行文字（`title`，`description`）＋右側 ghost 動作 |
| `Spinner`、`PageLoader`、`ErrorNote` | — | PageLoader 延遲 150ms 才出現；ErrorNote 有圖示 |
| `Segmented<T>` | `value`、`onChange`、`options: { value, label, disabled? }[]`、`label`（必填，群組名稱）、`stretch`、`className` | WAI-ARIA radio：roving tabindex、方向鍵循環並選取、Home／End |
| `Dialog` | `open`、`onClose`、`title`、`footer`、`wide` | `aria-labelledby`；手機 bottom sheet（拖曳把手往下拉可關閉）；觸控裝置不自動 focus，桌面版 `autoFocus` 有效；關閉後卸載內容 |
| `useConfirm(defaults?)` | 回傳 `[confirm, element]`；`confirm(opts: ConfirmOptions)` → `Promise<boolean>`。`ConfirmOptions = { title, message?, confirmText?, cancelText?, tone? }`；**Sprint 2**：`tone?: 'danger'（預設）｜'primary'`（型別 `ConfirmTone`），也可以 `useConfirm({ tone })` 設整個 hook 的預設值 | danger：danger 確認鈕、預設焦點在「取消」、省略 message 時顯示「刪除後無法復原。」、確認鈕預設「刪除」。primary：primary 確認鈕、預設焦點在確認鈕、省略 message 時不顯示、確認鈕預設「確定」（請改寫成動作）。既有呼叫端行為不變 |
| `ProgressBar` | `value`、`max`（100）、`label` 或 `labelledBy`、`valueText`、`tone: 'accent'｜'success'｜'warning'｜'danger'`、`color`、`size: 'sm'｜'md'` | `role="progressbar"`；`color` 傳 `subjectTone(...).mark`，軌道自動用同色淡一階；型別 `ProgressTone` |
| `ProgressRing` | 同上，另有 `size`（40）、`stroke`（4）、`trackColor`、`children`（圓心內容） | 底色和軌道同色時（例如膠囊底上）用 `trackColor` 換軌道色。**children 是純展示**：progressbar 的子元素在無障礙樹裡是 presentational，螢幕報讀器不會念；要報讀的內容放在 `label`／`valueText`，圓心不要放按鈕、連結等可互動元素 |
| `GoalProgress` | `label`、`value`、`goal`（> 0）、`unit`（'分鐘'）、`format`、`color` | 已讀／目標、百分比、「還差 …」或「已達成」（圖示加文字，進度條轉成 success）。沒設目標時不要用它，改顯示「設定目標」連結 |
| `Switch`、`Checkbox` | `checked`、`onChange(checked)`、`label`、`disabled`、`id`、`aria-*`；Checkbox 另有 `indeterminate`；**Sprint 2**：Switch 另有 `description?: ReactNode` | `role="switch"／"checkbox"` + `aria-checked`，整列可點、至少 44px；沒有 `label` 時要給 `aria-label`。description 顯示在標籤下方（13px ink-3），以 `aria-describedby` 連到開關（和呼叫端給的 aria-describedby 合併），名稱仍只有標籤；有 description 時開關對齊第一行 |
| `Highlight` | `text`、`query`（字串以空白分隔，或字串陣列）、`className` | 用 `<mark>`（mark token）標出關鍵字，不分大小寫 |
| `Kbd` | `children` | 例如 `<Kbd>Ctrl</Kbd> <Kbd>K</Kbd>` |
| `NumDisplay` | `children`、`unit`、`size: 'xl'｜'lg'（預設）｜'md'｜'sm'` | 數字字型、等寬數字；xl 為計時大字；型別 `NumSize` |
| `Countdown` | `seconds`、`size`（'xl'） | `role="timer"`，mm:ss 或 h:mm:ss，半窄字寬 |

**`components/charts.tsx`**：`StatStrip({ items: StatItem[] })`，`StatItem = { key?, label, value, sub?, icon? }`（一張卡片用分隔線分格、手機 2 欄、sm 以上最多 4 格、數值 28／600）。`Heatmap` 內建「表格／圖表」切換與 `role="img"` 摘要。`StatTile`、`Legend`、`SubjectBars`、`MiniDailyBars`、`DailyStackedBars`、`WeeklyTaskBars`、`SeriesDef` 的 API 不變（`StatTile` 只為相容保留，新頁面改用 `StatStrip`）。**Sprint 3：`StatTile` 已經沒有任何呼叫端**（全 repo grep 只剩定義本身），`charts.tsx` 的擁有者可以在之後的清理刪掉；s3/design 不改 `charts.tsx`，所以先保留。

**Sprint 2 新增到 `components/ui.tsx`（s2/shell，只新增、既有 API 不變）**

| 元件 | Props | 說明 |
|---|---|---|
| `ButtonLink` | react-router 的 `LinkProps` ＋ `variant`、`size`（同 Button） | 看起來像按鈕的導覽連結（`<a>`，可新分頁開啟）。外觀、尺寸、按下回饋與 Button 相同。前往另一頁用 ButtonLink，原地動作用 Button |
| `TextLink` | `LinkProps` | 文字連結＋ChevronRight，accent-ink 14px／600，`min-h-11`（佔版面的 44px 點擊高度） |
| `MoreLink` | `LinkProps` | CardHeader 右側的「查看全部」：14px／400，外觀不佔高度，`::after` 把點擊範圍往上 16px、往下 8px 擴大到 44px |
| `Unit` | `children` | 數字後面的單位：文字字型 14px ink-2，放在 font-num 的數值裡 |
| `Duration` | `minutes` | 分鐘數 → 「45 分鐘」「2 小時」「1 小時 20 分」，數字沿用外層字型、單位用 Unit |
| `Figure` | `label`、`sub?`、`children`、`className` | dt＋dd 的一格數字，必須放在 `<dl>` 裡；卡片內分格時第二格起加 `border-l border-line` |
| `TableToggle` | `on`、`onToggle` | 圖表／表格切換（`aria-pressed`），和 charts.tsx 的同名元件相同，不必為了它載入圖表函式庫 |
| `gridKeyTarget(e, index, count, grid)` | 函式 | 格狀 radiogroup 的方向鍵目標（左右循環、上下同欄、Home／End），欄數讀 CSS grid 實際排出的欄 |

**Sprint 3 新增到 `components/ui.tsx`（s3/design，只新增 export 與可選的 prop，既有 API 不變）**

既有元件的新 prop：

| 元件 | 新 prop | 說明 |
|---|---|---|
| `PageHeader` | `eyebrow?: ReactNode`、`className?`、`actionsClassName?` | eyebrow 在 h1 上方（13px ink-2，例如總覽的日期 `<time>`）。actionsClassName 套在動作列（例如手機撐滿 `w-full sm:w-auto`）。**下方間距從固定 24px 改成 `mb-section`**（手機 24、md 以上 32），後面的第一個區塊不要再加 `mt-*` |
| `CardHeader` | `icon?: IconProp`（原本是 ReactNode） | 傳 lucide 元件 `icon={Clock}` 時統一 18px、ink-3、aria-hidden；傳元素照舊原樣顯示 |
| `ErrorNote` | `onRetry?: () => void`、`retrying?: boolean` | 有 onRetry 時右側出現「重新載入」（sm secondary，RotateCw 圖示）；retrying 時按鈕轉圈、`aria-disabled`＋`aria-busy` 並忽略點擊（不用 `disabled`，鍵盤焦點留在按鈕上，重試失敗可以再按一次）。通常 `onRetry={() => void refetch()} retrying={isRefetching}`。不傳時和原本一樣 |

新元件與工具：

| 名稱 | Props | 說明 |
|---|---|---|
| `IconProp` | 型別：`LucideIcon \| ReactNode` | 元件的 icon prop：傳元件由元件決定大小顏色；傳元素照原樣 |
| `PageStack` | `as?: 'div' \| 'section'`、其餘 HTML 屬性 | `space-y-section`：區塊之間的直向間距。兩欄以上的格線用工具類 `gap-section` |
| `SectionLabel` | `children`、`as?: 'h2'（預設）\|'h3'\|'h4'\|'p'\|'div'`、`size?: 'meta'（預設）\|'sm'`、`tone?: 'neutral'（預設）\|'danger'\|'warning'\|'success'`（型別 `SectionLabelTone`）、`icon?: IconProp`、`count?: number`、`countUnit?: string`（'項'）、`id?`、`className?` | 小標，600、ink-2、圖示 16px（neutral 時圖示 ink-3）。count 用數字字型 ink-3，報讀成「已逾期，1項」。間距由呼叫端給（`className="mb-2 px-1"`） |
| `ToggleButton` | `pressed`、`onPressedChange(pressed)`、`busy?`、`variant?: 'text'（預設）\|'icon'`、`icon?: IconProp`、`size?: ButtonSize`、其餘 button 屬性（含 `aria-label`、`title`、`data-*`）；forwardRef | `aria-pressed`；按下時 accent-soft 底、accent-ink 字、圖示轉實心（`fill-current`）。名稱不隨狀態改字。busy 時 `aria-disabled`＋`aria-busy`、opacity .7、忽略點擊（不用 disabled，焦點不會掉）。text 版是 sm secondary（未按下時有框）；icon 版是 ghost icon（36px、觸控 44px，未按下 ink-3），一定要給 aria-label |
| `MiniIconButton` | `label`（無障礙名稱，必填）、`icon?: LucideIcon`（預設 X）、其餘 button 屬性；forwardRef | 看起來 28px 的圓形圖示按鈕（card 90% 底、line 框、陰影 sm），`::after` 擴大到 44px。位置由 className 決定（`absolute top-1 right-1`）。焦點時底色轉成實心 card，焦點框外再墊一圈 card |
| `StretchedButton` | `cover?: 'cell'（預設）\|'card'`、其餘 button 屬性；forwardRef | 整格可點的標題按鈕：`::after` 蓋滿最近的 relative 容器，焦點框畫在 `::after`。cell：往外 4px、圓角 md；card：貼齊、圓角 xl、焦點框內縮 2px（卡片有 overflow-hidden 也看得到）。文字樣式由 className 給 |
| `ShowAllToggle` | `expanded`、`onToggle`、`total`、`limit`、`unit?`（'項'）、`className?` | 「顯示全部 25 項／只顯示前 20 項」＋ChevronDown（展開時轉 180°），`aria-expanded`，ghost sm、撐滿寬度。total ≤ limit 時不顯示 |
| `SearchInput` | `value`、`onValueChange(value)`、`label`（aria-label，必填）、`clearLabel?`（'清除搜尋'）、`className?`（**套在外層容器**）、其餘 input 屬性（placeholder、maxLength…）；forwardRef 到 input | `role="search"` 容器、左側放大鏡、有文字時右側 44px 清除鈕（清除後焦點回到輸入框）、Esc 清空並攔下事件（`preventDefault`＋`stopPropagation`，外層的對話框與 Escape 快捷鍵都不會觸發；已經是空的就交給外層，例如讓對話框關閉）、注音選字中不攔截。`type="search"`、`enterKeyHint="search"`、隱藏瀏覽器內建的清除鈕 |
| `usePrefersReducedMotion()` | — | `prefers-reduced-motion: reduce` 是否成立（`useSyncExternalStore`，會跟著系統設定變）。CSS 能處理的用 `motion-reduce:`，只有 JS 控制的動畫才用它 |

tokens 與工具類：`--section-gap`（`gap-section`、`space-y-section`、`mb-section`、`mt-section`）、`--scrim`／`--on-scrim`（`bg-scrim`、`backdrop:bg-scrim`、`text-on-scrim`）。

**Sprint 4 新增到 `components/ui.tsx`（s4/profile-ui，PRO-1；只新增 export，既有 API 不變）**

| 名稱 | Props | 說明 |
|---|---|---|
| `Avatar` | `name`（暱稱，必填）、`src?: string \| null`（照片網址，例如 `avatarUrl(user)`、預覽的 `blob:`）、`size?: AvatarSize`（預設 'md'）、`label?: string`、`className?` | 圓形頭像。有照片顯示照片；沒有或載入失敗時顯示暱稱的第一個字素（accent 底、on-accent 字）。旁邊有暱稱時不給 `label`（`aria-hidden`）；單獨出現時給 `label`（`role="img"`） |
| `AvatarSize` | 型別：`'sm' \| 'md' \| 'lg' \| 'xl'` | 32／40／72／96px |

`firstGrapheme` 沒有搬家：它本來就在中性的 `lib/format.ts`（沒有 React），`ui.tsx` 與 `components/subjects.tsx` 都從那裡 import，`ui.tsx` 不必反過來 import `subjects.tsx`。

個人檔案的純邏輯（都有單元測試）：`lib/profile-format.ts`（`joinedLabel`、`studyTotal`、`sessionsNote`、`streakNote`、`masteredNote`、`formatCount`、`badgeCapacity`、`emailParts`、`timezoneOptions`、`timezoneLabel`）、`lib/profile-crop.ts`（`squareCrop`、`AVATAR_MAX_EDGE`、`AvatarImageError`、`withinAvatarLimit`、`AVATAR_TOO_LARGE`）、`lib/profile-photo.ts`（照片的變更 `PhotoDraft`、`draftPreview`、`removeDraft`、`photoNote`）、`lib/profile-save.ts`（儲存流程 `saveProfile`、`saveFailureMessage`）。瀏覽器端的照片處理是 `lib/profile-image.ts` 的 `prepareAvatar(file)`，測試用假的 `createImageBitmap` 與 canvas（`test/profile-image.spec.ts`）。資料用 `lib/queries.ts` 的 `useProfileSummary`、`useUploadAvatar`、`useDeleteAvatar` 與 `lib/api.ts` 的 `avatarUrl(user)`（s4/profile-api），型別是 `src/shared/api-types.ts` 的 `ProfileSummary`。頭像網址一律用 `avatarUrl(user)` 組：`?v=` 等於目前的 `avatarUpdatedAt` 時後端才讓瀏覽器快取一年。

**頁面端遷移（給 s3/polish，照這張表換）**

| 原本 | 換成 |
|---|---|
| `pages/Dashboard.tsx` 自己寫的 `<header>`（日期＋問候＋兩個 lg 按鈕） | `<PageHeader eyebrow={<time dateTime={data.today}>…</time>} title={…} actionsClassName="w-full sm:w-auto" actions={…} />`；下方的 `mt-6 md:mt-8` 拿掉，主體用 `PageStack`／`gap-section` |
| 各頁的 `space-y-5`、`space-y-6`、`gap-5`、`gap-6`、`mt-6 md:mt-8`、`mt-8`（區塊之間） | `PageStack`（直向）、`gap-section`（格線） |
| `icon={<Clock className="size-[18px] text-ink-3" aria-hidden />}`（CardHeader） | `icon={Clock}` |
| `pages/Notes.tsx` 的 `Section` 標題、`components/tasks/TaskList.tsx` 的分組 h2、`components/notes/content.tsx` 的 `Block` h3、`components/notes/review.tsx`「還不熟的題目」h3 | `SectionLabel`（TaskList：`size="sm" tone={overdue→'danger', today→'warning', done→'success'} icon={…} count={n}`；Block：`as="h3" icon={…}`，正確答案的綠勾用元素傳 `icon={<CircleCheck className="text-success" aria-hidden />}`） |
| `components/notes/pin.tsx` 的 `PinToggle` 內部 | `ToggleButton`（icon 版：`variant="icon" icon={Pin} aria-label={\`釘選「${title}」\`} title=… data-pin-id=…`；text 版：`icon={Pin}`＋「釘選」）。PinToggle 的外部 API 可以保留 |
| `components/notes/content.tsx` 的 `ThumbAction` | `<MiniIconButton label=… onClick=… className="absolute top-1 right-1" />` |
| `components/notes/content.tsx:57` 燈箱的 `backdrop:bg-black/85` | `backdrop:bg-scrim` |
| `components/TaskItem.tsx` 的 `TaskTitleButton` 外殼 | `<StretchedButton data-task-title className="text-dense break-words …">`（cover 預設 cell） |
| `components/notes/card.tsx` 標題按鈕的 `after:absolute after:inset-0 …` | `<StretchedButton cover="card" onClick={onOpen}>` |
| `components/tasks/TaskList.tsx`、`TaskBoard.tsx` 的「顯示全部／只顯示前」按鈕 | `<ShowAllToggle expanded={showAll} onToggle=… total={n} limit={DONE_LIMIT} />` |
| `pages/Subject.tsx` 的 `ShowMore`（「再顯示 N 場／收起」） | 可以保留文案，或換成 `ShowAllToggle`（unit="場"） |
| `components/tasks/TaskToolbar.tsx` 的搜尋框、`pages/Notes.tsx` 的搜尋框 | `<SearchInput value={q} onValueChange={…} label="搜尋任務" placeholder=… maxLength={100} className="min-w-0 grow basis-full sm:basis-64" />`，筆記頁也移到篩選列最前面 |
| `lib/task-queries.ts` 的 `usePrefersReducedMotion` | 從 `components/ui` 匯入（原本那份可以改成 re-export 或刪掉） |
| 任務、筆記、考試頁的 `<ErrorNote error={error} />` | `<ErrorNote error={error} onRetry={() => void refetch()} retrying={isRefetching} />` |

**殼層（s2/shell）**：`components/CommandPalette.tsx` 的 `CommandPalette({ onClose })` 由 Layout 掛載（分開打包、閒置時預載），頁面不必使用。純邏輯在 `lib/command-palette.ts`（`resultHref`、`QUICK_ACTIONS`、`PAGE_KEYWORDS`、`matchesQuery`、`isPaletteShortcut`）、`lib/nav-badges.ts`（`navBadges`、`badgeLabel`）、`lib/achievement-display.ts`（`seenKey`、`parseSeen`、`diffUnlocked`、`achievementUnit`、`groupAchievements`、`nextMilestone`、`formatProgress`、`splitColumns`（Sprint 3：把依序排列的區塊分成兩欄，各欄自己堆疊、單欄時順序不變））、`lib/achievement-icons.ts`（`achievementIcon`、`AchievementIcon`）。
- 搜尋結果的深連結：任務 `/tasks?open=<id>`、考試 `/events?open=<id>`、筆記 `/notes?open=<id>`、科目 `/subjects/<id>`；快捷動作 `/timer`、`/tasks?new=1`、`/notes?new=mistake`、`/settings?new=1`。**目標頁已經開著時也要能反應網址參數的改變**（例如在任務頁按 ⌘K 選另一個任務）。
- 已看過的成就：localStorage `studyflow:achievements-seen:<userId>`（JSON 字串陣列）。

**導覽與版面**：`components/nav.ts` 提供 `NAV`、`NAV_GROUPS`（側欄分組）、`MOBILE_MAIN`、`NavItem { to, label, short?, icon, end? }`；`components/TimerPill.tsx` 提供 `TimerPill`、`TimerNavIcon`。`<main id="main-content">` 是「跳到主要內容」的目標。路由：`/subjects/:id`（`pages/Subject.tsx`）、`/achievements`（`pages/Achievements.tsx`，`AchievementsPage`）。`components/Logo.tsx` 的 `LogoMark({ className })`、`Logo()` API 不變，顏色改用 `--logo-*` token。

**`lib/theme.ts`**：原有的 `ThemeMode`、`initTheme`、`setThemeMode`、`useThemeMode`、`useIsDark` 不變；新增 `ACCENTS`、`AccentId`、`useAccent()`、`setAccent(id)`（設定頁的主題色卡可以直接用色票 `<span data-accent={id} className="bg-accent" />`，會跟著目前的深淺色）。

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
- 局部預覽用 Tailwind 的 `dark:`；在頁面直接寫 `.sf-*` 元件 class；紅、橘、黃系當主題色。

## 9. 已知限制與待評估

- **多層巢狀 `data-accent`**：祖先 A 底下的元素 B 又設了 `data-accent`，B 裡面的子元素只加 `data-theme` 時，會依原始碼順序取 A 或 B，不保證取最近的 B。預覽時請把 `data-accent` 和 `data-theme` 放在同一個元素上。
- **Tailwind `dark:` 以 `<html>` 為準**：局部 `data-theme` 只切換 tokens，不影響 `dark:` 變體。
- **只加 `data-accent` 的元素不會重算 heat-***：熱度圖色階跟著 `<html>` 的主題色。
- **熱度圖最淺一階**：heat-1 對 card 約 1.3:1。依 dataviz 對 sequential 色階的規則（最淺一階代表接近 0，可以貼近表面）保留，並以表格檢視、格子的 title 提示與 `role="img"` 摘要補足。
- **墨綠主題色與 success 相近**（ΔE 7.7／9.2）：計時環的專注（accent）與休息（success）靠文字標籤區分。
- **深色的 DARK_BAND**（Sprint 3 評估完，維持 0.55–0.67，數字見 §3）：同色相的 4 個色調在深色只差 ΔE 2.9–5.0，選色器會提醒「深色模式下幾乎一樣」。要改善得改深色的換算方式（`src/shared/color.ts`），不是調整色帶端點。
- **第三方**：
  - sonner 的關閉鈕外觀仍是 20px（套件內建），點擊範圍用 `::after` 擴大到 44px（會蓋到 toast 左上角約 25px 見方，那裡沒有其他可以點的東西）；toast 的動作鈕在觸控裝置用 `::after` 擴大到 44px 高。
  - PWA 啟動畫面：manifest 的 `background_color`、`theme_color` 都是淺色的 page（#f7f6f2），和 `--page` 一致；manifest 沒有標準的深色欄位，所以深色模式的啟動畫面仍是淺色，進入 App 後 `theme-color` meta 會換成深色的 page。
- **照片燈箱**：深色模式的關閉鈕（card 底）對 scrim 只有 1.18:1，靠 ink 的 X 圖示（15.43:1）與 line 邊框辨識。
- **品牌標誌**：站內的 `LogoMark` 跟著主題色與深淺色（`--logo-*`）；PWA 圖示與 favicon（`public/logo.svg`）是固定的藍筆版，換主題色不會變。
- **成就 toast**：已看過的紀錄存在各瀏覽器的 localStorage，換裝置或清除網站資料後，第一次載入會把當時已解鎖的視為「已看過」而不跳 toast；徽章被收回後再解鎖也不會再跳（成就頁仍顯示目前的真實狀態）。同時開兩個分頁時，兩邊可能各跳一次。
- **指令面板的「開始專注」**只前往計時頁，不會自動開始計時（避免誤觸就開始記錄）。
- **指令面板的深連結**：`?open=<id>`、`?new=1`、`?new=mistake` 都已由各頁的 `useDeepLink` 實作（任務、考試、筆記、設定、月曆），選了搜尋結果會直接開啟該項目。
- **Field 舊寫法的自動 aria**：只補在 children 回傳的那個元素上；自訂元件（例如 `SubjectSelect`）沒有把 aria 屬性傳給內部欄位時不會生效，Sprint 2 請改成 `(id, aria)` 並往下傳。
- **個人檔案（Sprint 4，PRO-1）**：
  - 成就格的徽章沒有滑鼠提示（`title`）：整格是連結，`::after` 蓋在徽章上面。名稱給螢幕報讀器，看得到的人點進成就頁看。
  - 取消儲存的瞬間，請求剛好已經在伺服器上處理完時，照片或暱稱仍會換上去（重新取得使用者後畫面一致）。
  - 別的裝置改了照片或暱稱，這台在切回分頁或重新連上網路時才更新；分頁一直開在前景時不會自己更新。
  - 照片只在瀏覽器裡處理：比 512px 小的照片不放大；GIF 只取第一格；瀏覽器解不開的格式（例如 Chrome 的 HEIC）會請使用者改用 JPEG、PNG 或 WebP。
  - 頭像的 `<img>` 由瀏覽器快取，Service Worker 不快取 `/api/*`：離線且沒有快取時顯示首字。
