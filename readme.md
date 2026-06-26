# 天堂：經典版 — 裝備精煉模擬器

> 純前端的《天堂 Lineage》裝備強化模擬遊戲。Vue 3 + Babylon.js 2.5D 等角場景 + localStorage，無後端、無建置步驟，所有 `.html` 直接在瀏覽器執行。

![Vue](https://img.shields.io/badge/Vue-3-42b883)
![Babylon](https://img.shields.io/badge/Babylon.js-CDN-bb464b)
![Frontend](https://img.shields.io/badge/架構-純前端-blue)
![Storage](https://img.shields.io/badge/儲存-localStorage-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 目錄

- [專案簡介](#專案簡介)
- [快速開始](#快速開始)
- [專案結構](#專案結構)
- [頁面流程](#頁面流程)
- [技術架構](#技術架構)
- [3D 場景三層架構](#3d-場景三層架構)
- [資料層設計](#資料層設計)
- [精煉系統](#精煉系統)
- [功能一覽](#功能一覽)
- [測試](#測試)
- [UI 設計系統](#ui-設計系統)
- [關鍵限制](#關鍵限制)
- [未來規劃](#未來規劃)

---

## 專案簡介

重現《天堂 Lineage》裝備強化（精煉）系統的瀏覽器遊戲模擬器。玩家在 2.5D 等角地城場景中走動、與歐林 NPC 互動，購買卷軸、強化武器與防具、出售裝備換取天幣，體驗高等級精煉的機率刺激。

**設計目標：**

- 完整模擬原版精煉手感（機率、爆炸、安定值）
- 純靜態檔案部署，無需任何後端、無需建置步驟
- 機率資料與程式邏輯分離，便於客製化私服規則
- 3D 場景的「邏輯／呈現」徹底分離，導航邏輯可被 Node 單元測試

---

## 快速開始

### 環境需求

僅需 Node.js 與現代瀏覽器（Chrome / Edge / Firefox）。

### 一鍵啟動（推薦）

| 平台 | 方式 |
|------|------|
| **跨平台** | `node start.cjs`（解析動態 port、啟動 server 後自動開瀏覽器） |
| **Windows** | 直接雙擊 `start.bat` |
| **macOS / Linux** | `chmod +x start.sh && ./start.sh` |

### 手動啟動

```bash
npx serve .
# 然後在瀏覽器開啟伺服器顯示的 http://localhost:<port>
```

> **務必透過 HTTP 開啟，不要用 `file://`。** `assets/data/refine_rates.json` 是執行期 `fetch` 的，`file://` 會觸發 CORS，機率會默默降級成程式內建預設值。`serve.json` 已設 `no-store` 避免開發時快取。
>
> （3D 場景的 `nav3d.js` / `scene3d.js` 以 classic `<script>` 全域載入，連 `file://` 都能跑；唯獨上述 JSON fetch 需要 HTTP。）

### 進入遊戲

1. 伺服器啟動後瀏覽器自動導向 `login.html`
2. 輸入角色名稱完成登入，進入主遊戲 `lineage.html`

---

## 專案結構

```
lineage-refine/
│
├── index.html              # 入口，自動轉址 → login.html
├── login.html              # 登入頁
├── lineage.html            # 主遊戲（Vue 3 app + 遊戲迴圈 + 3D 場景黏合層）
├── setting.html            # 歐林 NPC 配置（可獨立開啟，亦被主遊戲以 iframe 嵌入）
├── cash_pay.html           # 天幣儲值
├── refine_table.html       # 精煉機率查詢表（新分頁）
├── logout.html             # 登出片尾動畫
│
├── assets/
│   ├── js/
│   │   ├── nav3d.js        # 純導航邏輯（無 DOM、無 Babylon，可被 Node 測試）
│   │   ├── scene3d.js      # 純 Babylon 呈現層
│   │   └── credits.js      # 登出片尾名單資料
│   └── data/
│       └── refine_rates.json  # 精煉機率設定（執行期 fetch，可獨立調整）
│
├── start.cjs               # 跨平台啟動腳本（動態 port + 自動開瀏覽器）
├── start.bat               # Windows 一鍵啟動
├── start.sh                # macOS / Linux 一鍵啟動
├── serve.json              # serve 設定（no-store 防快取）
│
├── static/                 # 背景圖、BGM（login / game / logout）
├── lineage_jpg/            # 遊戲場景圖素材
│
├── tests/
│   └── nav3d.test.mjs      # nav3d.js 的 Node 單元測試（10 項）
│
└── docs/                   # 中文設計文件
    ├── 01_game_vision.md ~ 08_ui_graphics.md
    └── adr/                # 架構決策紀錄
        ├── 0001-babylon-3d-isometric-scene.md
        └── 0002-rebuild-navigation-in-3d.md
```

---

## 頁面流程

```
index.html
  └─→ login.html          輸入角色名稱登入
        └─→ lineage.html  主遊戲（需登入，否則跳回 login）
              ├─⊞ setting.html        歐林配置（以 iframe 嵌入，3D 場景保留在背後）
              ├─→ cash_pay.html       天幣儲值（驗證登入）
              ├─→ refine_table.html   機率查詢（新分頁）
              └─→ logout.html         登出片尾
```

所有頁面在 `onMounted` 檢查 `localStorage` 的 `lineage_player.loggedIn`，未登入則強制跳回 `login.html`。

**設定頁特例**：`lineage.html` 的「⚙ 配置」以 **iframe** 嵌入 `setting.html`（不跳頁，3D 場景保留在背後）。`setting.html` 偵測自己是否被嵌入（`window.self !== window.top`）：嵌入時用 `postMessage`（`lineage-setting-saved` / `lineage-setting-live`）與父頁溝通做即時預覽與存檔後關閉；獨立開啟時則維持整頁跳轉行為。

---

## 技術架構

| 項目 | 技術 |
|------|------|
| 前端框架 | Vue 3（CDN 載入，Composition API，無建置步驟） |
| 3D 場景 | Babylon.js（CDN）— 正交相機 2.5D 等角 |
| 樣式 | 純 CSS3（Flexbox / Grid） |
| 資料儲存 | `localStorage`（純前端，無後端） |
| 機率設定 | `assets/data/refine_rates.json`（執行期 fetch） |
| 測試 | Node 內建 test runner（`node --test`） |

**無任何建置工具**：所有 `.html` 直接在瀏覽器執行，Vue 3 與 Babylon.js 從 CDN 載入。新增邏輯請使用純瀏覽器相容 JS，不可引入 TypeScript、JSX 或 ES module bundler。

3D 場景相依以 classic `<script>` 載入，順序固定：**Babylon CDN → `assets/js/nav3d.js` → `assets/js/scene3d.js` → 頁面內 inline app**。`nav3d.js` / `scene3d.js` 各為 IIFE，只掛 `globalThis.Nav3D` / `globalThis.Scene3D`。

---

## 3D 場景三層架構

3D 場景刻意拆成「邏輯／呈現／黏合」三層，責任分明：

### 1. `assets/js/nav3d.js` — 純導航邏輯

- **無 DOM、無 Babylon**，因此能被 `tests/nav3d.test.mjs` 以 Node import 測試。
- `TILEMAP` 是**地圖的唯一真值來源**：A* 導航網格與 3D 牆面幾何都由它生成。改地圖只改這個字串陣列。
  - 圖例：`#`牆 `.`地板 `S`起點 `O`歐林 `C`營火 `t`火把 `P`柱子。
- 提供：`walkable()`、A* `findPath()`（含視線平滑）、`canStep()` 碰撞、座標轉換 `logicToWorld` / `worldToLogic`。
- **無物理引擎**（見 `docs/adr/0002`）：碰撞用射線／網格判定。

### 2. `assets/js/scene3d.js` — 純 Babylon 呈現

- `createScene(canvas, opts)` 回傳 `sceneApi`：`setPlayer`、`setOlin`、`setNavPath`、`setCameraMode`、`setBrightness`、`dispose`。
- 正交相機（2.5D 等角，俯角鎖定）；`cameraMode` 為 `'fixed'` | `'rotatable'`。
- 多盞點光源（火把／營火）逐像素打光，放大時是效能熱點。

### 3. `lineage.html` — Vue app + 遊戲迴圈（黏合層）

- 持有世界座標 `(wx, wy)`，`logicLoop` 每幀以 `nav3d` 算移動／尋路，再透過 `sceneApi` 餵位置給 `scene3d`。
- 移動採 **delta-time**：`_moveStep = SPEED × dtFactor`，FPS 起伏時實際速度不變（夾上限避免穿牆）。

**座標系**：邏輯像素 `(wx, wy)`（以 `TILE_PX=40` 的 tilemap 為準）對上 Babylon 世界單位（`WORLD_SCALE=0.04`、地圖以原點為中心、邏輯南方 = `-Z`），兩者以 `logicToWorld` / `worldToLogic` 互轉。

---

## 資料層設計

所有遊戲狀態存於 `localStorage`：

### `lineage_player`

```json
{
  "name": "Tiger",
  "gold": 10000000,
  "server": "s1",
  "loggedIn": true,
  "loginTime": 1718000000000
}
```

### `lineage_inventory`

100 格背包，陣列索引即格子位置：

```json
[
  { "id": "w001", "name": "長劍", "type": "weapon", "enhance": 5 },
  { "id": "s001", "name": "祝福卷軸", "type": "scroll_weapon", "scrollType": "blessed" },
  null
]
```

物品 `type` 可為：`weapon` / `armor` / `scroll_weapon` / `scroll_armor` / 消耗品

### `lineage_config`

```json
{
  "maxEnhLevel": 20,
  "brightness": 70,
  "cameraMode": "fixed",
  "priceConfig": {
    "weapon": { "1": 1000, "5": 5000, "10": 50000 },
    "armor":  { "1": 800,  "5": 4000 },
    "twdRate": 100
  }
}
```

> 寫 `lineage_config` 時務必用 `...prev` 展開保留既有欄位，避免不同頁互相覆寫（例如 `cameraMode` 被設定頁以外的頁面洗掉）。

---

## 精煉系統

精煉核心邏輯詳見 [`docs/06_refine_system.md`](docs/06_refine_system.md)。機率資料與程式分離，存於 [`assets/data/refine_rates.json`](assets/data/refine_rates.json)（執行期 fetch，失敗則用內建預設值）。

### 機率設定（`assets/data/refine_rates.json`）

```json
{
  "scroll_bonus": { "normal": 0, "blessed": 20, "cursed": 40 },
  "weapon": {
    "safe_level": 6,
    "rates": [
      { "from": 0, "to": 1, "base": 100, "safe": true },
      { "from": 6, "to": 7, "base": 77,  "safe": false }
    ]
  },
  "armor": {
    "safe_level": 4,
    "rates": [ "..." ]
  }
}
```

- `base`：基礎成功率（0–100，支援小數）
- `safe`：安定範圍內成功率固定 100%，不受卷軸加成影響
- 卷軸 `scroll_bonus` 直接疊加到 `base`，並 clamp 至 100

### 安定值

| 類型 | 安定範圍 |
|------|----------|
| 武器 | +0 ~ +5（safe_level = 6） |
| 防具 | +0 ~ +3（safe_level = 4） |

### 強化費用

```
每次強化費用 = 500 × 2^(當前等級)  天幣
```

### 卷軸效果

| 卷軸 | 成功 | 失敗 |
|------|------|------|
| 普通 | +1 | 裝備消失 |
| 祝福 | 50% +1 / 50% +2 | 裝備消失 |
| 詛咒 | -1（+40% 成功率加成） | 必爆炸 |

---

## 功能一覽

### 3D 等角場景

- Babylon.js 正交相機 2.5D 地城，玩家點地走動、A* 自動尋路、與歐林 NPC 互動。
- 火把／營火點光源、亮度可調（`brightness`）、相機可鎖定或旋轉（`cameraMode`）。
- 內建小地圖（minimap）。

### 背包系統

- 100 格（5×20），支援依類型 / 名稱 / 強化等級排序
- **鐵鎚模式**：點卷軸啟動 → 再點裝備格即自動強化，適合批量操作
- 右鍵快速操作：直接強化 / 直接出售

### 歐林配置（`setting.html`）

可設定各強化等級的牌價與玩家自訂售價、最高強化等級、亮度、相機模式。以 iframe 嵌入主遊戲做即時預覽。

### 天幣儲值（`cash_pay.html`）

預設匯率 1 TWD = 100 Gold。

### 精煉機率表（`refine_table.html`）

顏色標示各階段機率（綠 100% / 黃 ≥44% / 橘 ≥11% / 紅 ≤5%），並標示機率來源是 JSON 或內建預設。

---

## 測試

`nav3d.js` 為純邏輯，可在 Node 直接測試：

```bash
node --test tests/nav3d.test.mjs   # 10 項全部應通過
```

測試涵蓋 tilemap 解析、`walkable`、A* `findPath`、`canStep` 碰撞、`logicToWorld` / `worldToLogic` 往返等。

---

## UI 設計系統

天堂沙漠風格主題，所有頁面共享同一組 CSS 變數：

```css
--gold:   #c8a84b   /* 主要金色 */
--gold2:  #f0d060   /* 亮金 / 標題 */
--panel:  #150e06   /* 深色面板背景 */
--border: #6a4420   /* 面板邊框 */
--text:   #e8d5a0   /* 內文 */
--red:    #cc2222
--green:  #22aa44
```

強化結果動畫：成功（黃金光環 + 粒子）、失敗（紅色飄散）、爆炸（旋轉縮放爆炸）。

> Vue 範本閃現防護：`#app` 保留 `v-cloak`（搭配 `[v-cloak]{display:none}` 與 `#preboot` 靜態載入層），避免掛載前 `{{ }}` 原始範本外露。

---

## 關鍵限制（違反會壞）

- **不可有建置步驟**：只能寫純瀏覽器相容 JS。
- **`nav3d.js` 必須維持「無 DOM、無 Babylon」**：否則無法被 Node 測試、破壞邏輯／呈現分離。
- **`nav3d.js` / `scene3d.js` 以 classic `<script>` 全域載入**，載入順序固定（見技術架構）。
- **務必透過 HTTP 開啟**，否則 `refine_rates.json` 的 fetch 會 CORS 降級。

詳見 [`CLAUDE.md`](CLAUDE.md)、[`CONTEXT.md`](CONTEXT.md)（場景／相機統一詞彙）與 [`docs/adr/`](docs/adr/)。

---

## 未來規劃

- [ ] 角色選擇系統（採用 Babylon 的主因之一，見 `docs/adr/0001`）
- [ ] 裝備圖鑑系統
- [ ] 稀有武器掉落
- [ ] 強化統計分析
- [ ] 雲端存檔
- [ ] 世界排行榜

---

## License

MIT — 僅供學習、研究及遊戲系統設計展示用途。
