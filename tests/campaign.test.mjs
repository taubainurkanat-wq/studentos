import test from 'node:test';
import assert from 'node:assert/strict';
import { CELL, createGrid, freshState, findPath, canStand, parseSave } from '../dist/core.js';
import {
  levels,
  tasksFor,
  completeTask,
  floorReady,
  nextFloor,
  levelCode,
  dailySeed,
} from '../dist/campaign.js';
function levelState(level, runMode = 'story') {
  return {
    ...freshState(),
    level,
    runMode,
    seed: 20261114,
    power: level > 0,
    key: level > 0,
    doorOpen: level > 0,
  };
}

test('all campaign tasks and exits are reachable on five distinct floor plans', () => {
  const plans = [];
  for (let level = 0; level < levels.length; level++) {
    const state = levelState(level),
      grid = createGrid(level);
    plans.push(JSON.stringify(grid));
    for (const task of tasksFor(state)) {
      assert.ok(canStand(grid, task.x, task.z, true), `${level} ${task.id} is not inside a wall`);
      assert.ok(findPath(grid, state, task, true).length, `${level} ${task.id} is reachable`);
    }
    assert.ok(findPath(grid, state, { x: 1.8 * CELL, z: 9 * CELL }, true).length);
  }
  assert.equal(new Set(plans).size, 5);
});

test('archive console needs all fragments and notes contain the actual daily code', () => {
  const state = levelState(1, 'challenge');
  assert.equal(completeTask(state, 'archive').ok, false);
  for (const id of ['fileA', 'fileB', 'fileC']) assert.equal(completeTask(state, id).ok, true);
  const result = completeTask(state, 'archive');
  assert.ok(result.ok);
  assert.ok(result.note.includes(levelCode(state)));
  assert.ok(floorReady(state));
  assert.equal(completeTask(state, 'archive').ok, false);
});

test('valves require a note and the correct order, and wrong order resets only valves', () => {
  const state = levelState(2);
  assert.equal(completeTask(state, 'blue').ok, false);
  completeTask(state, 'valveNote');
  completeTask(state, 'blue');
  assert.equal(completeTask(state, 'gold').alarm, true);
  assert.deepEqual(state.completed, ['valveNote']);
  for (const id of ['blue', 'red', 'gold', 'pressure'])
    assert.equal(completeTask(state, id).ok, true);
  assert.ok(floorReady(state));
});

test('radio and generator enforce prerequisite tasks and timer is saved', () => {
  const radio = levelState(3);
  assert.equal(completeTask(radio, 'radio').ok, false);
  for (const id of ['batteryA', 'batteryB', 'frequency', 'radio', 'transcript'])
    assert.equal(completeTask(radio, id).ok, true);
  assert.ok(floorReady(radio));
  const basement = levelState(4);
  assert.equal(completeTask(basement, 'generator').ok, false);
  for (const id of ['cellA', 'cellB', 'cellC', 'generator']) completeTask(basement, id);
  assert.equal(basement.escapeRemaining, 180);
  assert.equal(parseSave(JSON.stringify(basement), createGrid(4)).escapeRemaining, 180);
});

test('progression carries time and collectibles while clearing floor-specific tasks', () => {
  let state = levelState(0);
  state.code = true;
  state.fuse = true;
  state.power = true;
  state.key = true;
  state.doorOpen = true;
  state.elapsed = 42;
  completeTask(state, 'echo');
  for (let level = 1; level < 5; level++) {
    state = nextFloor(state);
    assert.equal(state.level, level);
    assert.equal(state.elapsed, 42);
    assert.deepEqual(state.echoes, [0]);
    assert.deepEqual(state.completed, []);
    for (const task of tasksFor(state).filter((task) => !task.optional))
      assert.equal(completeTask(state, task.id).ok, true);
    assert.ok(floorReady(state));
    assert.ok(parseSave(JSON.stringify(state), createGrid(level)));
  }
  assert.equal(nextFloor(state), null);
});

test('v1 saves migrate without losing first-floor inventory', () => {
  const old = { ...freshState(), version: 1, fuse: true };
  delete old.level;
  delete old.completed;
  const migrated = parseSave(JSON.stringify(old), createGrid());
  assert.equal(migrated.version, 2);
  assert.equal(migrated.level, 0);
  assert.equal(migrated.fuse, true);
});

test('daily item rotation stays reachable across multiple days', () => {
  for (const seed of [20261114, 20261115, 20261116])
    for (let level = 1; level < 5; level++) {
      const state = { ...levelState(level, 'challenge'), seed };
      for (const task of tasksFor(state))
        assert.ok(
          findPath(createGrid(level), state, task, true).length,
          `${seed} ${level} ${task.id}`,
        );
    }
  assert.equal(dailySeed(new Date('2026-11-14T10:00:00Z')), 20261114);
});
