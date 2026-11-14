import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL,
  createGrid,
  freshState,
  findPath,
  parseSave,
  canStand,
  visible,
  stage,
} from '../dist/core.js';
const grid = createGrid();
const point = (x, z) => ({ x: x * CELL, z: z * CELL });

test('every objective is reachable in order, with room 13 locked until the key is used', () => {
  const start = freshState();
  const fuse = point(7, 13.4),
    panel = point(3.7, 4.5),
    key = point(3.8, 5.5),
    door = point(21.5, 8.5),
    note = point(21.5, 4.3),
    exit = point(1.8, 9);
  for (const [a, b] of [
    [start, fuse],
    [fuse, panel],
    [panel, key],
    [key, door],
  ])
    assert.ok(findPath(grid, a, b, false).length > 0);
  assert.equal(findPath(grid, door, note, false).length, 0);
  assert.ok(findPath(grid, door, note, true).length > 0);
  assert.ok(findPath(grid, note, exit, true).length > 0);
  assert.ok(
    visible(grid, door, point(21.5, 8.05), false),
    'locked door can be interacted with from corridor',
  );
});

test('walls and the locked room block movement and visibility', () => {
  assert.equal(canStand(grid, 0.5 * CELL, 0.5 * CELL), false);
  assert.equal(canStand(grid, 21.5 * CELL, 7.5 * CELL, false), false);
  assert.equal(canStand(grid, 21.5 * CELL, 7.5 * CELL, true), true);
  assert.equal(visible(grid, point(10.5, 8.5), point(12.5, 4.5)), false);
});

test('save round trip preserves all stages and rejects broken state', () => {
  const state = freshState();
  assert.equal(stage(state), 0);
  for (const [change, expected] of [
    [{ fuse: true }, 1],
    [{ power: true }, 2],
    [{ key: true, doorOpen: true }, 3],
    [{ code: true }, 4],
  ]) {
    Object.assign(state, change);
    assert.equal(stage(state), expected);
    assert.deepEqual(parseSave(JSON.stringify(state), grid), state);
  }
  assert.equal(parseSave('{broken', grid), null);
  assert.equal(parseSave(JSON.stringify({ ...state, x: null }), grid), null);
  assert.equal(parseSave(JSON.stringify({ ...state, x: 0, z: 0 }), grid), null);
  assert.equal(parseSave(JSON.stringify({ ...freshState(), code: true }), grid), null);
  assert.equal(parseSave(JSON.stringify({ ...state, version: 3 }), grid), null);
});

test('saved notes are filtered and battery / stamina bounds are normalized', () => {
  const state = freshState();
  state.battery = -20;
  state.stamina = 500;
  state.notes = ['warning', 'unknown'];
  const parsed = parseSave(JSON.stringify(state), grid);
  assert.equal(parsed.battery, 0);
  assert.equal(parsed.stamina, 100);
  assert.deepEqual(parsed.notes, ['warning']);
});

test('the quiet room is navigable and separated by walls from patrol corridor', () => {
  const safe = point(12.5, 4.8),
    hall = point(12.5, 8.5);
  assert.ok(canStand(grid, safe.x, safe.z));
  assert.ok(findPath(grid, safe, hall, false).length > 0);
  assert.equal(visible(grid, point(15.5, 8.5), safe, false), false);
});
