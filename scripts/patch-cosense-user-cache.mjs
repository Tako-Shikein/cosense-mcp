// @cosense/std 0.29.14 caches one user ID across all SIDs. That breaks shared servers.
// Apply a narrow, checked dependency fix until an upstream version removes the cache.
// Never silently accept a dependency update: inspect it and update these hashes/tests.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('./pull.js', import.meta.resolve('@cosense/std/websocket'));
const originalHash = 'cad44120e6b782d3e5b5f6d45f2ef163627e1a2e00d386e343d5ff77f9e5d6fc';
const patchedHash = 'b859dd72ba2c08b8197dbe076adc1dbfc9be4c0a854f9704be62744e03af74dc';
const hash = text => createHash('sha256').update(text).digest('hex');
const source = readFileSync(path, 'utf8');
if (hash(source) !== patchedHash) {
  if (hash(source) !== originalHash) {
    throw new Error('Unrecognized @cosense/std websocket/pull.js; review the user identity cache before building');
  }
  const patched = source
    .replace('/** Cached user ID to avoid redundant profile API calls */ let userId;', '// Resolve identity for every SID; this module is shared by all MCP users.')
    .replace("Get the current user's ID with caching", "Get the current user's ID without process-global caching")
    .replace(' * This function caches the user ID in memory to reduce API calls.\n * The cache is invalidated when the page is reloaded.', " * A shared MCP server must not reuse another account's identity.")
    .replace('  if (userId) return createOk(userId);\n', '')
    .replace('    userId = user.id;\n', '');
  if (hash(patched) !== patchedHash) throw new Error('User identity cache patch verification failed');
  writeFileSync(path, patched);
}
console.log('@cosense/std: per-request user identity verified');
