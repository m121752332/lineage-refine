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
