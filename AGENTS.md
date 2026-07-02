# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> 本專案以**繁體中文**溝通；給使用者的結論／回饋請用繁體中文。程式碼、註解可維持英文。

## 專案本質

《天堂 Lineage》裝備精煉模擬器——**純前端**遊戲，無後端、無建置步驟。所有 `.html` 直接在瀏覽器執行，Vue 3 由 CDN 載入，遊戲狀態全存在 `localStorage`。

## 常用指令

```bash
# 啟動開發伺服器（會自動開瀏覽器，解析動態 port）
node start.cjs              # 跨平台；Windows 亦可雙擊 start.bat，macOS/Linux 用 ./start.sh

# 或直接起 server（Codex 預覽用的 launch.json 固定 5500 埠）
npx serve .

# 跑邏輯測試（Node 內建 test runner；全部 10 項應通過）
node --test tests/nav3d.test.mjs
```

**務必透過 http 開啟，不要用 `file://`**：`assets/data/refine_rates.json` 是執行期 `fetch` 的，`file://` 會觸發 CORS，機率會默默降級成程式內建預設值。`serve.json` 已設 `no-store` 避免開發時快取。

## 目錄結構

- **應用 JS 放 `assets/js/`**：`nav3d.js`、`scene3d.js`、`credits.js`。
- **資料 JSON 放 `assets/data/`**：`refine_rates.json`。
- **根目錄只留工具鏈設定**：`package.json`、`serve.json`、`skills-lock.json`、`start.cjs`/`.bat`/`.sh`（這些檔案位置由工具鏈固定，不可搬移）。
- 搬移 JS/JSON 時必須同步更新所有引用：`lineage.html`（`<script src>`）、`logout.html`（`<script src>`）、`refine_table.html`（`fetch`）、`tests/nav3d.test.mjs`（`import`）。

## 關鍵限制（違反會壞）

- **不可有建置步驟**：只能寫純瀏覽器相容 JS。不要引入 TypeScript、JSX、ES module bundler，或任何需要 transpile 的語法。
- **`assets/js/nav3d.js` 必須維持「無 DOM、無 Babylon」**：它是純邏輯，才能被 Node 測試 import，也才能維持邏輯／呈現分離。把 DOM 或 Babylon 寫進去會破壞測試與架構。
- **`assets/js/nav3d.js` / `assets/js/scene3d.js` 以 classic `<script>` 全域載入**（各自 IIFE，只掛 `globalThis.Nav3D` / `globalThis.Scene3D`），不是 ES module。這是為了讓頁面連 `file://` 都能跑。載入順序固定：Babylon CDN → `assets/js/nav3d.js` → `assets/js/scene3d.js` → 頁面內 inline app。
- **Vue 範本閃現**：`#app` 需保留 `v-cloak`（搭配 `[v-cloak]{display:none}` 與 `#preboot` 靜態載入層），否則掛載前 `{{ }}` 原始範本會外露。

## 場景的三層架構（最重要、需跨檔理解）

3D 場景刻意拆成「邏輯／呈現／黏合」三層，改動時要分清楚責任歸屬：

1. **`assets/js/nav3d.js` — 純導航邏輯**
   - `TILEMAP` 是**地圖的唯一真值來源**：A* 導航網格與 3D 牆面幾何「都」由它生成。要改地圖就改這個字串陣列。
   - 圖例：`#`牆 `.`地板 `S`起點 `O`歐林 `C`營火 `t`火把 `P`柱子。外圈必為實牆、內部地板須連通。
   - 提供：`walkable()`、A* `findPath()`（含視線平滑）、`canStep()` 碰撞、座標轉換。
   - **無物理引擎**（見 `docs/adr/0002`）：碰撞用射線／網格判定即可。

2. **`assets/js/scene3d.js` — 純 Babylon 呈現**
   - `createScene(canvas, opts)` 回傳 `sceneApi`：`setPlayer`、`setOlin`、`setNavPath`、`setCameraMode`、`setBrightness`、`dispose`。
   - 正交相機（2.5D 等角，俯角鎖定）；`cameraMode` 為 `'fixed'` | `'rotatable'`。
   - 多盞點光源（火把／營火）以 `StandardMaterial` 逐像素打光，`maxSimultaneousLights=10`——放大時填充率成本高，是效能熱點。

3. **`lineage.html` — Vue app + 遊戲迴圈（黏合層）**
   - 持有世界座標 `(wx, wy)`，`logicLoop` 每幀以 `nav3d` 算移動／尋路，再透過 `sceneApi` 餵位置給 `scene3d`。
   - 移動採 **delta-time**：`_moveStep = SPEED × dtFactor`，FPS 起伏時實際速度不變（夾上限避免穿牆）。

**座標系**：邏輯像素 `(wx,wy)`（以 `TILE_PX=40` 的 tilemap 為準）對上 Babylon 世界單位（`WORLD_SCALE=0.04`、地圖以原點為中心、邏輯南方 = `-Z`）。兩者以 `logicToWorld` / `worldToLogic` 互轉。

## 資料層（localStorage）

| Key | 內容 |
|-----|------|
| `lineage_player` | `{name, gold, server, loggedIn, loginTime, invSize}`；`invSize`＝背包容量（預設 100，歐林購買 +100/1000 萬天幣，上限 1000） |
| `lineage_inventory` | 陣列長度＝`invSize`（初始 100 格），索引即格位；物品 `type`：`weapon`/`armor`/`scroll_weapon`/`scroll_armor`/消耗品 |
| `lineage_config` | `{maxEnhLevel, brightness, cameraMode, priceConfig:{weapon, armor, twdRate}}` |

- **每個頁面在 `onMounted` 檢查 `lineage_player.loggedIn`**，未登入強制導回 `login.html`。
- 寫 `lineage_config` 時用 `...prev` 展開保留既有欄位，避免不同頁互相覆寫（例如 `cameraMode`）。

## 頁面流程

`index.html` →（轉址）`login.html` → `lineage.html`（主遊戲）。主遊戲再開：`cash_pay.html`（儲值）、`refine_table.html`（機率表，新分頁）、`logout.html`（片尾）。

**設定頁特例**：`lineage.html` 的「⚙ 配置」以 **iframe** 嵌入 `setting.html`（不跳頁，3D 場景保留在背後）。`setting.html` 偵測自己是否被嵌入（`window.self !== window.top`）：嵌入時用 `postMessage`（`lineage-setting-saved` / `lineage-setting-live`）與父頁溝通做即時預覽與存檔後關閉，獨立開啟時則維持原本整頁跳轉行為。`lineage.html` 內另保有一套 hardcode 的子面板當退路。

## 精煉系統

機率資料與程式分離：`assets/data/refine_rates.json`（執行期 fetch，失敗則用內建預設）。規格詳見 `docs/06_refine_system.md`。重點：`base` 基礎成功率、`safe` 安定範圍內固定 100%、卷軸 `scroll_bonus` 直接疊加並 clamp 至 100；強化費用 `500 × 2^當前等級`。

強化裝備顯示格式統一為「+N 名稱」（`displayName()` helper，勿再手組 `名稱+N`）。**整批衝裝工具**（見 `docs/adr/0003`）：背包工具列 checkbox 觸發、卷軸鐵鎚流程的 modal 子模式，機率複用 `isSafe()`/`successRate()`；每次嘗試消耗 1 張同變體卷軸、免強化費；詛咒卷軸排除（落回單把流程）。

## 設計文件與詞彙

- `readme.md`：完整功能與資料層說明。
- `CONTEXT.md`：場景／相機的統一詞彙（Scene vs Map、Fixed/Rotatable view、Character/Knight、NPC/Olin）——命名請遵循。
- `docs/`：中文設計規格（`06_refine_system.md` 最關鍵）。
- `docs/adr/`：架構決策（0001 改用 Babylon 3D；0002 在 3D 重建導航、不上物理引擎）。

## UI 慣例

所有頁面共用同一組 CSS 變數（`--gold #c8a84b`、`--gold2 #f0d060`、`--panel #150e06`、`--border #6a4420`、`--text #e8d5a0`、`--red`、`--green`），維持天堂沙漠風主題。
