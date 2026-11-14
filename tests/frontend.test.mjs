import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../frontend/api.js';
import { esc, points, sortedTasks } from '../frontend/utils.js';

test('presentation helpers escape input and preserve GPA/deadline behavior', () => {
  assert.equal(esc('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.equal(points(95), 4);
  assert.equal(points(49), 0);
  const tasks = [{id: 1, due_date: null}, {id: 2, due_date: '2026-12-01'}];
  assert.deepEqual(sortedTasks(tasks).map(task => task.id), [2, 1]);
  assert.equal(tasks[0].id, 1);
});

test('API client reads the current token and serializes request bodies', async () => {
  const original = globalThis.fetch;
  let token = 'first';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url, ...options});
    return {ok: true, json: async () => ({id: 7})};
  };
  try {
    const api = createApi(() => token, () => assert.fail('unexpected sign out'));
    assert.deepEqual(await api('/api/tasks', {method: 'POST', body: {title: 'Read'}}), {id: 7});
    token = 'second';
    await api('/api/state');
    await api('/api/auth/demo', {method: 'POST', authorized: false});
    assert.equal(calls[0].headers.Authorization, 'Bearer first');
    assert.equal(calls[0].headers['Content-Type'], 'application/json');
    assert.equal(calls[0].body, '{"title":"Read"}');
    assert.equal(calls[1].headers.Authorization, 'Bearer second');
    assert.equal(calls[2].headers.Authorization, undefined);
  } finally { globalThis.fetch = original; }
});

test('only authenticated 401 responses trigger sign out', async () => {
  const original = globalThis.fetch;
  let signedOut = 0;
  globalThis.fetch = async () => ({ok: false, status: 401, json: async () => ({detail: 'Session expired'})});
  try {
    const api = createApi(() => 'token', () => signedOut++);
    await assert.rejects(api('/api/state'), /Session expired/);
    await assert.rejects(api('/api/auth/login', {authorized: false}), /Session expired/);
    assert.equal(signedOut, 1);
  } finally { globalThis.fetch = original; }
});
