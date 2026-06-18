# 天堂：經典版（Lineage Classic）精煉裝備前端遊戲

> 基於 Vue 3 開發的純前端裝備強化模擬遊戲，重現《天堂 Lineage》經典武器、防具精煉體驗。

![Vue](https://img.shields.io/badge/Vue-3.4.21-42b883)
![Frontend](https://img.shields.io/badge/Frontend-Pure%20Frontend-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Storage](https://img.shields.io/badge/Storage-localStorage-orange)

---

## 專案介紹

這是一款以《天堂》裝備強化系統為核心玩法的前端模擬遊戲。

玩家可透過購買卷軸、強化武器與防具、出售裝備獲取天幣，並挑戰高等級精煉帶來的刺激感與收益。

本專案採用：

* Vue 3 Reactive State
* 純 HTML + CSS + JavaScript
* localStorage 資料持久化
* JSON 機率配置驅動

無需後端即可完整運行。

---

# 功能特色

## 裝備強化系統

支援：

* 武器強化（+0 ~ +20）
* 防具強化（+0 ~ +20）
* 普通卷軸
* 祝福卷軸
* 詛咒卷軸

### 安定值

| 類型 | 安定範圍    |
| -- | ------- |
| 武器 | +0 ~ +5 |
| 防具 | +0 ~ +3 |

安定範圍內強化成功率為：

```text
100%
```

---

### 卷軸效果

#### 普通卷軸

成功：

```text
+1
```

失敗：

```text
裝備消失
```

---

#### 祝福卷軸

成功：

```text
50% +1
50% +2
```

失敗：

```text
裝備消失
```

---

#### 詛咒卷軸

成功：

```text
裝備 -1
```

失敗：

```text
裝備消失
```

額外提供：

```text
+40% 成功率加成
```

---

## 100 格擴充背包

背包容量：

```text
100 Slots
```

排列方式：

```text
5 × 20 Grid
```

支援：

* 預設排序
* 依類型排序
* 依名稱排序
* 依強化等級排序

快速操作：

* 直接強化
* 直接出售
* 鐵鎚模式

---

## 鐵鎚模式

為大量強化而設計。

啟動後：

```text
🔨 點擊卷軸
→ 點擊裝備
→ 自動執行強化
```

畫面提示：

```text
🔨 祝福卷軸 ─ 點擊武器格子 │ Esc 取消
```

適合：

* 衝高武器
* 批量點裝
* 減少重複操作

---

## 歐林收購系統

可自訂：

* 各等級牌價
* 玩家售價
* 精煉上限

例如：

| 等級  | 收購價    |
| --- | ------ |
| +1  | 1,000  |
| +5  | 5,000  |
| +10 | 50,000 |
| +20 | 自訂     |

售價可高於牌價。

---

## 天幣儲值系統

預設匯率：

```text
1 TWD = 100 Gold
```

支援快速金額：

```text
100
300
500
1000
3000
5000
10000
...
100000
```

最大儲值：

```text
100,000 元
=
10,000,000 Gold
```

---

## 精煉機率查詢

提供獨立頁面：

```text
refine_table.html
```

可查詢：

* 基礎成功率
* 卷軸加成後成功率
* 各階段精煉機率

顏色標示：

| 顏色 | 意義   |
| -- | ---- |
| 綠色 | 100% |
| 黃色 | ≥44% |
| 橘色 | ≥11% |
| 紅色 | ≤5%  |

---

# 技術架構

| 項目   | 技術             |
| ---- | -------------- |
| 前端框架 | Vue 3.4.21     |
| UI   | HTML5          |
| 樣式   | CSS3           |
| 版面   | Flexbox / Grid |
| 資料配置 | JSON           |
| 資料儲存 | localStorage   |
| 字體   | Noto Serif TC  |
| 數字字體 | Noto Sans Mono |

---

# 專案結構

```text
lineage-refine/
│
├── lineage-refine.html
├── login.html
├── refine_table.html
├── setting.html
├── cash_pay.html
│
├── refine_rates.json
├── readme.md
│
├── lineage_jpg/
│   ├── lineage_chat.jpg
│   ├── lineage_frame.jpg
│   ├── lineage_login.gif
│   ├── lineage_role.png
│   └── lineage_room.jpg
│
├── docs/
├── data/
│
└── .claude/
    └── settings.local.json
```

---

# refine_rates.json

所有精煉機率皆由 JSON 控制。

範例：

```json
{
  "scroll_bonus": {
    "normal": 0,
    "blessed": 20,
    "cursed": 40
  },

  "weapon": {
    "safe_level": 6,
    "rates": [
      {
        "from": 6,
        "to": 7,
        "base": 77
      }
    ]
  }
}
```

優點：

* 無須修改程式碼
* 可自由調整成功率
* 可客製私服版本規則

---

# 遊戲資料儲存

所有資料透過 localStorage 保存。

## 玩家資訊

```json
{
  "name": "Tiger",
  "gold": 10000000,
  "server": "s1",
  "loggedIn": true
}
```

---

## 背包資料

```json
[
  {
    "name": "長劍",
    "type": "weapon",
    "enhance": 5
  }
]
```

---

## 價格設定

```json
{
  "priceConfig": {
    "weapon": {},
    "armor": {}
  }
}
```

---

# UI 設計風格

主題：

```text
天堂經典沙漠風格
```

色彩配置：

```css
--gold: #c8a84b;
--gold2: #f0d060;

--dark: #0a0704;

--panel: #150e06;
--panel2: #1c1208;

--border: #6a4420;

--text: #e8d5a0;

--red: #cc2222;
--green: #22aa44;
```

---

# 動畫效果

## 強化成功

```text
✨ 黃金光環
✨ 浮動文字
✨ 粒子效果
```

---

## 強化失敗

```text
💨 紅色飄散效果
```

---

## 裝備爆炸

```text
💥 旋轉
💥 縮放
💥 爆炸動畫
```

---

# 執行方式

## 方法一：直接開啟

```text
login.html
```

推薦：

* Chrome
* Edge
* Firefox

---

## 方法二：本地 HTTP Server

```bash
python -m http.server 8000
```

瀏覽：

```text
http://localhost:8000/login.html
```

---

# 頁面說明

| 頁面                  | 功能   |
| ------------------- | ---- |
| login.html          | 玩家登入 |
| lineage-refine.html | 主遊戲  |
| refine_table.html   | 機率查詢 |
| setting.html        | 收購配置 |
| cash_pay.html       | 天幣儲值 |

index.html          入口 → 自動轉址 login.html
login.html          登入 → lineage.html
lineage.html        主遊戲（需登入）
  ├─ setting.html     配置（驗證玩家ID）
  ├─ cash_pay.html    儲值（驗證玩家ID）
  └─ refine_table.html 機率表（新分頁，免驗證）
refine_rates.json   後台機率設定（開發人員可改）

---

# 遊戲流程

```text
登入
 ↓
進入遊戲
 ↓
購買卷軸
 ↓
強化裝備
 ↓
出售裝備
 ↓
獲得天幣
 ↓
挑戰更高精煉
```

---

# 核心特色

### 資料驅動

所有精煉規則皆可透過 JSON 調整。

### 純前端架構

無需資料庫、API 或伺服器。

### 天堂經典玩法

重現玩家最熟悉的衝裝刺激感。

### 完整經濟系統

包含：

* 金幣
* 卷軸
* 收購
* 售價
* 儲值

### Vue 3 Reactive UI

即時更新：

* 背包
* 金額
* 強化結果
* 訊息紀錄

---

# 未來規劃

* [ ] 裝備圖鑑系統
* [ ] 稀有武器掉落
* [ ] 世界排行榜
* [ ] 強化統計分析
* [ ] 雲端存檔
* [ ] 多伺服器資料同步
* [ ] 公會系統
* [ ] 拍賣交易所

---

# License

MIT License

僅供學習、研究及遊戲系統設計展示用途。
