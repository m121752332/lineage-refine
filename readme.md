# 天堂：經典版 — 裝備精煉模擬器

> 純前端的《天堂 Lineage》裝備強化模擬遊戲，以 Vue 3 + localStorage 實作，無需後端即可完整執行。

![Vue](https://img.shields.io/badge/Vue-3.4.21-42b883)
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
- [資料層設計](#資料層設計)
- [精煉系統](#精煉系統)
- [功能一覽](#功能一覽)
- [UI 設計系統](#ui-設計系統)
- [未來規劃](#未來規劃)

---

## 專案簡介

重現《天堂 Lineage》裝備強化（精煉）系統的瀏覽器遊戲模擬器。玩家可購買卷軸、強化武器與防具、透過歐林 NPC 出售裝備獲取天幣，挑戰高等級精煉的機率刺激。

**設計目標：**

- 完整模擬原版精煉手感（機率、爆炸、安定值）
- 純靜態檔案部署，無需任何後端
- 機率資料與程式邏輯分離，便於客製化私服規則

---

## 快速開始

### 環境需求

僅需 Node.js（已安裝即可）與現代瀏覽器（Chrome / Edge / Firefox）。

### 一鍵啟動（推薦）

| 平台 | 方式 |
|------|------|
| **Windows** | 雙擊 `start.bat`，或在終端執行 `node start.js` |
| **macOS / Linux** | `chmod +x start.sh && ./start.sh`，或 `node start.js` |

腳本會自動執行 `npx serve .` 並在伺服器就緒後開啟瀏覽器。

### 手動啟動

```bash
npx serve .
# 然後在瀏覽器開啟 http://localhost:3000
```

> **注意：** 直接用 `file://` 開啟 HTML 會導致 `refine_rates.json` 的 CORS 錯誤，機率將降級使用程式內的預設值。

### 進入遊戲

1. 伺服器啟動後瀏覽器自動導向 `login.html`
2. 輸入角色名稱完成登入，即可進入主遊戲

---

## 專案結構

```
lineage-refine/
│
├── index.html              # 入口，自動轉址 → login.html
├── login.html              # 登入頁
├── lineage.html            # 主遊戲（~1900 行，Vue 3 單檔）
├── setting.html            # 歐林 NPC 收購價格設定
├── cash_pay.html           # 天幣儲值
├── refine_table.html       # 精煉機率查詢表
├── logout.html             # 登出片尾動畫
│
├── refine_rates.json       # 精煉機率設定（可獨立調整，無需改程式碼）
│
├── start.js                # 跨平台啟動腳本（server + 自動開瀏覽器）
├── start.bat               # Windows 一鍵啟動
├── start.sh                # macOS / Linux 一鍵啟動
│
├── static/
│   ├── login_bg.png        # 登入頁背景
│   └── bgm/
│       ├── lineage_login.mp3
│       └── lineage_game.mp3
│
├── lineage_jpg/            # 遊戲場景圖素材
│
└── docs/                   # 設計文件（中文）
    ├── 01_game_vision.md
    ├── 02_login_design.md
    ├── 03_scene_layout.md
    ├── 04_topup_system.md
    ├── 05_inventory_design.md
    ├── 06_refine_system.md   ← 精煉系統規格（最重要）
    ├── 07_product_value.md
    └── 08_ui_graphics.md
```

---

## 頁面流程

```
index.html
  └─→ login.html          輸入角色名稱登入
        └─→ lineage.html  主遊戲（需登入，否則跳回 login）
              ├─→ setting.html        歐林收購配置（驗證登入）
              ├─→ cash_pay.html       天幣儲值（驗證登入）
              ├─→ refine_table.html   機率查詢（新分頁，免驗證）
              └─→ logout.html         登出片尾
```

所有頁面在 `onMounted` 檢查 `localStorage` 的 `lineage_player.loggedIn`，未登入則強制跳回 `login.html`。

---

## 技術架構

| 項目 | 技術 |
|------|------|
| 前端框架 | Vue 3.4.21（CDN 載入，無構建步驟） |
| API 風格 | Options-free Composition API（`setup()` 模式） |
| 樣式 | 純 CSS3（Flexbox / Grid） |
| 資料儲存 | `localStorage`（純前端，無後端） |
| 機率設定 | `refine_rates.json`（執行期 fetch） |
| 字體 | Noto Serif TC / Noto Sans Mono |

**無任何構建工具**：所有 `.html` 檔案直接在瀏覽器執行，Vue 3 從 CDN 載入。新增邏輯請使用純瀏覽器相容的 JS，不可使用 TypeScript、JSX 或 ES module bundler。

---

## 資料層設計

所有遊戲狀態存於 `localStorage`，key 說明如下：

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
  "priceConfig": {
    "weapon": { "1": 1000, "5": 5000, "10": 50000 },
    "armor":  { "1": 800,  "5": 4000 },
    "twdRate": 100
  }
}
```

---

## 精煉系統

精煉核心邏輯詳見 [`docs/06_refine_system.md`](docs/06_refine_system.md)。

### 機率設定（`refine_rates.json`）

```json
{
  "scroll_bonus": {
    "normal":  0,
    "blessed": 20,
    "cursed":  40
  },
  "weapon": {
    "safe_level": 6,
    "rates": [
      { "from": 0, "to": 1, "base": 100, "safe": true },
      { "from": 6, "to": 7, "base": 77,  "safe": false }
    ]
  },
  "armor": {
    "safe_level": 4,
    "rates": [ ... ]
  }
}
```

- `base`：基礎成功率（0–100，支援 6 位小數）
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
| 詛咒 | -1（+40% 成功率加成） | 裝備消失 |

---

## 功能一覽

### 背包系統

- 100 格（5×20 格），支援依類型 / 名稱 / 強化等級排序
- **鐵鎚模式**：點擊卷軸啟動 → 再點裝備格子即自動強化，適合批量操作
- 右鍵快速操作：直接強化 / 直接出售

### 歐林收購系統（`setting.html`）

可設定各強化等級的牌價與玩家自訂售價，售價可高於牌價。

### 天幣儲值（`cash_pay.html`）

預設匯率 1 TWD = 100 Gold，最大單次儲值 100,000 元（= 1,000 萬 Gold）。

### 精煉機率表（`refine_table.html`）

顏色標示各階段機率：

| 顏色 | 意義 |
|------|------|
| 綠色 | 100% |
| 黃色 | ≥ 44% |
| 橘色 | ≥ 11% |
| 紅色 | ≤ 5% |

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

---

## 未來規劃

- [ ] 裝備圖鑑系統
- [ ] 稀有武器掉落
- [ ] 強化統計分析
- [ ] 雲端存檔
- [ ] 世界排行榜
- [ ] 公會系統 / 拍賣交易所

---

## License

MIT — 僅供學習、研究及遊戲系統設計展示用途。
