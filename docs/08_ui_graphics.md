# 08 — 畫面中的圖案設計

> **版本**：v1.0 | **日期**：2026-06-17 | **狀態**：草稿

---

## 1. 圖片資產清單

所有圖片資源位於 `lineage_jpg/` 目錄：

| 檔案 | 格式 | 用途 | 使用頁面 |
|------|------|------|---------|
| `lineage_login.gif` | GIF（動態） | 登入頁全螢幕背景動畫 | `login.html` |
| `lineage_room.jpg` | JPEG | 主遊戲場景背景（城堡房間） | `lineage-refine.html` |
| `lineage_role.png` | PNG（透明底） | 玩家角色立繪，右下角固定 | `lineage-refine.html` |
| `lineage_frame.jpg` | JPEG | UI 邊框/面板裝飾背景 | `lineage-refine.html` |
| `lineage_chat.jpg` | JPEG | NPC 對話框背景圖 | `lineage-refine.html` |

### 圖片使用規格

```css
/* 登入頁背景 */
.login-bg {
  background-image: url('lineage_jpg/lineage_login.gif');
  background-size: cover;
  background-position: center;
}

/* 主場景背景 */
.game-bg {
  background-image: url('lineage_jpg/lineage_room.jpg');
  background-size: cover;
  background-position: center bottom;
}

/* 角色立繪 */
.player-role {
  position: absolute;
  right: 20px;
  bottom: 80px;
  width: 180px;
  height: auto;
  image-rendering: crisp-edges;  /* 像素風格銳化 */
}

/* NPC 對話框 */
.npc-chat-bg {
  background-image: url('lineage_jpg/lineage_chat.jpg');
  background-size: 100% 100%;    /* 拉伸填滿 */
}
```

---

## 2. CSS 色彩系統完整規格

所有色彩使用 CSS 自訂屬性（Design Token），定義於 `:root`：

```css
:root {
  /* 主要色彩 */
  --gold:    #c8a84b;   /* 古金色  — 主色調、按鈕背景、邊框強調 */
  --gold2:   #f0d060;   /* 明亮金色 — hover 狀態、成功文字、徽章高亮 */

  /* 背景層次 */
  --dark:    #0a0704;   /* 最深黑  — 頁面底色 */
  --panel:   #150e06;   /* 深棕色  — 面板、登入框、模態背景 */
  --panel2:  #1c1208;   /* 次深棕  — 格子背景、次級面板 */

  /* 邊框 */
  --border:  #6a4420;   /* 棕色    — 面板邊框、分隔線、格子邊框 */

  /* 文字 */
  --text:    #e8d5a0;   /* 米黃色  — 主要文字、標籤、說明 */
  --text2:   #a08050;   /* 暗米黃  — 次要文字、placeholder */

  /* 狀態色 */
  --red:     #cc2222;   /* 失敗紅  — 爆炸、失敗、錯誤訊息 */
  --green:   #22aa44;   /* 成功綠  — 安定、成功、確認 */
  --blue:    #2255cc;   /* 資訊藍  — 系統提示（保留） */
}
```

### 色彩對照與情境

| 色彩 | 情境 |
|------|------|
| `--gold` | 登入按鈕、主要動作按鈕、HUD 天幣顯示 |
| `--gold2` | 按鈕 hover、精煉成功浮字、等級徽章（+10~+12）|
| `--dark` | 頁面背景、最底層色 |
| `--panel` | 登入框、模態面板、NPC 對話底色 |
| `--panel2` | 背包格子、商店格子背景 |
| `--border` | 所有邊框（面板、格子、按鈕） |
| `--text` | 角色名稱、天幣數字、一般說明 |
| `--red` | 爆炸動畫文字、失敗訊息、錯誤提示 |
| `--green` | 安定等級標示、成功訊息、鐵鎚目標格子邊框 |

---

## 3. 字體設計規格

```css
/* Google Fonts 引入 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&family=Noto+Sans+Mono:wght@400;700&display=swap');

/* 使用規則 */
body {
  font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
}

.number, .gold-amount, .enhance-level {
  font-family: 'Noto Sans Mono', monospace;  /* 數字等寬，對齊美觀 */
}
```

| 字體 | 用途 | 風格 |
|------|------|------|
| `Noto Serif TC` | 中文文字、標題、對話、按鈕 | 襯線字體，古典感 |
| `Noto Sans Mono` | 天幣數字、機率百分比、精煉等級 | 等寬字體，數字對齊 |
| `Microsoft JhengHei` | Fallback（無網路時） | 系統字體 |

---

## 4. 圖示（Emoji）物品系統

遊戲物品不使用圖片，採 Unicode Emoji 作為圖示，確保跨平台一致性：

### 物品圖示

| Emoji | 物品類型 | 說明 |
|-------|---------|------|
| ⚔ | 武器 | 所有可精煉武器 |
| 🛡 | 防具 | 所有可精煉防具 |
| 📜 | 普通卷軸 | 武器/防具均用 📜 |
| ✨📜 | 祝福卷軸 | 前綴 ✨ 標示祝福屬性 |
| 💀📜 | 詛咒卷軸 | 前綴 💀 標示詛咒屬性 |
| 💰 | 天幣 | HUD 天幣顯示、訊息日誌 |
| 🎒 | 背包 | 背包按鈕圖示 |
| 🏪 | 商店 | 商店按鈕圖示 |
| 🔨 | 精煉/鐵鎚 | 精煉按鈕、鐵鎚模式 |
| 💳 | 儲值 | 儲值按鈕圖示 |
| ⚙ | 設定 | 歐林配置入口 |
| 🏰 | 遊戲標題 | 登入頁標題裝飾 |

### 精煉結果圖示

| Emoji | 事件 | 動畫行為 |
|-------|------|---------|
| ✨ | 精煉成功 | 浮起 + 放大 + 金色光暈 |
| 💨 | 精煉失敗（爆炸前浮字） | 快速向上消失 |
| 💥 | 裝備爆炸 | 縮放 + 旋轉 + 擴散消失 |

---

## 5. 動畫規格

### 燭光粒子（登入頁）

```css
@keyframes candle-float {
  0%   { transform: translateY(0) scale(1); opacity: 0.7; }
  50%  { transform: translateY(-40px) scale(1.2); opacity: 0.9; }
  100% { transform: translateY(-80px) scale(0.5); opacity: 0; }
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, #f0d060, #c8a84b);
  animation: candle-float linear infinite;
  pointer-events: none;
}
```

### 精煉成功浮字

```css
@keyframes float-up {
  0%   { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-60px) scale(1.4); opacity: 0; }
}

.float-text {
  position: absolute;
  color: var(--gold2);
  font-size: 20px;
  font-weight: bold;
  animation: float-up 1.2s ease-out forwards;
  pointer-events: none;
  z-index: 50;
}
```

### 裝備爆炸動畫

```css
@keyframes explode {
  0%   { transform: scale(1) rotate(0deg); opacity: 1; }
  40%  { transform: scale(1.5) rotate(180deg); opacity: 0.8; }
  100% { transform: scale(0) rotate(360deg); opacity: 0; }
}

.slot-exploding {
  animation: explode 0.6s ease-in forwards;
}
```

### 彩色粒子掉落（精煉結果彈窗）

```css
@keyframes particle-fall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100px) rotate(720deg); opacity: 0; }
}

/* 粒子隨機顏色：金色、橘色、白色、紅色 */
.confetti {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  animation: particle-fall 1.5s ease-in forwards;
}
```

---

## 6. 版面邊框與面板規格

### 面板陰影

```css
.panel {
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(200, 168, 75, 0.2);   /* 內側金色光邊 */
}
```

### 按鈕效果

```css
.btn-primary {
  background: var(--gold);
  border: 1px solid var(--gold2);
  box-shadow: 0 2px 8px rgba(200, 168, 75, 0.3);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--gold2);
  box-shadow: 0 4px 16px rgba(240, 208, 96, 0.5);
  transform: translateY(-1px);    /* 輕微上浮 */
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(200, 168, 75, 0.3);
}
```

### 輸入框規格

```css
input[type="text"],
input[type="number"],
input[type="password"],
select {
  background: var(--dark);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 12px;
  border-radius: 3px;
  outline: none;
  transition: border-color 0.15s;
}

input:focus,
select:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px rgba(200, 168, 75, 0.2);
}
```

---

## 7. 精煉機率表色彩分級（refine_table.html）

| 成功率範圍 | 顯示顏色 | 色碼 | 說明 |
|---------|---------|------|------|
| 100% | 綠色 | `#22aa44` | 安定範圍，必定成功 |
| 44% ~ 99% | 黃色 | `#aaaa22` | 較高機率，建議嘗試 |
| 11% ~ 43% | 橙色 | `#cc6600` | 中等風險 |
| ≤ 10% | 紅色 | `#cc2222` | 高風險，需謹慎 |
