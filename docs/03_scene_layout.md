# 03 — 遊戲中的場景配置 + 按鈕部屬

> **版本**：v1.0 | **日期**：2026-06-17 | **狀態**：草稿

---

## 1. 主場景圖層架構

主遊戲頁面（`lineage-refine.html`）採多圖層疊加方式構建：

```
z-index 層級（由下至上）
┌────────────────────────────────────────────┐
│ z:0  背景層    lineage_room.jpg            │
│ z:1  裝飾框層  lineage_frame.jpg           │
│ z:2  角色層    lineage_role.png（右下角）   │
│ z:3  NPC 對話  lineage_chat.jpg（左下角）  │
│ z:10 HUD 層    頂部資訊列                  │
│ z:20 UI 面板   背包/商店/精煉等模態視窗     │
│ z:30 鐵鎚覆蓋  鐵鎚模式全螢幕提示層        │
│ z:99 彈窗      精煉結果彈窗（最上層）       │
└────────────────────────────────────────────┘
```

---

## 2. 場景區域分布

```
┌──────────────────────────────────────────────────┐
│  [HUD 上方列]  角色名 │ 💰 天幣 │ ⚙ 精煉上限     │
├──────────────────────────────────────────────────┤
│                                                  │
│  [場景背景]  lineage_room.jpg                    │
│                                                  │
│  ┌──────────────┐                 ┌───────────┐  │
│  │ NPC 對話區   │                 │ 角色立繪  │  │
│  │ lineage_chat │                 │ role.png  │  │
│  └──────────────┘                 └───────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  [按鈕列]  🎒 背包 │ 🏪 商店 │ 🔨 精煉 │ 💳 儲值  │
├──────────────────────────────────────────────────┤
│  [訊息日誌]  左下角，遊戲事件捲動紀錄             │
└──────────────────────────────────────────────────┘
```

---

## 3. HUD 上方列規格

### 顯示元素

| 元素 | 位置 | 內容 | 更新時機 |
|------|------|------|---------|
| 角色名稱 | 左側 | `{charName} @ {server}` | 登入時固定 |
| 天幣餘額 | 中央 | `💰 {gold.toLocaleString()} 天幣` | 每次交易後即時更新 |
| 精煉上限 | 右側 | `精煉上限：+{maxEnhLevel}` | 配置更新後即時更新 |

### HUD 樣式規格

```css
.hud-bar {
  height: 48px;
  background: linear-gradient(180deg, #1c1208 0%, #0a0704 100%);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 24px;
}
```

---

## 4. 功能按鈕群組部屬

### 主要按鈕（底部固定列）

```
┌──────┬──────┬──────┬──────┐
│ 🎒   │ 🏪   │ 🔨   │ 💳   │
│ 背包 │ 商店 │ 精煉 │ 儲值 │
└──────┴──────┴──────┴──────┘
```

| 按鈕 | 圖示 | 功能 | 觸發 UI |
|------|------|------|---------|
| 背包 | 🎒 | 開啟背包面板 | `ui.inventory = true` |
| 商店 | 🏪 | 開啟購買卷軸商店 | `ui.shop = true` |
| 精煉 | 🔨 | 開啟精煉操作面板 | `ui.enhance = true` |
| 儲值 | 💳 | 跳轉儲值頁面 | `location.href = 'cash_pay.html'` |

### 次要按鈕（場景內或 HUD 輔助）

| 按鈕 | 功能 | 位置 |
|------|------|------|
| 精煉機率表 | 跳轉 `refine_table.html` | HUD 右側或精煉面板內 |
| 歐林配置 | 跳轉 `setting.html` | HUD 設定圖示 ⚙ |

### 按鈕樣式規格

```css
.action-btn {
  padding: 10px 20px;
  background: var(--gold);        /* #c8a84b */
  color: var(--dark);             /* #0a0704 */
  border: none;
  border-radius: 3px;
  font-family: 'Noto Serif TC', serif;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.action-btn:hover {
  background: var(--gold2);       /* #f0d060 */
}
```

---

## 5. NPC 對話系統

### 觸發流程

```
玩家進入場景
      ↓
NPC 自動觸發開場對話
      ↓
對話框顯示（lineage_chat.jpg 為背景）
      ↓
對話內容依遊戲狀態動態變化：
  - 首次登入：引導精煉教學
  - 一般狀態：隨機提示語
  - 精煉成功後：恭賀語
  - 爆炸後：安慰語
      ↓
點擊對話框 或 按 Space 繼續/關閉
```

### 對話框規格

```css
.npc-chat {
  position: absolute;
  bottom: 80px;
  left: 20px;
  width: 320px;
  min-height: 80px;
  background-image: url('lineage_jpg/lineage_chat.jpg');
  background-size: cover;
  padding: 16px 20px;
  color: var(--text);             /* #e8d5a0 */
  font-size: 13px;
  line-height: 1.6;
}
```

---

## 6. 訊息日誌區域

### 位置與規格

```
位置：場景左下角，NPC 對話框下方
高度：可配置，預設顯示 5 行
寬度：320px（與 NPC 對話框同寬）
```

### 功能規格

- 顯示所有遊戲事件：精煉結果、購買記錄、儲值紀錄
- 時間戳記：`HH:MM:SS` 格式前綴
- 字體大小可縮放：支援 `1x ~ 10x` 調整（`ctrl+滾輪` 或 UI 按鈕）
- 自動捲動至最新訊息
- 顏色分類：
  - 成功事件：`--green` `#22aa44`
  - 失敗/爆炸事件：`--red` `#cc2222`
  - 一般資訊：`--text` `#e8d5a0`
  - 系統訊息：`--gold` `#c8a84b`

---

## 7. 鐵鎚模式覆蓋層

啟動鐵鎚模式後，全螢幕覆蓋一層互動提示：

```css
.hammer-overlay {
  position: fixed;
  inset: 0;
  cursor: url('hammer.cur'), crosshair;  /* 鐵鎚游標 */
  z-index: 30;
  background: rgba(0, 0, 0, 0.1);
}
```

### 浮動提示規格

```
浮動提示跟隨滑鼠位置顯示：
「🔨 祝福卷軸 ─ 點擊武器格子 │ Esc 取消」

- 字體：14px，金色
- 背景：半透明深色
- 偏移：游標右下方 12px
- Esc 鍵：取消鐵鎚模式
```

---

## 8. RWD 響應式規格

| 斷點 | 寬度 | 佈局調整 |
|------|------|---------|
| 桌面（預設） | ≥ 1024px | 完整佈局，所有元素全顯示 |
| 平板 | 768px ~ 1023px | 按鈕縮小、訊息日誌收起 |
| 最小支援 | 900px | 低於此寬度顯示提示「建議使用桌面瀏覽器」 |
| 行動裝置 | < 768px | 不支援（提示使用桌面） |

---

## 9. 模態視窗規格（通用）

所有面板（背包、商店、精煉）均以模態視窗呈現：

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-panel {
  background: var(--panel);       /* #150e06 */
  border: 1px solid var(--border);/* #6a4420 */
  border-radius: 4px;
  padding: 24px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}
```

關閉方式：點擊遮罩背景 或 面板右上角 `✕` 按鈕。
