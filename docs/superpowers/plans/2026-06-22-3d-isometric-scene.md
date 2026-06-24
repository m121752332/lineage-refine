# 3D Isometric Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `lineage.html`'s canvas-2D top-down map with a Babylon.js true-3D scene rendered at a 2.5D isometric 45° angle, with a fixed/rotatable camera toggle, while rebuilding navigation and collision in 3D.

**Architecture:** Three layers. (1) `nav3d.js` — a pure, Babylon-free, browser-and-Node module that owns the tilemap, coordinate mapping, nav-grid, A* pathfinding, path smoothing, and collision-step checks; unit-tested with Node's built-in test runner. (2) `scene3d.js` — a Babylon ES module that builds floor/walls/props/characters from the tilemap, runs the orthographic isometric camera (fixed or rotatable), lights the scene, and reports ground-pick clicks back. (3) `lineage.html` — keeps all game logic + Vue/HTML UI, drives the movement loop through `nav3d`, and mounts `scene3d` under the UI overlay.

**Tech Stack:** Vue 3 (CDN, existing), Babylon.js 7.x (CDN ES module), vanilla ES modules, Node `node:test` for unit tests. No build step, no bundler, no package manager.

## Global Constraints

- No build step, no bundler, no transpilation — all files run directly in the browser via CDN/ES modules (per CLAUDE.md). Copied verbatim: "No transpilation or bundling".
- Babylon.js loaded from CDN as an ES module import; pin version `@babylonjs/core@7` via `https://cdn.jsdelivr.net/npm/@babylonjs/core@7/+esm`.
- `nav3d.js` must have **zero** Babylon/DOM dependencies so `node --test` can import it.
- All files served over HTTP (the project already requires this for `fetch('refine_rates.json')`).
- Game logic stays in `lineage.html`; `scene3d.js` is presentation-only; `nav3d.js` is pure logic. Cross-layer talk happens only through the documented function signatures in each task's **Interfaces** block.
- Target art is reference-only (mood/palette/framing), never a pixel target. Do not embed or reproduce copyrighted Lineage assets.
- Characters this iteration are built from Babylon primitives behind a `createCharacter()` seam; real CC0 GLB models are deferred to the future character-selection feature.
- Coordinate convention: logic uses world pixels `(x, y)` exactly as the existing 2D code does (y is the world "south" axis). In Babylon these map to `(X, Z)` with `Y` up. The mapping lives only in `nav3d.js` (`logicToWorld` / `worldToLogic`).

---

## File Structure

- `nav3d.js` (new) — pure logic: tilemap, `TILE_PX`, cell math, `walkable`, nav-grid, A*, smoothing, collision-step, coordinate mapping. ~250 lines.
- `scene3d.js` (new) — Babylon scene: engine/scene/camera/lights, tilemap→meshes, character + Olin, ground picking, per-frame sync. ~400 lines.
- `tests/nav3d.test.mjs` (new) — Node unit tests for `nav3d.js`.
- `lineage.html` (modify) — remove the canvas-2D render engine (`initCanvas`, `loop`, `render`, `drawRoom`/`drawFloor`/`drawWall*`/`drawNPC`/`drawPlayer`/`drawNavPath`/`drawMinimap`/`drawDecorations`/`drawBookshelf`/`drawBookStand`/`drawDepthOverlay`/`drawHints`/`drawStains`/`drawPillar`/`drawCorridor*`), remove the inline nav functions now living in `nav3d.js`, mount `scene3d`, drive movement via `nav3d`, read `cameraMode`.
- `setting.html` (modify) — add the view-mode (`fixed`/`rotatable`) toggle persisted to `lineage_config.cameraMode`.

---

## Phase 1 — `nav3d.js` pure logic (TDD with `node:test`)

### Task 1: Tilemap data + cell math + `walkable`

**Files:**
- Create: `nav3d.js`
- Test: `tests/nav3d.test.mjs`

**Interfaces:**
- Produces:
  - `export const TILE_PX = 40` — pixel size of one tile cell.
  - `export const TILEMAP` — array of equal-length strings; legend `#`=wall, `.`=floor, `S`=player start (floor), `O`=Olin footprint (blocked), `C`=campfire (blocked), `t`=torch (blocked), `P`=pillar (blocked).
  - `export function mapSize() => { cols, rows, widthPx, heightPx }`
  - `export function cellAt(col,row) => char` (returns `'#'` outside bounds)
  - `export function isBlockedChar(ch) => boolean` (true for `#`,`O`,`C`,`t`,`P`)
  - `export function walkable(x,y) => boolean` — pixel point test: the tile containing `(x,y)` is in-bounds and not a blocked char.
  - `export function findChar(ch) => { x, y } | null` — pixel center of the first cell matching `ch` (used for player start `S`, Olin `O`).

- [ ] **Step 1: Write the failing test**

```js
// tests/nav3d.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_PX, mapSize, cellAt, walkable, findChar, isBlockedChar } from '../nav3d.js';

test('map is rectangular and bordered by walls', () => {
  const { cols, rows } = mapSize();
  assert.ok(cols > 5 && rows > 5);
  for (let c = 0; c < cols; c++) {
    assert.equal(cellAt(c, 0), '#', `top border col ${c}`);
    assert.equal(cellAt(c, rows - 1), '#', `bottom border col ${c}`);
  }
  for (let r = 0; r < rows; r++) {
    assert.equal(cellAt(0, r), '#', `left border row ${r}`);
    assert.equal(cellAt(cols - 1, r), '#', `right border row ${r}`);
  }
});

test('walkable is true on floor, false on wall and out of bounds', () => {
  const s = findChar('S');
  assert.ok(s, 'player start S exists');
  assert.equal(walkable(s.x, s.y), true);
  assert.equal(walkable(-5, -5), false);
  assert.equal(walkable(TILE_PX / 2, TILE_PX / 2), false); // (col0,row0) is border wall
});

test('blocked chars are not walkable', () => {
  for (const ch of ['#', 'O', 'C', 't', 'P']) assert.equal(isBlockedChar(ch), true);
  for (const ch of ['.', 'S']) assert.equal(isBlockedChar(ch), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/nav3d.test.mjs`
Expected: FAIL — cannot find module `../nav3d.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// nav3d.js — pure logic, no Babylon, no DOM
export const TILE_PX = 40;

// Legend: # wall  . floor  S start  O olin  C campfire  t torch  P pillar
// Outer ring is solid wall. Interior floor is contiguous (blocks are detached),
// guaranteeing connectivity; Olin sits in a 3-wall alcove with a downward opening.
export const TILEMAP = [
  '########################',
  '#S....t..........t.....#',
  '#......................#',
  '#..####.....###........#',
  '#..#..#.....#O#...PP....#',
  '#..#..#.....#.#.........#',
  '#..#..#................t#',
  '#......................#',
  '#..........C...........#',
  '#......................#',
  '#t...####.......####...P#',
  '#....#..............#...#',
  '#....#..............#...#',
  '#....####.......####...t#',
  '#......................#',
  '#..PP..........t.......#',
  '#......................#',
  '########################',
];

export function mapSize() {
  const rows = TILEMAP.length, cols = TILEMAP[0].length;
  return { cols, rows, widthPx: cols * TILE_PX, heightPx: rows * TILE_PX };
}
export function cellAt(col, row) {
  const { cols, rows } = mapSize();
  if (col < 0 || row < 0 || col >= cols || row >= rows) return '#';
  return TILEMAP[row][col];
}
export function isBlockedChar(ch) { return ch === '#' || ch === 'O' || ch === 'C' || ch === 't' || ch === 'P'; }
export function walkable(x, y) {
  const col = Math.floor(x / TILE_PX), row = Math.floor(y / TILE_PX);
  return !isBlockedChar(cellAt(col, row));
}
export function findChar(ch) {
  const { rows, cols } = mapSize();
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    if (TILEMAP[r][c] === ch) return { x: c * TILE_PX + TILE_PX / 2, y: r * TILE_PX + TILE_PX / 2 };
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/nav3d.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add nav3d.js tests/nav3d.test.mjs
git commit -m "feat(nav3d): tilemap data + cell math + walkable point test"
```

---

### Task 2: Nav-grid + cell/world conversion

**Files:**
- Modify: `nav3d.js`
- Test: `tests/nav3d.test.mjs`

**Interfaces:**
- Consumes: `walkable`, `mapSize`, `TILE_PX` (Task 1).
- Produces:
  - `export const NAV_CELL = 16`, `export const NAV_R = 14`
  - `export function buildNavGrid() => { cols, rows, minX, minY, cell:Uint8Array }` (cached)
  - `export function worldToCell(x,y) => { col, row }`
  - `export function cellCenter(col,row) => { x, y }`
  - `export function cellNavigable(col,row) => boolean`
  - `export function nearestNavCell(col,row) => { col, row } | null`

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nav3d.test.mjs
import { NAV_CELL, worldToCell, cellCenter, cellNavigable, nearestNavCell } from '../nav3d.js';

test('cell <-> world round-trips to same cell', () => {
  const s = findChar('S');
  const c = worldToCell(s.x, s.y);
  const back = cellCenter(c.col, c.row);
  const c2 = worldToCell(back.x, back.y);
  assert.deepEqual(c2, c);
});

test('start cell resolves to a navigable cell', () => {
  const s = findChar('S');
  const c = worldToCell(s.x, s.y);
  const near = nearestNavCell(c.col, c.row);
  assert.ok(near && cellNavigable(near.col, near.row));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/nav3d.test.mjs`
Expected: FAIL — `NAV_CELL`/`worldToCell` not exported.

- [ ] **Step 3: Write minimal implementation**

```js
// append to nav3d.js
export const NAV_CELL = 16, NAV_R = 14;
let _grid = null;
function navCellOK(cx, cy) {
  return walkable(cx, cy) && walkable(cx - NAV_R, cy) && walkable(cx + NAV_R, cy)
                          && walkable(cx, cy - NAV_R) && walkable(cx, cy + NAV_R);
}
export function buildNavGrid() {
  if (_grid) return _grid;
  const { widthPx, heightPx } = mapSize();
  const minX = 0, minY = 0;
  const cols = Math.ceil(widthPx / NAV_CELL), rows = Math.ceil(heightPx / NAV_CELL);
  const cell = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const cx = minX + col * NAV_CELL + NAV_CELL / 2, cy = minY + row * NAV_CELL + NAV_CELL / 2;
    cell[row * cols + col] = navCellOK(cx, cy) ? 1 : 0;
  }
  _grid = { cols, rows, minX, minY, cell };
  return _grid;
}
export function worldToCell(x, y) { const g = buildNavGrid(); return { col: Math.floor((x - g.minX) / NAV_CELL), row: Math.floor((y - g.minY) / NAV_CELL) }; }
export function cellCenter(col, row) { const g = buildNavGrid(); return { x: g.minX + col * NAV_CELL + NAV_CELL / 2, y: g.minY + row * NAV_CELL + NAV_CELL / 2 }; }
export function cellNavigable(col, row) { const g = buildNavGrid(); if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return false; return g.cell[row * g.cols + col] === 1; }
export function nearestNavCell(col, row) {
  const g = buildNavGrid(), maxRad = Math.max(g.cols, g.rows);
  if (cellNavigable(col, row)) return { col, row };
  for (let rad = 1; rad < maxRad; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
    if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
    if (cellNavigable(col + dc, row + dr)) return { col: col + dc, row: row + dr };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/nav3d.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add nav3d.js tests/nav3d.test.mjs
git commit -m "feat(nav3d): nav grid + cell/world conversion"
```

---

### Task 3: A* pathfinding + smoothing + reachability guard

**Files:**
- Modify: `nav3d.js`
- Test: `tests/nav3d.test.mjs`

**Interfaces:**
- Consumes: grid + cell helpers (Task 2), `findChar` (Task 1).
- Produces:
  - `export function findPath(sx,sy,tx,ty) => [{x,y}, ...] | null` — 8-dir A*, no corner cutting, line-of-sight smoothed; `null` if unreachable.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nav3d.test.mjs
import { findPath } from '../nav3d.js';

test('player start can reach Olin (map connectivity guard)', () => {
  const s = findChar('S'), o = findChar('O');
  // Target a walkable tile just below Olin's footprint (the alcove opening).
  const path = findPath(s.x, s.y, o.x, o.y + 40);
  assert.ok(Array.isArray(path) && path.length >= 2, 'a path exists from start to Olin');
});

test('unreachable target inside solid wall returns null', () => {
  const s = findChar('S');
  const path = findPath(s.x, s.y, 4, 4); // (col0,row0) border wall
  assert.equal(path, null);
});

test('smoothed path has no redundant collinear midpoints', () => {
  const s = findChar('S');
  const path = findPath(s.x, s.y, s.x + 200, s.y);
  assert.ok(path.length <= 4, `expected a short smoothed path, got ${path.length}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/nav3d.test.mjs`
Expected: FAIL — `findPath` not exported.

- [ ] **Step 3: Write minimal implementation** (ported verbatim from `lineage.html:1322-1376`, axis renamed to nav3d helpers)

```js
// append to nav3d.js
function navLineClear(a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.ceil(dist / (NAV_CELL / 2));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (!navCellOK(x, y)) return false;
  }
  return true;
}
function smoothPath(path) {
  if (path.length <= 2) return path;
  const out = [path[0]]; let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !navLineClear(path[i], path[j])) j--;
    out.push(path[j]); i = j;
  }
  return out;
}
export function findPath(sx, sy, tx, ty) {
  const g = buildNavGrid();
  const s0 = worldToCell(sx, sy), s = nearestNavCell(s0.col, s0.row);
  const tc = worldToCell(tx, ty);
  if (!s || !cellNavigable(tc.col, tc.row)) return null;
  const idx = (c, r) => r * g.cols + c;
  const goalK = idx(tc.col, tc.row);
  const came = new Map(), gScore = new Map([[idx(s.col, s.row), 0]]), closed = new Set();
  const heur = (c, r) => Math.hypot(c - tc.col, r - tc.row);
  const open = [{ c: s.col, r: s.row, f: heur(s.col, s.row) }];
  const dirs = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0], ck = idx(cur.c, cur.r);
    if (ck === goalK) {
      const cells = []; let k = ck;
      while (k !== undefined) { cells.push({ x: cellCenter(k % g.cols, Math.floor(k / g.cols)).x, y: cellCenter(k % g.cols, Math.floor(k / g.cols)).y }); k = came.get(k); }
      return smoothPath(cells.reverse());
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (const [dc, dr, cost] of dirs) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (!cellNavigable(nc, nr)) continue;
      if (dc !== 0 && dr !== 0 && (!cellNavigable(cur.c + dc, cur.r) || !cellNavigable(cur.c, cur.r + dr))) continue;
      const nk = idx(nc, nr); if (closed.has(nk)) continue;
      const tentative = gScore.get(ck) + cost;
      if (tentative < (gScore.has(nk) ? gScore.get(nk) : Infinity)) {
        came.set(nk, ck); gScore.set(nk, tentative);
        open.push({ c: nc, r: nr, f: tentative + heur(nc, nr) });
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/nav3d.test.mjs`
Expected: PASS (8 tests). **If the connectivity guard fails**, the authored `TILEMAP` accidentally walled Olin off — widen the alcove opening (change a `#` directly below the `O` cell to `.`) and re-run until green. This test is the map's correctness gate.

- [ ] **Step 5: Commit**

```bash
git add nav3d.js tests/nav3d.test.mjs
git commit -m "feat(nav3d): A* pathfinding + smoothing + connectivity guard"
```

---

### Task 4: Collision-step check + coordinate mapping

**Files:**
- Modify: `nav3d.js`
- Test: `tests/nav3d.test.mjs`

**Interfaces:**
- Consumes: `walkable`, `mapSize` (Task 1).
- Produces:
  - `export function canStep(x,y,nx,ny,px=16) => boolean` — true if moving from `(x,y)` toward `(nx,ny)` keeps the player half-box (`px`) on walkable ground (matches the existing 2D `inX/inY` rule).
  - `export const WORLD_SCALE = 0.04` — Babylon world units per logic pixel.
  - `export function logicToWorld(x,y) => { X, Z }` — centers the map at origin: `X = (x - widthPx/2) * WORLD_SCALE`, `Z = (heightPx/2 - y) * WORLD_SCALE` (flip so logic-south = -Z).
  - `export function worldToLogic(X,Z) => { x, y }` — exact inverse of `logicToWorld`.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nav3d.test.mjs
import { canStep, logicToWorld, worldToLogic, WORLD_SCALE } from '../nav3d.js';

test('canStep allows movement on open floor and blocks into a wall', () => {
  const s = findChar('S');
  assert.equal(canStep(s.x, s.y, s.x + 4, s.y), true);
  assert.equal(canStep(s.x, s.y, 0, 0), false); // toward border wall corner
});

test('logicToWorld / worldToLogic round-trip', () => {
  const { X, Z } = logicToWorld(300, 420);
  const { x, y } = worldToLogic(X, Z);
  assert.ok(Math.abs(x - 300) < 1e-6 && Math.abs(y - 420) < 1e-6);
  assert.ok(WORLD_SCALE > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/nav3d.test.mjs`
Expected: FAIL — `canStep`/`logicToWorld` not exported.

- [ ] **Step 3: Write minimal implementation**

```js
// append to nav3d.js
export function canStep(x, y, nx, ny, px = 16) {
  const inX = walkable(nx, y - px) || walkable(nx, y + px);
  const inY = walkable(x - px, ny) || walkable(x + px, ny);
  return inX || inY;
}
export const WORLD_SCALE = 0.04;
export function logicToWorld(x, y) {
  const { widthPx, heightPx } = mapSize();
  return { X: (x - widthPx / 2) * WORLD_SCALE, Z: (heightPx / 2 - y) * WORLD_SCALE };
}
export function worldToLogic(X, Z) {
  const { widthPx, heightPx } = mapSize();
  return { x: X / WORLD_SCALE + widthPx / 2, y: heightPx / 2 - Z / WORLD_SCALE };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/nav3d.test.mjs`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add nav3d.js tests/nav3d.test.mjs
git commit -m "feat(nav3d): collision-step check + logic<->world coordinate mapping"
```

---

## Phase 2 — `scene3d.js` Babylon presentation (browser-preview verified)

> Verification for Phase 2 uses the preview tools (`preview_start`, `preview_screenshot`, `preview_console_logs`), not unit tests — WebGL output can't be asserted in Node. Each task ends by loading `lineage.html` and confirming via screenshot + a clean console.

### Task 5: Babylon engine, scene, isometric ortho camera, ground plane

**Files:**
- Create: `scene3d.js`
- Modify: `lineage.html` (add Babylon canvas + module bootstrap; see Step 3)

**Interfaces:**
- Consumes: `nav3d.js` (`mapSize`, `logicToWorld`, `worldToLogic`, `WORLD_SCALE`, `TILE_PX`).
- Produces:
  - `export function createScene(canvas, opts) => sceneApi` where `opts = { cameraMode:'fixed'|'rotatable', onGroundClick(x,y) }`.
  - `sceneApi = { setCameraMode(mode), setPlayer(x,y,moving), setOlin(x,y), dispose() }` (later tasks flesh out `setPlayer`/`setOlin`; this task returns stubs).

- [ ] **Step 1: Write `scene3d.js` with engine + ortho iso camera + ground**

```js
// scene3d.js — Babylon presentation layer
import * as BABYLON from 'https://cdn.jsdelivr.net/npm/@babylonjs/core@7/+esm';
import { mapSize, logicToWorld, worldToLogic, WORLD_SCALE, TILE_PX } from './nav3d.js';

const ISO_BETA = Math.PI * 60 / 180;   // 60° from +Y  => 30° elevation (classic iso feel)
const ISO_ALPHA = -Math.PI / 4;        // upper-left -> lower-right 45°

export function createScene(canvas, opts = {}) {
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.03, 0.02, 0.02, 1);

  const { widthPx, heightPx } = mapSize();
  const worldW = widthPx * WORLD_SCALE, worldH = heightPx * WORLD_SCALE;

  const camera = new BABYLON.ArcRotateCamera('cam', ISO_ALPHA, ISO_BETA, 60, BABYLON.Vector3.Zero(), scene);
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  let orthoSize = Math.max(worldW, worldH) * 0.62;   // half-extent; smaller = zoomed in
  function applyOrtho() {
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    camera.orthoTop = orthoSize; camera.orthoBottom = -orthoSize;
    camera.orthoLeft = -orthoSize * aspect; camera.orthoRight = orthoSize * aspect;
  }
  applyOrtho();
  camera.lowerBetaLimit = ISO_BETA; camera.upperBetaLimit = ISO_BETA; // pitch locked = always 2.5D

  function setCameraMode(mode) {
    camera.detachControl();
    if (mode === 'rotatable') camera.attachControl(canvas, true);
    else camera.alpha = ISO_ALPHA;
  }
  setCameraMode(opts.cameraMode || 'fixed');

  // wheel zoom in rotatable mode (ortho zoom adjusts extents, not radius)
  scene.onPointerObservable.add((p) => {
    if ((opts.cameraMode || 'fixed') !== 'rotatable') return;
    if (p.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
      const e = p.event; orthoSize = Math.min(Math.max(orthoSize * (e.deltaY > 0 ? 1.1 : 0.9), worldH * 0.25), worldH * 1.2); applyOrtho();
    }
  });

  // Ground plane (sized to the map) — pickable for click-to-walk
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: worldW, height: worldH }, scene);
  const gmat = new BABYLON.StandardMaterial('gmat', scene);
  gmat.diffuseColor = new BABYLON.Color3(0.18, 0.14, 0.08);
  gmat.specularColor = new BABYLON.Color3(0, 0, 0);
  ground.material = gmat;

  scene.onPointerObservable.add((p) => {
    if (p.type !== BABYLON.PointerEventTypes.POINTERPICK) return;
    const hit = scene.pick(scene.pointerX, scene.pointerY, (m) => m === ground);
    if (hit?.hit && opts.onGroundClick) { const { x, y } = worldToLogic(hit.pickedPoint.x, hit.pickedPoint.z); opts.onGroundClick(x, y); }
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => { engine.resize(); applyOrtho(); });

  return {
    setCameraMode: (m) => { opts.cameraMode = m; setCameraMode(m); },
    setPlayer: () => {},
    setOlin: () => {},
    dispose: () => engine.dispose(),
    _internals: { scene, engine, camera, BABYLON },
  };
}
```

- [ ] **Step 2: Add a temporary bootstrap to `lineage.html`** (replaces the 2D canvas wiring temporarily; full integration is Task 11)

In `lineage.html`, change the scene canvas element (currently `<canvas id="gameCanvas" ref="canvas">` at line 612) to keep the id, and add near the end of `<body>` (before the closing tag) a module bootstrap that runs after Vue mounts:

```html
<script type="module">
  import { createScene } from './scene3d.js';
  window.__scene3d = createScene; // exposed so the Vue app (Task 11) can call it
</script>
```

Temporarily, to verify this task in isolation, add right after the import:
```js
  const cv = document.getElementById('gameCanvas');
  if (cv) window.__sceneApi = createScene(cv, { cameraMode: 'fixed', onGroundClick: (x, y) => console.log('ground click', x, y) });
```
(This temporary auto-start block is removed in Task 11.)

- [ ] **Step 3: Verify in the browser preview**

Run: `preview_start` (serves the repo over HTTP), then navigate to `lineage.html` after setting `localStorage.lineage_player` to a logged-in stub via `preview_eval`:
```js
localStorage.setItem('lineage_player', JSON.stringify({ name:'tester', gold:999999, loggedIn:true, server:'test', loginTime:Date.now() }));
location.href = 'lineage.html';
```
Then `preview_screenshot` and `preview_console_logs`.
Expected: a dark scene with a flat ground quad viewed at an isometric angle; clicking the ground logs `ground click <x> <y>` with plausible logic coordinates; **no console errors**.

- [ ] **Step 4: Commit**

```bash
git add scene3d.js lineage.html
git commit -m "feat(scene3d): Babylon engine + orthographic isometric camera + pickable ground"
```

---

### Task 6: Build floor tiles + walls + pillars from the tilemap

**Files:**
- Modify: `scene3d.js`

**Interfaces:**
- Consumes: `cellAt`, `mapSize`, `TILE_PX`, `logicToWorld`, `WORLD_SCALE` from `nav3d.js`.
- Produces: internal `buildLevel(scene)` called inside `createScene`; merges wall boxes for performance. No new public API.

- [ ] **Step 1: Add level geometry builder to `scene3d.js`**

Add this function and call `buildLevel(scene)` inside `createScene` (after the ground is created):

```js
function stoneTexture(scene, base, name) {
  const t = new BABYLON.DynamicTexture(name, { width: 128, height: 128 }, scene, false);
  const ctx = t.getContext();
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) { // speckle/crack noise -> gritty stone
    const x = Math.random() * 128, y = Math.random() * 128, a = Math.random() * 0.18;
    ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(Math.random()*128, Math.random()*128); ctx.lineTo(Math.random()*128, Math.random()*128); ctx.stroke(); }
  t.update();
  return t;
}

function buildLevel(scene) {
  const { cols, rows } = mapSize();
  const unit = TILE_PX * WORLD_SCALE;          // one tile in world units
  const wallH = unit * 1.6;
  const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
  wallMat.diffuseTexture = stoneTexture(scene, '#3a2f24', 'wallTex');
  wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
  const pillarMat = new BABYLON.StandardMaterial('pillarMat', scene);
  pillarMat.diffuseTexture = stoneTexture(scene, '#2c241b', 'pillarTex');
  pillarMat.specularColor = new BABYLON.Color3(0, 0, 0);

  const walls = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = cellAt(c, r);
    const isWall = ch === '#', isPillar = ch === 'P';
    if (!isWall && !isPillar) continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    const w = isPillar ? unit * 0.55 : unit;
    const box = BABYLON.MeshBuilder.CreateBox('w', { width: w, depth: w, height: wallH }, scene);
    box.position.set(X, wallH / 2, Z);
    box.material = isPillar ? pillarMat : wallMat;
    if (isWall) walls.push(box); else box.isPickable = false;
  }
  if (walls.length) { const merged = BABYLON.Mesh.MergeMeshes(walls, true, true, undefined, false, false); if (merged) merged.isPickable = false; }
}
```

- [ ] **Step 2: Verify in the browser preview**

Run `preview_screenshot` (reload via `preview_eval: location.reload()` if HMR not active) and `preview_console_logs`.
Expected: an isometric stone-walled maze rises from the ground — wall tops and faces visible at the 30° angle, gritty dark-brown texture, pillars slightly thinner. No console errors.

- [ ] **Step 3: Commit**

```bash
git add scene3d.js
git commit -m "feat(scene3d): build floor/walls/pillars from tilemap with procedural stone texture"
```

---

### Task 7: Lighting + torches + campfire (point lights only)

**Files:**
- Modify: `scene3d.js`

**Interfaces:**
- Consumes: `cellAt`, `mapSize`, `TILE_PX`, `logicToWorld`, `WORLD_SCALE`.
- Produces: internal `buildLights(scene)` + `buildFireProps(scene)`; no new public API.

- [ ] **Step 1: Add lighting and fire props to `scene3d.js`**

Add and call both inside `createScene` (after `buildLevel`):

```js
function buildLights(scene) {
  const amb = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
  amb.intensity = 0.18;                                  // dim base = dungeon dark
  amb.diffuse = new BABYLON.Color3(0.5, 0.45, 0.4);
  amb.groundColor = new BABYLON.Color3(0.05, 0.04, 0.03);
}
function addTorchLight(scene, X, Z, h) {
  const pl = new BABYLON.PointLight('torch', new BABYLON.Vector3(X, h, Z), scene);
  pl.diffuse = new BABYLON.Color3(1.0, 0.6, 0.25);       // warm orange
  pl.intensity = 0.9; pl.range = TILE_PX * WORLD_SCALE * 6;
  let t = Math.random() * 10;
  scene.onBeforeRenderObservable.add(() => { t += 0.08; pl.intensity = 0.8 + Math.sin(t) * 0.12; }); // flicker
  return pl;
}
function buildFireProps(scene) {
  const { cols, rows } = mapSize();
  const unit = TILE_PX * WORLD_SCALE;
  const flameMat = new BABYLON.StandardMaterial('flameMat', scene);
  flameMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0.1); flameMat.disableLighting = true;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = cellAt(c, r); if (ch !== 't' && ch !== 'C') continue;
    const { X, Z } = logicToWorld(c * TILE_PX + TILE_PX / 2, r * TILE_PX + TILE_PX / 2);
    const isFire = ch === 'C';
    const flame = BABYLON.MeshBuilder.CreateCylinder('flame', { diameterTop: 0, diameterBottom: isFire ? unit * 0.7 : unit * 0.25, height: isFire ? unit * 1.1 : unit * 0.7 }, scene);
    flame.position.set(X, (isFire ? unit * 0.55 : unit * 0.9), Z); flame.material = flameMat; flame.isPickable = false;
    if (!isFire) { const pole = BABYLON.MeshBuilder.CreateCylinder('pole', { diameter: unit * 0.12, height: unit * 1.2 }, scene); pole.position.set(X, unit * 0.6, Z); pole.isPickable = false; }
    addTorchLight(scene, X, isFire ? unit * 0.9 : unit * 1.3, Z);
  }
}
```

- [ ] **Step 2: Verify in the browser preview**

`preview_screenshot` + `preview_console_logs`.
Expected: scene is dark with warm pools of torch light on nearby walls/floor; the central campfire glows orange and lights its surroundings; flames visibly self-illuminated. Flicker is subtle. No errors.

- [ ] **Step 3: Commit**

```bash
git add scene3d.js
git commit -m "feat(scene3d): dim ambient + flickering torch/campfire point lights"
```

---

### Task 8: Player Character (primitive) with facing + walk animation

**Files:**
- Modify: `scene3d.js`

**Interfaces:**
- Consumes: `logicToWorld`, `WORLD_SCALE`, `TILE_PX`.
- Produces:
  - `createCharacter(scene, color)` — internal factory (the GLB-swap seam) returning a root `TransformNode`.
  - Public `sceneApi.setPlayer(x, y, moving)` — moves/rotates the player root to logic `(x,y)`; when `moving` is true, plays the walk animation (leg swing + bob) and faces the movement direction.

- [ ] **Step 1: Implement character factory + `setPlayer` in `scene3d.js`**

```js
function createCharacter(scene, color) {
  // SEAM: future character-selection replaces this primitive build with a GLB load + skeleton.
  const unit = TILE_PX * WORLD_SCALE;
  const root = new BABYLON.TransformNode('charRoot', scene);
  const mat = new BABYLON.StandardMaterial('charMat', scene); mat.diffuseColor = color; mat.specularColor = new BABYLON.Color3(0.1,0.1,0.1);
  const body = BABYLON.MeshBuilder.CreateCapsule('body', { radius: unit * 0.28, height: unit * 1.0 }, scene);
  body.position.y = unit * 0.7; body.material = mat; body.parent = root; body.isPickable = false;
  const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: unit * 0.42 }, scene);
  head.position.y = unit * 1.25; head.material = mat; head.parent = root; head.isPickable = false;
  const mkLeg = (sx) => { const l = BABYLON.MeshBuilder.CreateBox('leg', { width: unit*0.18, depth: unit*0.22, height: unit*0.5 }, scene); l.position.set(sx, unit*0.25, 0); l.material = mat; l.parent = root; l.isPickable = false; return l; };
  const legL = mkLeg(-unit * 0.16), legR = mkLeg(unit * 0.16);
  return { root, legL, legR, body, _t: 0 };
}

// inside createScene, after buildFireProps:
const player = createCharacter(scene, new BABYLON.Color3(0.62, 0.66, 0.74)); // knight = steel/silver
let _playerMoving = false, _playerFacing = 0;
scene.onBeforeRenderObservable.add(() => {
  if (_playerMoving) { player._t += 0.25; const s = Math.sin(player._t) * 0.5; player.legL.rotation.x = s; player.legR.rotation.x = -s; player.body.position.y = (TILE_PX*WORLD_SCALE*0.7) + Math.abs(Math.sin(player._t))*0.02; }
  else { player.legL.rotation.x = 0; player.legR.rotation.x = 0; }
  player.root.rotation.y = _playerFacing;
});
```

Then replace the `setPlayer` stub in the returned `sceneApi`:

```js
setPlayer: (x, y, moving) => {
  const { X, Z } = logicToWorld(x, y);
  if (moving) { const dx = X - player.root.position.x, dz = Z - player.root.position.z; if (dx || dz) _playerFacing = Math.atan2(dx, dz); }
  player.root.position.set(X, 0, Z); _playerMoving = !!moving;
},
```

- [ ] **Step 2: Verify in the browser preview**

Temporarily drive the player in the bootstrap block (`preview_eval`):
```js
let a = 0; setInterval(() => { a += 0.02; window.__sceneApi.setPlayer(500 + Math.cos(a)*120, 400 + Math.sin(a)*120, true); }, 33);
```
`preview_screenshot`.
Expected: a steel-colored humanoid walks a circle on the floor, legs swinging, body bobbing, **facing its direction of travel**. Remove the temporary interval after checking. No errors.

- [ ] **Step 3: Commit**

```bash
git add scene3d.js
git commit -m "feat(scene3d): primitive Knight character with facing + walk animation (GLB seam)"
```

---

### Task 9: Olin NPC (static) + floating nameplate

**Files:**
- Modify: `scene3d.js`

**Interfaces:**
- Consumes: `createCharacter`, `findChar`(via caller), `logicToWorld`.
- Produces:
  - Public `sceneApi.setOlin(x, y)` — places the static Olin figure + a billboarded "歐林【雜貨商】" nameplate at logic `(x,y)`.

- [ ] **Step 1: Implement Olin + nameplate in `scene3d.js`**

```js
// inside createScene, after the player block:
const olin = createCharacter(scene, new BABYLON.Color3(0.16, 0.14, 0.12)); // dark robe
olin.legL.setEnabled(false); olin.legR.setEnabled(false); // static NPC: no legs/animation

const plate = new BABYLON.DynamicTexture('plate', { width: 256, height: 64 }, scene, false);
plate.hasAlpha = true;
plate.drawText('歐林【雜貨商】', null, 44, 'bold 28px sans-serif', '#f0d060', 'transparent', true);
const plateMat = new BABYLON.StandardMaterial('plateMat', scene);
plateMat.diffuseTexture = plate; plateMat.emissiveColor = new BABYLON.Color3(1,1,1); plateMat.opacityTexture = plate; plateMat.disableLighting = true; plateMat.backFaceCulling = false;
const plateMesh = BABYLON.MeshBuilder.CreatePlane('plateMesh', { width: TILE_PX*WORLD_SCALE*2.6, height: TILE_PX*WORLD_SCALE*0.65 }, scene);
plateMesh.material = plateMat; plateMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; plateMesh.isPickable = false;
```

Add to the returned `sceneApi`:

```js
setOlin: (x, y) => {
  const { X, Z } = logicToWorld(x, y);
  olin.root.position.set(X, 0, Z);
  plateMesh.position.set(X, TILE_PX*WORLD_SCALE*1.9, Z);
},
```

- [ ] **Step 2: Verify in the browser preview**

In the bootstrap, after creating the scene, call (via `preview_eval`):
```js
import('./nav3d.js').then(n => { const o = n.findChar('O'); window.__sceneApi.setOlin(o.x, o.y); });
```
`preview_screenshot`.
Expected: a dark-robed static figure stands at Olin's alcove with a gold "歐林【雜貨商】" nameplate floating above it, the nameplate always facing the camera. No errors.

- [ ] **Step 3: Commit**

```bash
git add scene3d.js
git commit -m "feat(scene3d): static Olin NPC + billboarded nameplate"
```

---

## Phase 3 — `lineage.html` integration

### Task 10: Replace 2D nav internals with `nav3d.js` imports

**Files:**
- Modify: `lineage.html` (remove inline nav block `1284-1406`; import from `nav3d.js`)

**Interfaces:**
- Consumes: all `nav3d.js` exports.
- Produces: `lineage.html`'s `startNavTo`/`stopNav`/`navStep` now call imported `findPath`/`canStep`; `wx,wy` remain the logic source of truth.

- [ ] **Step 1: Convert the Vue app script to a module and import nav3d**

Change the main Vue `<script>` tag in `lineage.html` to `<script type="module">` and add at the top:
```js
import { findPath, canStep, walkable, worldToCell, cellCenter, nearestNavCell, findChar, mapSize, logicToWorld } from './nav3d.js';
```
Delete the now-duplicated inline definitions: `WALL`, `rooms`, `walkable`, `OLIN_X/OLIN_Y` (replace with `const olin = findChar('O')`), `obstacles`, `NAV_CELL/NAV_R`, `navCellOK`, `buildNavGrid`, `navReady`, `worldToCell`, `cellCenter`, `cellNavigable`, `nearestNavCell`, `navLineClear`, `smoothPath`, `findPath` (lines `1258-1376`). Keep `wx,wy` initialized to the start cell:
```js
const start = findChar('S'); let wx = start.x, wy = start.y;
```

- [ ] **Step 2: Rewrite `navStep` to use `canStep`**

Replace `navStep` (lines `1391-1406`) with:
```js
function navStep(){
  const wp = nav.path[nav.idx];
  if(!wp){ stopNav(); return; }
  const dx = wp.x-wx, dy = wp.y-wy, dist = Math.hypot(dx,dy);
  if(dist < SPEED*1.5){ wx = wp.x; wy = wp.y; nav.idx++; if(nav.idx>=nav.path.length) stopNav(); walkTick++; walkFrame=Math.floor(walkTick/10)%4; return; }
  const ux = dx/dist, uy = dy/dist, nx = wx+ux*SPEED, ny = wy+uy*SPEED;
  if(!canStep(wx,wy,nx,ny)){ stopNav('⚠ 前方無法通行，已停止導航'); return; }
  if(walkable(nx,wy-16)||walkable(nx,wy+16)) wx = nx;
  if(walkable(wx-16,ny)||walkable(wx+16,ny)) wy = ny;
  walkTick++; walkFrame=Math.floor(walkTick/10)%4;
}
```

- [ ] **Step 3: Verify the nav unit tests still pass and the page loads**

Run: `node --test tests/nav3d.test.mjs` → Expected: PASS (10 tests).
Then `preview_screenshot` + `preview_console_logs` of `lineage.html`.
Expected: page loads with no "duplicate declaration" / "not defined" console errors. (The 3D scene may still show the temporary auto-start; full wiring is Task 11.)

- [ ] **Step 4: Commit**

```bash
git add lineage.html
git commit -m "refactor(lineage): consume nav3d.js, drop inline 2D nav + rooms model"
```

---

### Task 11: Wire `scene3d` into the Vue lifecycle; remove the canvas-2D engine

**Files:**
- Modify: `lineage.html` (remove `initCanvas`/`loop`/`render` and all `draw*` helpers `1907-end of render block`; add scene wiring)

**Interfaces:**
- Consumes: `createScene` from `scene3d.js`; `nav3d` `findChar`.
- Produces: a `requestAnimationFrame` logic loop that updates `wx,wy` and calls `sceneApi.setPlayer`.

- [ ] **Step 1: Delete the 2D rendering engine**

Remove from `lineage.html`: `initCanvas` (1915), `loop` (1955), `camOffset`, `render` (1987) and every `draw*` helper it calls (`drawAllRooms`, `drawRoom`, `drawFloor`, `drawStains`, `drawWallTop`, `drawWallSide`, `drawPillar`, `drawCorridor`, `drawCorrider2`, `drawDecorations`, `drawBookshelf`, `drawNPC`, `drawBookStand`, `drawPlayer`, `drawNavPath`, `drawDepthOverlay`, `drawMinimap`, `drawHints`). Keep the `<canvas id="gameCanvas">` element. Remove the temporary auto-start block added in Task 5.

- [ ] **Step 2: Add scene creation + logic loop in `onMounted`**

In the Vue `onMounted`, after auth guard, add:
```js
const cfg = JSON.parse(localStorage.getItem('lineage_config') || '{}');
const sceneApi = createScene(canvas.value, {
  cameraMode: cfg.cameraMode === 'rotatable' ? 'rotatable' : 'fixed',
  onGroundClick: (x, y) => { if (ui.shop || ui.enhance || dialog.show) return; startNavTo(x, y); },
});
const olinPos = findChar('O');
sceneApi.setOlin(olinPos.x, olinPos.y);

let moving = false;
function logicLoop(){
  if(!ui.shop && !ui.enhance && !dialog.show){
    const pressing = keys['ArrowLeft']||keys['a']||keys['ArrowRight']||keys['d']||keys['ArrowUp']||keys['w']||keys['ArrowDown']||keys['s'];
    if(nav.active && pressing) stopNav('⏸ 已手動中斷導航');
    if(nav.active){ navStep(); moving = nav.active; }
    else {
      let dx=0,dy=0;
      if(keys['ArrowLeft']||keys['a'])dx=-SPEED; if(keys['ArrowRight']||keys['d'])dx=SPEED;
      if(keys['ArrowUp']||keys['w'])dy=-SPEED; if(keys['ArrowDown']||keys['s'])dy=SPEED;
      if(dx&&dy){dx*=0.707;dy*=0.707;}
      const nx=wx+dx, ny=wy+dy;
      if(walkable(nx,wy-16)||walkable(nx,wy+16)) wx=nx;
      if(walkable(wx-16,ny)||walkable(wx+16,ny)) wy=ny;
      moving = !!(dx||dy);
    }
  } else moving = false;
  sceneApi.setPlayer(wx, wy, moving);
  requestAnimationFrame(logicLoop);
}
requestAnimationFrame(logicLoop);
```
Keep the existing `keydown`/`keyup`/`Escape` listeners (they were inside `initCanvas`); move them into `onMounted` directly. Remove the old canvas `click` handler that picked Olin by screen distance — Olin interaction is now Step 3.

- [ ] **Step 3: Restore "click Olin to talk" via 3D proximity**

In `onGroundClick`, before `startNavTo`, add a proximity-to-talk check using logic coords:
```js
onGroundClick: (x, y) => {
  if (ui.shop || ui.enhance || dialog.show) return;
  const o = findChar('O');
  if (Math.hypot(wx - o.x, wy - o.y) <= 108 && Math.hypot(x - o.x, y - o.y) <= 60) { talkToOlin(); return; }
  startNavTo(x, y);
},
```

- [ ] **Step 4: Verify in the browser preview**

`preview_screenshot`, `preview_console_logs`, then exercise: `preview_eval` to click the floor near Olin and far away; confirm the Knight pathfinds across the maze and stops; click a wall and confirm "無法到達" message; press `w/a/s/d` via `preview_eval` keyboard events and confirm manual movement + walk animation.
Expected: full click-to-walk + manual movement working in the 3D scene; Olin talk opens the shop; no console errors.

- [ ] **Step 5: Commit**

```bash
git add lineage.html
git commit -m "feat(lineage): mount Babylon scene, 3D logic loop, click-to-walk + Olin talk"
```

---

### Task 12: Settings — view-mode toggle (`setting.html`)

**Files:**
- Modify: `setting.html`

**Interfaces:**
- Consumes: `lineage_config` localStorage shape.
- Produces: `lineage_config.cameraMode` persisted as `'fixed' | 'rotatable'`.

- [ ] **Step 1: Add a view-mode control**

In `setting.html`, add a labelled select bound to a `cameraMode` ref (default `'fixed'`), styled with the existing CSS palette (`--gold`, `--panel`, `--border`):
```html
<div class="cfg-row">
  <label>視角模式</label>
  <select v-model="cameraMode">
    <option value="fixed">固定 45°（經典等角）</option>
    <option value="rotatable">可旋轉（水平環顧 + 滾輪縮放）</option>
  </select>
</div>
```
Load it in `onMounted` from `lineage_config.cameraMode` (fallback `'fixed'`), and include it when writing `lineage_config` in the existing save handler:
```js
cfg.cameraMode = cameraMode.value; localStorage.setItem('lineage_config', JSON.stringify(cfg));
```

- [ ] **Step 2: Verify persistence + live effect**

`preview` to `setting.html`, switch to "可旋轉", save, then open `lineage.html`. Use `preview_eval` to drag-rotate the camera and scroll to zoom; switch back to "固定" in settings and confirm `lineage.html` locks the angle.
Expected: `localStorage.lineage_config.cameraMode` reflects the choice; rotatable mode orbits horizontally with the pitch locked (always 2.5D) and wheel-zooms; fixed mode cannot rotate. No errors.

- [ ] **Step 3: Commit**

```bash
git add setting.html
git commit -m "feat(setting): view-mode toggle persisted to lineage_config.cameraMode"
```

---

### Task 13: Acceptance pass against the scene checklist

**Files:** none (verification + polish only)

- [ ] **Step 1: Run the full unit suite**

Run: `node --test tests/nav3d.test.mjs`
Expected: PASS (10 tests).

- [ ] **Step 2: Capture acceptance screenshots**

With `lineage.html` loaded (logged-in stub), capture `preview_screenshot` in both fixed and rotatable modes. Confirm every **must-have** element from the spec is present: irregular stone-wall maze (wall tops + faces), gritty floor, lit torches, Olin + nameplate at the alcove, the Knight, central campfire. Place screenshots beside the target image and judge mood/composition (not pixels), per ADR-0001.

- [ ] **Step 3: Fix any missing must-have**

If a must-have is absent or visually off, trace it to its task (geometry → Task 6, lights → Task 7, characters → Tasks 8/9) and fix. Re-screenshot.

- [ ] **Step 4: Commit any polish + final verification note**

```bash
git add -A
git commit -m "chore: acceptance pass — must-have scene elements verified in fixed + rotatable modes"
```

---

## Self-Review

**Spec coverage** (`docs/superpowers/specs/2026-06-22-3d-isometric-scene-design.md`):
- Babylon true-3D scene → Tasks 5-9. Orthographic iso camera → Task 5. Fixed/rotatable toggle → Tasks 5 + 12. 3D-native nav (no physics) → Tasks 2-4, 10-11. Tilemap single source → Task 1 (feeds both nav grid Task 2 and geometry Task 6). Hybrid assets (procedural env + character seam) → Tasks 6-9. Knight default + 360° facing + walk anim → Task 8. Olin static + nameplate → Task 9. Dim ambient + torch lights, no VFX → Task 7. `scene3d.js` module + HTML overlay → Tasks 5, 11. Settings persistence → Task 12. Acceptance checklist → Task 13. **No gaps.**
- Deviation noted: collision-stop uses the tilemap grid check (`canStep`, Task 4) rather than a Babylon mesh raycast. This is more consistent with the "single tilemap source of truth" decision and is unit-testable; it still satisfies ADR-0002's intent (3D-native navigation + collision-stop, no physics engine). Flag to reviewer.

**Placeholder scan:** No "TBD"/"handle edge cases"/"write tests for the above" — every code step contains complete code; every test step contains real assertions.

**Type consistency:** `findPath`/`canStep`/`walkable`/`logicToWorld`/`worldToLogic`/`mapSize`/`findChar` signatures are defined in Tasks 1-4 and consumed unchanged in Tasks 10-11. `sceneApi` methods `setCameraMode`/`setPlayer`/`setOlin`/`dispose` are declared in Task 5 and fleshed out in Tasks 8-9 with matching signatures. `createCharacter` returns `{root, legL, legR, body, _t}` used identically in Tasks 8-9.
