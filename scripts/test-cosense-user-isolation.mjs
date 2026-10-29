import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOk, unwrapOk } from 'option-t/plain_result';
import { pull } from '../node_modules/@cosense/std/websocket/pull.js';

// Exercise the installed dependency, not a mock of pull or its user cache.
// No real SID, network requests, or page writes are involved.
const calls = [];
const fetch = async request => {
  const path = new URL(request.url).pathname;
  const cookie = request.headers.get('Cookie');
  let body;
  if (path === '/api/users/me') {
    calls.push(cookie);
    body = cookie === 'connect.sid=TEST_A' ? { id: 'user-A' }
      : cookie === 'connect.sid=TEST_B' ? { id: 'user-B' } : {};
  } else if (path.startsWith('/api/pages/')) {
    body = { id: 'page', lines: [] };
  } else {
    body = { id: 'project' };
  }
  return createOk(Response.json(body));
};

test('sequential and concurrent users keep their own identity; expired sessions fail', async () => {
  for (const [sid, id] of [['TEST_A', 'user-A'], ['TEST_B', 'user-B'], ['TEST_A', 'user-A']]) {
    const result = await pull('test', 'test', { sid, fetch });
    assert.equal(unwrapOk(result).userId, id);
  }
  const results = await Promise.all(['TEST_A', 'TEST_B'].map(sid => pull('test', 'test', { sid, fetch })));
  assert.deepEqual(results.map(result => unwrapOk(result).userId), ['user-A', 'user-B']);
  const expired = await pull('test', 'test', { sid: 'TEST_EXPIRED', fetch });
  assert.equal(expired.ok, false);
  assert.equal(expired.err.name, 'NotLoggedInError');
  assert.equal(calls.length, 6);
});
