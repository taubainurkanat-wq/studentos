import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTouch } from '../dist/touch.js';

function fixture() {
  globalThis.innerWidth = 844;
  const listeners = new Map();
  const changes = [],
    looks = [];
  let actions = 0;
  const canvas = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    setPointerCapture: () => {},
  };
  const joystick = { style: {}, classList: { add() {}, remove() {} } },
    stick = { style: {} };
  const control = bindTouch({
    canvas,
    joystick,
    stick,
    active: () => true,
    look: (x, y) => looks.push([x, y]),
    settings: { tapInteract: true },
    onChange: (x, z) => changes.push([x, z]),
    onInteract: () => actions++,
  });
  const event = (type, id, x, y) =>
    listeners.get(type)({
      type,
      pointerId: id,
      clientX: x,
      clientY: y,
      pointerType: 'touch',
      preventDefault() {},
    });
  return { control, event, changes, looks, actions: () => actions };
}
test('left and right fingers keep independent movement and look ownership', () => {
  const f = fixture();
  f.event('pointerdown', 1, 120, 250);
  f.event('pointermove', 1, 120, 190);
  assert.equal(f.changes.at(-1)[1], 1);
  f.event('pointerdown', 2, 650, 180);
  f.event('pointermove', 2, 690, 170);
  assert.ok(f.looks.at(-1)[0] > 0);
  assert.equal(f.changes.at(-1)[1], 1);
  f.event('pointerup', 2, 690, 170);
  assert.equal(f.changes.at(-1)[1], 1);
  f.event('pointerup', 1, 120, 190);
  assert.deepEqual(f.changes.at(-1), [0, 0]);
});
test('cancel and pause reset movement, and a simple right tap interacts once', () => {
  const f = fixture();
  f.event('pointerdown', 1, 100, 250);
  f.event('pointermove', 1, 150, 250);
  f.event('pointercancel', 1, 150, 250);
  assert.deepEqual(f.changes.at(-1), [0, 0]);
  f.event('pointerdown', 2, 650, 200);
  f.event('pointerup', 2, 650, 200);
  assert.equal(f.actions(), 1);
  f.event('pointerdown', 3, 100, 250);
  f.event('pointermove', 3, 150, 250);
  f.control.reset();
  assert.deepEqual(f.changes.at(-1), [0, 0]);
  f.event('pointermove', 3, 160, 250);
  assert.deepEqual(f.changes.at(-1), [0, 0]);
});
