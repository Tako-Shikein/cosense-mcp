// Cosense changed its websocket protocol (observed 2026-10-31): the browser now sends
// `auth: { protocolVersion: 2 }` on connect and emits `commit` / `room:join` directly instead of
// wrapping them in `socket.io-request`. @cosense/std 0.29.14 (and, as far as we know, 0.31.0)
// still speaks the old form, so every commit goes unanswered and push() retries forever.
// Apply a narrow, checked dependency fix until an upstream version speaks protocol 2.
// Never silently accept a dependency update: inspect it and update these hashes/tests.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const hash = text => createHash('sha256').update(text).digest('hex');

const edits = [
  {
    file: 'socket.js',
    originalHash: '2d6cb209c36b76a1799e0c39abac0ed6a71c055aad6612cf8a1c4ac75121a814',
    patchedHash: 'e52935e931960433c85e8deb2e6cedd1e213ae81f24a43649da1f32dade7bcd1',
    replace: [[
      '    reconnectionDelay: 5000,\n',
      '    reconnectionDelay: 5000,\n    auth: {\n      protocolVersion: 2\n    },\n',
    ]],
  },
  {
    file: 'emit.js',
    originalHash: '25d005fc79f7bcae461a9b59447d1f5cd6c95c95b11ed61b55dd79cf9c93ff0e',
    patchedHash: '8d37df39ca85d89b8ee5fdf79566bfa35788855a68e399dd79f6712d9e240dc9',
    replace: [[
      '  const payload = event === "commit" ? {\n    method: "commit",\n    data: data\n  } : {\n    method: "room:join",\n    data: data\n  };\n  socket.emit("socket.io-request", payload, (res)=>{',
      '  // Protocol 2: the method name is the event name and the data is sent as-is.\n  socket.emit(event === "commit" ? "commit" : "room:join", data, (res)=>{',
    ]],
  },
];

for (const edit of edits) {
  const path = new URL(`./${edit.file}`, import.meta.resolve('@cosense/std/websocket'));
  const source = readFileSync(path, 'utf8');
  if (hash(source) === edit.patchedHash) continue;
  if (hash(source) !== edit.originalHash) {
    throw new Error(`Unrecognized @cosense/std websocket/${edit.file}; check whether it speaks Cosense websocket protocol 2 before building`);
  }
  let patched = source;
  for (const [from, to] of edit.replace) {
    if (!patched.includes(from)) throw new Error(`Protocol patch anchor missing in ${edit.file}`);
    patched = patched.replace(from, to);
  }
  if (hash(patched) !== edit.patchedHash) throw new Error(`Protocol patch verification failed for ${edit.file}`);
  writeFileSync(path, patched);
}
console.log('@cosense/std: websocket protocol 2 verified');
