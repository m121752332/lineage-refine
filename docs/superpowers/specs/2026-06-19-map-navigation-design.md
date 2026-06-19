# 地圖導航(自動尋路)功能設計

日期:2026-06-19
檔案:`lineage.html`(單一 Vue 3 `createApp`,inline JS)

## 目標

讓玩家不必自己按 WASD,改用**點主畫面地板**選定目的地(B 點),人物自動沿一條合理的白線移動到紅點後停下。途中必須:

1. 判斷 **B 點是否可到達**。
2. 確保**白線只出現在可行走範圍**(不壓牆壁/障礙物/房間外)。
3. 全程以 **geo(可進入)檢查** 為基礎 —— 完全複用既有 `walkable(rx, ry)`。
4. 走到**不可走的路線時立即停止**自動導航。

## 既有基礎(沿用,不改語意)

- 玩家世界座標:`wx, wy`(起始 `330, 370`)。
- `walkable(rx, ry)`:點測試,僅在房間內(扣掉 `WALL=36` 邊界)且不在 `obstacles` 時回傳 true。即本案的 geo 檢查來源。
- `rooms`(5 個矩形)+ 2 條走廊;歐林 NPC 在 `(OLIN_X=796, OLIN_Y=260)`。
- `loop()`:每幀讀 `keys` 做手動移動,`SPEED=2.0`;移動用 `px=16` 的 `inX/inY` 碰撞。
- canvas `click` 事件(約 1795 行):目前只處理「點歐林交談」。
- `render()` 在 `ctx.translate(cx,cy)` 鏡頭座標系內繪製;`camOffset(W,H)` 提供 `cx,cy`。

## 設計

### 1. 導航網格(啟動建立一次)

- 取所有 `rooms` 的外接矩形為網格範圍,**格寬 `CELL=16`**。
- 每格中心 `(cx,cy)`,當且僅當 `walkable(cx,cy)` 且 `walkable(cx±R,cy)` 且 `walkable(cx,cy±R)` 為真時,標記為「可導航」,其中 `R=14`(略小於玩家半徑 16,讓白線與牆保持半身位,沿線行走不卡牆)。
- 房間/障礙物為靜態,網格只建一次並快取(以一維 `Uint8Array` 或二維陣列存 0/1)。
- 提供工具函式:
  - `worldToCell(x,y) -> {col,row}`
  - `cellCenter(col,row) -> {x,y}`
  - `cellNavigable(col,row) -> bool`(含邊界保護)

### 2. A* 尋路

- 函式 `findPath(sx,sy, tx,ty) -> [{x,y}, ...] | null`。
- 起點格 = 玩家所在格;終點格 = 目標格。
- **8 方向**鄰接,斜走時要求兩個正交鄰格皆可導航(不切牆角)。
- 代價:正交 1、斜向 √2;啟發式用歐氏距離。
- 找不到路徑回傳 `null`。
- **直線平滑**:對 A* 原始航點做一次 line-of-sight 合併 —— 若兩航點間整條線段(沿線取樣呼叫 `cellNavigable` / `walkable`)皆可走,則略過中間點。輸出較少、較自然的折線。

### 3. 三個判斷(對應需求)

- **B 點是否可到達**:`click` → 反算世界座標 → `worldToCell`。若目標格不可導航,或 `findPath` 回 `null` → **不移動**,`addMsg('⚠ 無法到達該地點','red')`,不進入導航模式。
- **白線是否合理**:白線即 `findPath` 的輸出;每格都通過 `walkable()`+半身位檢查 → 白線本質上不會落在不可走區域。
- **geo 進入檢查**:網格建立與每幀行走皆以 `walkable()` 為唯一真值來源。

### 4. 自動行走(改 `loop()`)

新增狀態(`reactive`):

```js
const nav = reactive({ active:false, path:[], idx:0, target:null });
```

`loop()` 每幀:

- 若 `nav.active`:
  - 目標航點 `wp = nav.path[nav.idx]`;計算朝 `wp` 的單位向量,位移 `SPEED`。
  - 下一步座標 `nx,ny`。**以 `walkable(nx±px,...)` 同手動模式的方式驗證**;若不可走 → `stopNav('⚠ 前方無法通行,已停止導航')`(立即停止)。
  - 抵達航點(距離 < `SPEED*1.5`)→ `nav.idx++`;若超出尾端 → `stopNav()`(抵達,無訊息或「已抵達」)。
  - 更新 `walkTick/walkFrame` 走路動畫。
- 否則維持原本鍵盤手動移動。

`stopNav(msg?)`:`nav.active=false; nav.path=[]; nav.idx=0;` 視需要 `addMsg`。

### 5. 啟動導航(改 canvas `click`)

點擊優先序:

1. 若點在歐林命中區且玩家在可交談範圍(既有邏輯)→ `talkToOlin()`(維持原樣)。
2. 否則:反算世界座標 → 跑「B 點是否可到達」判斷:
   - 可達 → 設定 `nav.path`、`nav.idx=0`、`nav.active=true`、`nav.target={x,y}`,顯示頂部橫幅。
   - 不可達 → 提示「無法到達」。

(歐林範圍外的點擊一律視為導航;若剛好點在歐林附近但不可達,照樣提示無法到達。)

### 6. 中斷

- **頂部「⏸ 暫停」按鈕**(HTML)→ 呼叫 `stopNav()`,脫離導航,人物停在原地。
- **WASD / 方向鍵**:`loop()` 內若 `nav.active` 且偵測到任一移動鍵被按下 → `stopNav()` 後當幀即交回手動移動。
- 兩者皆可中斷(已與使用者確認)。

### 7. 畫面呈現

- **頂部導航橫幅(HTML,Vue `v-if="nav.active"`)**:畫面正上方置中,內容 `🧭 地圖導航中…` + `⏸ 暫停` 按鈕。沿用既有 CSS 變數配色(`--gold`, `--panel`, `--border`)。導航結束自動消失。
- **白線 + 紅點(canvas,在鏡頭座標系內)**:於 `render()` 的 `ctx.translate(cx,cy)` 範圍內,`nav.active` 時:
  - 沿 `nav.path` 畫白色折線(`strokeStyle` 白、半透明、`lineWidth≈3`,可加虛線)。
  - 在 `nav.target` 畫紅點(紅色實心圓 + 外圈)。

### 8. 與既有提示列關係

- `drawHints()` 維持顯示 WASD/歐林距離;可在 `nav.active` 時於提示文字補一行「導航中(按 WASD 或上方暫停可中止)」。非必要,low priority。

## 模組邊界

| 單元 | 職責 | 依賴 |
|------|------|------|
| 網格建立 `buildNavGrid()` | 由 `rooms`/`obstacles` 產生可導航格 | `walkable()` |
| 座標換算 `worldToCell/cellCenter` | 世界 ↔ 格座標 | 網格範圍常數 |
| 尋路 `findPath()` | A* + 直線平滑,回傳航點或 null | `cellNavigable()` |
| 導航狀態 `nav` + `loop()` 分支 | 沿航點移動、每幀 geo 驗證、抵達/受阻停止 | `findPath`, `walkable` |
| 啟動/中斷 (`click`, 按鈕, WASD) | 進入/離開導航模式 | `nav`, `findPath` |
| 繪製 (橫幅 HTML + 白線/紅點 canvas) | 視覺呈現 | `nav`, `camOffset` |

各單元可獨立理解:輸入是世界座標與 `walkable()`,輸出是路徑與移動;改其內部不影響呼叫端。

## 驗證(完成後實測)

以瀏覽器預覽工具實測,直接提供結果證據:

1. **可走模式**:設定 `localStorage` 為已登入 → 從左房間點歐林房間地板 → 觀察人物自動穿越走廊抵達紅點停下(快照 / 截圖)。
2. **不可走立即停止**:點牆壁 / 房間外 → 觀察提示「無法到達」且人物不動;若導航途中路徑受阻,確認 `stopNav` 立即觸發。

## 不做(YAGNI)

- 不做小地圖點擊導航(本案只做主畫面點地板)。
- 不做預設地標清單。
- 不做抵達後自動與歐林交談(可日後加)。
- 不做路徑動態避開移動障礙(地圖為靜態)。
