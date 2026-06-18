# 05 — 背包管理的設計

> **版本**：v1.0 | **日期**：2026-06-17 | **狀態**：草稿

---

## 1. 背包格局設計

### 尺寸規格

```
總格數：100 格
排列方式：5 欄 × 20 列（Column-first 展示）
格子尺寸：64px × 64px
間距：4px
```

### 視覺佈局

```
┌────┬────┬────┬────┬────┐
│ 01 │ 02 │ 03 │ 04 │ 05 │
├────┼────┼────┼────┼────┤
│ 06 │ 07 │ 08 │ 09 │ 10 │
├────┼────┼────┼────┼────┤
│ 11 │ 12 │ .. │ .. │ .. │
│         （共 20 列）     │
│ 96 │ 97 │ 98 │ 99 │100 │
└────┴────┴────┴────┴────┘
```

---

## 2. 物品類型與圖示

| 類型 | type 值 | 圖示 | 說明 |
|------|---------|------|------|
| 武器 | `weapon` | ⚔ | 可精煉，+0~+20 |
| 防具 | `armor` | 🛡 | 可精煉，+0~+20 |
| 普通卷軸（武器） | `scroll_weapon` | 📜 | 用於武器精煉 |
| 普通卷軸（防具） | `scroll_armor` | 📜 | 用於防具精煉 |
| 祝福卷軸（武器） | `scroll_weapon_blessed` | ✨📜 | `blessed: true` |
| 祝福卷軸（防具） | `scroll_armor_blessed` | ✨📜 | `blessed: true` |
| 詛咒卷軸（武器） | `scroll_weapon_cursed` | 💀📜 | `cursed: true` |
| 詛咒卷軸（防具） | `scroll_armor_cursed` | 💀📜 | `cursed: true` |

---

## 3. 格子狀態視覺

### 四種格子狀態

```css
/* 空格 */
.slot-empty {
  background: rgba(10, 7, 4, 0.5);
  border: 1px solid #3a2210;
}

/* 有物品（一般） */
.slot-item {
  background: var(--panel2);   /* #1c1208 */
  border: 1px solid var(--border);   /* #6a4420 */
  cursor: pointer;
}

/* 選中狀態 */
.slot-item.selected {
  border: 2px solid var(--gold2);  /* #f0d060 */
  box-shadow: 0 0 8px rgba(240, 208, 96, 0.6);
}

/* 鐵鎚模式可用目標 */
.slot-item.hammer-target {
  border: 2px solid var(--green);  /* #22aa44 */
  animation: pulse 1s infinite;
}
```

### 精煉等級徽章

裝備格子右下角顯示精煉等級（+1 以上才顯示）：

```css
.enhance-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 10px;
  color: var(--gold2);
  font-weight: bold;
  background: rgba(0,0,0,0.7);
  padding: 1px 3px;
  border-radius: 2px;
}
```

等級顏色分級：

| 精煉等級 | 徽章顏色 |
|---------|---------|
| +1 ~ +5 | `#e8d5a0`（米黃） |
| +6 ~ +9 | `#22aa44`（綠） |
| +10 ~ +12 | `#c8a84b`（金） |
| +13 ~ +15 | `#f0d060`（亮金） |
| +16 ~ +20 | `#cc2222`（紅，稀有） |

---

## 4. 排序功能

### 排序選項

```
[預設] [依類型] [依名稱] [依精煉等級]
```

| 排序方式 | 排序邏輯 |
|---------|---------|
| 預設 | 依加入時間（index 不變） |
| 依類型 | weapon → armor → scroll（按 type 字母排序） |
| 依名稱 | 依 `item.name` 中文字典序 |
| 依精煉等級 | 依 `item.enhance` 降冪（+20 在前） |

排序後重新填充 100 格陣列，空格自動補至末尾。

---

## 5. 快速操作

### 點選格子後顯示操作列

```
選中武器格子後，下方顯示：

┌─────────────┬──────────────┬──────────────┐
│   直接強化   │    出售裝備   │    取消選取   │
│  [花費 500] │ [獲得 5,000] │              │
└─────────────┴──────────────┴──────────────┘
```

### 直接強化

- 不使用卷軸，依基礎成功率強化
- 顯示預計費用（依精煉等級累進）
- 費用不足時按鈕 disabled 並顯示「天幣不足」

### 出售裝備

- 依歐林牌價計算售價（`priceConfig.weapon.list[enhance]`）
- 若玩家設定了自訂售價（`sell[]`），取兩者較高值
- 顯示「獲得 X 天幣」確認後執行

---

## 6. 鐵鎚模式整合

### 啟動方式

1. 在背包中點擊卷軸格子
2. 確認選擇後進入鐵鎚模式（`hammerMode.active = true`）
3. 游標變更為鐵鎚圖示

### 模式內行為

```javascript
hammerMode: {
  active: true,
  scrollIdx: 3,           // 使用的卷軸在背包中的索引
  target: 'weapon',       // 目標類型（weapon | armor）
  isCursed: false,        // 是否為詛咒卷軸
  isBlessed: true         // 是否為祝福卷軸
}
```

- 背包中符合目標類型的格子顯示綠色脈衝邊框
- 點擊目標格子 → 立即執行精煉
- Esc 鍵取消鐵鎚模式

---

## 7. 邊界處理

| 情境 | 處理方式 |
|------|---------|
| 背包已滿（100/100） | 商店購買時提示「背包已滿，請先整理背包」 |
| 出售後空格 | 格子設為 null，視覺顯示空格狀態 |
| 精煉爆炸 | 裝備從背包移除（設為 null），播放爆炸動畫 |
| 強化成功到 +1 以上 | 格子更新 enhance 值，徽章立即更新 |
| 卷軸使用後 | 卷軸格子設為 null |

---

## 8. localStorage 序列化結構

```javascript
// lineage_inventory — Array(100)
// null 代表空格，物品為物件
[
  {
    name: "長劍",
    type: "weapon",
    enhance: 7,
    icon: "⚔",
    basePrice: 1000
  },
  {
    name: "皮革鎧甲",
    type: "armor",
    enhance: 3,
    icon: "🛡",
    basePrice: 800
  },
  {
    name: "武器強化卷軸",
    type: "scroll_weapon",
    icon: "📜",
    blessed: false,
    cursed: false,
    quantity: 1
  },
  null,    // 空格
  null,    // 空格
  // ... 共 100 個元素
]
```

---

## 9. 背包面板 UI 規格

```
面板尺寸：寬 380px，高 90vh（可捲動）
標題列：「🎒 背包 (已使用 X / 100 格)」
排序按鈕：標題列右側
格子區域：5 欄網格，flex-wrap
物品提示：hover 時顯示物品名稱 + 精煉等級 tooltip
操作列：選中格子時固定顯示於面板底部
```
