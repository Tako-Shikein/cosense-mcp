import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createOk, unwrapOk } from 'option-t/plain_result';
import { emit } from '../node_modules/@cosense/std/websocket/emit.js';

// Cosense websocket protocol 2 (2026-10-31): `commit` / `room:join` are emitted directly, and the
// connection carries `auth: { protocolVersion: 2 }`. Exercise the installed dependency with a fake
// socket; no network or real SID is involved.
const fakeSocket = reply => {
  const sent = [];
  return {
    sent,
    connected: true,
    on() {},
    off() {},
    emit(event, ...args) {
      sent.push([event, ...args]);
      args.at(-1)(reply);
    },
  };
};

test('commit and room:join are emitted under their own event names', async () => {
  const socket = fakeSocket({ data: { commitId: 'c1' } });
  const commit = await emit(socket, 'commit', { kind: 'page' });
  assert.equal(unwrapOk(commit).commitId, 'c1');
  await emit(socket, 'room:join', { pageId: 'p' });
  assert.deepEqual(socket.sent.map(([event, data]) => [event, data]), [
    ['commit', { kind: 'page' }],
    ['room:join', { pageId: 'p' }],
  ]);
});

test('server errors still surface as errors', async () => {
  const socket = fakeSocket({ error: { name: 'NotFastForwardError' } });
  const result = await emit(socket, 'commit', {});
  assert.equal(result.ok, false);
  assert.equal(result.err.name, 'NotFastForwardError');
});

test('the connection declares protocol version 2', () => {
  const source = readFileSync(new URL('../node_modules/@cosense/std/websocket/socket.js', import.meta.url), 'utf8');
  assert.match(source, /auth:\s*\{\s*protocolVersion:\s*2\s*\}/);
});
