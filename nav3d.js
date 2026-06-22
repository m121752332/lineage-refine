// nav3d.js — pure navigation logic, no Babylon, no DOM (Node + browser importable)
export const TILE_PX = 40;

// Legend: # wall  . floor  S start  O olin  C campfire  t torch  P pillar
// Outer ring is solid wall. Interior floor is contiguous (blocks are detached),
// guaranteeing connectivity; Olin sits in a 3-wall alcove with a downward opening.
export const TILEMAP = [
  '########################',
  '#S....t..........t.....#',
  '#......................#',
  '#..####.....###........#',
  '#..#..#.....#O#...PP...#',
  '#..#..#.....#.#........#',
  '#..#..#...............t#',
  '#......................#',
  '#..........C...........#',
  '#......................#',
  '#t...####.......####..P#',
  '#....#..............#..#',
  '#....#..............#..#',
  '#....####.......####..t#',
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

// ── Navigation grid (finer than tiles; half-body margin keeps paths off walls) ──
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

// ── A* pathfinding + line-of-sight smoothing (ported from the proven 2D nav) ──
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

// ── Collision-step check + logic<->Babylon coordinate mapping ──
// Same half-box rule the old 2D loop used: keep the player body on walkable ground.
export function canStep(x, y, nx, ny, px = 16) {
  const inX = walkable(nx, y - px) || walkable(nx, y + px);
  const inY = walkable(x - px, ny) || walkable(x + px, ny);
  return inX || inY;
}
// Babylon world units per logic pixel. Map is centered at the origin; logic-south = -Z.
export const WORLD_SCALE = 0.04;
export function logicToWorld(x, y) {
  const { widthPx, heightPx } = mapSize();
  return { X: (x - widthPx / 2) * WORLD_SCALE, Z: (heightPx / 2 - y) * WORLD_SCALE };
}
export function worldToLogic(X, Z) {
  const { widthPx, heightPx } = mapSize();
  return { x: X / WORLD_SCALE + widthPx / 2, y: heightPx / 2 - Z / WORLD_SCALE };
}
