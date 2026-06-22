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
  assert.ok(NAV_CELL > 0);
});

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
  // Row 2 (y≈100) is fully open floor — a straight clear corridor.
  const path = findPath(60, 100, 260, 100);
  assert.ok(path, 'open corridor is reachable');
  assert.ok(path.length <= 4, `expected a short smoothed path, got ${path.length}`);
});
