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
