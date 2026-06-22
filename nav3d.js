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
