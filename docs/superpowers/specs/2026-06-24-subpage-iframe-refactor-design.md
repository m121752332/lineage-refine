# 子頁面 iframe 化重構設計

日期：2026-06-24

## 背景

`lineage.html` 的「⚙ 配置」已採 iframe 嵌入 `setting.html`（不跳頁、3D 場景保留在背後，
用 postMessage 溝通即時預覽與關閉）。但「💳 儲值」與「📊 機率表」仍是 `lineage.html` 內
hardcode 的 inline 子面板（`subPanel==='cashpay'` / `subPanel==='refine'`），完全沒用到
既有的獨立檔 `cash_pay.html` / `refine_table.html`；連已不再被按鈕呼叫的 setting inline
面板（`subPanel==='setting'`）也還留著當退路，形成大量 dead code。

## 目標

1. `cashpay`、`refine` 改為 iframe 嵌入既有獨立檔，行為對齊 setting：不跳頁、場景保留在背後。
2. 移除三套 inline 子面板與其專屬 state（dead code 清理），只保留 iframe 範式。
3. 操作三顆按鈕（💳/⚙/📊）＋儲值＋關閉，後台 console 不得噴錯。

## 設計

### lineage.html：以單一 `framePage` 取代分歧狀態

- `settingFrame`（boolean）→ `framePage`（ref：`null | 'setting' | 'cashpay' | 'refine'`）。
- 單一共用 overlay，沿用既有 `.setting-frame-*` 樣式與尺寸（`min(880px,92vw) × min(88vh,820px)`，三頁皆適用）：
  - computed `frameSrc`：`setting.html` / `cash_pay.html` / `refine_table.html`
  - computed `frameTitle`：⚙ 配置 / 💳 天幣儲值 / 📊 精煉機率表
- 函式收斂：`openFrame(page)`、`closeFrame()`（關閉後 `syncFromStorage()` 還原即時預覽，沿用現行 `closeSettingPage` 行為）。
  - `openSettingPage`→`openFrame('setting')`、`goCashPay`→`openFrame('cashpay')`、`goRefineTable`→`openFrame('refine')`。
- `logicLoop` 移動鎖：`!settingFrame.value` → `!framePage.value`（開任一覆蓋層皆鎖移動）。
- `message` handler 擴充兩個一般化訊息（保留 setting 既有 `lineage-setting-live` / `lineage-setting-saved`）：
  - `lineage-frame-close` → `closeFrame()`
  - `lineage-gold-changed` → `syncFromStorage()`（刷新父頁天幣顯示）

移除（重構後為 dead code）：HTML `sub-panel-overlay` 整塊；CSS `.sub-panel*` / `.sp-*` / `.cp-*`；
JS `subPanel`、`cpTwd/cpPresets/cpCoins`、`subSet`、`applyBrightness`、
`refineData/refineJsonLoaded/REFINE_BUILTIN`、`closeSubPanel`、`goSetting`、`doCpTopup`、
`subSetSave/subSetReset`、`loadRefineData`、`rtClamp/rtClass` 及 `return{}` 內對應綁定。
保留 `maxEnhLevel`、`priceConfig`、`cameraBrightness`、`loadConfigFrom`、`syncFromStorage`、`DEFAULT_*`。

### cash_pay.html（會改天幣）

- `const embedded = window.self !== window.top;`
- `doTopup()`：寫 localStorage 後，`embedded` 時 `postMessage('lineage-gold-changed')`；面板不關（可連續儲值），`currentGold` 本地照常更新。
- `goBack()`（返回／取消共用）：`embedded` 時 `postMessage('lineage-frame-close')`；否則跳轉 `lineage.html`。

### refine_table.html（唯讀）

- `const embedded = window.self !== window.top;`
- `goBack()`：`embedded` 時 `postMessage('lineage-frame-close')`；否則 `history.back()`／`lineage.html`。

## 驗證

必須走 http（不可 `file://`，否則 `refine_rates.json` fetch CORS 降級）。
起 server 後操作 💳/⚙/📊＋儲值＋關閉，檢查 console 無噴錯。
