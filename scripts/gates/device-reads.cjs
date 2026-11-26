// Preloaded only in the full device harness and its Node children. Keep misses:
// creating a formerly absent optional input can change the next build.
const fs = require('node:fs');
const { relative, resolve, isAbsolute } = require('node:path');
const { fileURLToPath } = require('node:url');
const { syncBuiltinESMExports, registerHooks } = require('node:module');
const { openSync, writeSync } = fs;
const fd = openSync(process.env.ULD_DEVICE_READS, 'a', 0o600);
const roots = JSON.parse(process.env.ULD_DEVICE_ROOTS).map(root => fs.realpathSync(root));
const seen = new Set();
function record(value, kind) {
  if (typeof value === 'number' || value == null) return;
  if (value instanceof URL) value = fileURLToPath(value);
  if (Buffer.isBuffer(value)) value = new TextDecoder('utf8', { fatal: true }).decode(value);
  if (typeof value !== 'string') throw Error('Unclassified filesystem input');
  for (const root of roots) {
    const path = relative(root, resolve(value));
    if (path === '..' || path.startsWith('../') || isAbsolute(path)) continue;
    const row = JSON.stringify([kind, path]);
    if (!seen.has(row)) { writeSync(fd, row + '\n'); seen.add(row); }
    break;
  }
}
for (const api of [fs, fs.promises]) {
  for (const stem of ['open','readFile','stat','lstat','readdir','opendir','readlink','realpath',
    'access','exists','createReadStream','copyFile','cp','glob']) {
    for (const name of [stem, stem + 'Sync']) {
      const original = api[name];
      if (typeof original !== 'function') continue;
      const wrap = fn => function(input, ...args) {
        if (stem === 'glob') {
          // Globs inside a staged Metro host refer to packaged dependencies. Any glob
          // over the proposal has to be resolved before that observation can scope a PR.
          const cwd = args[0]?.cwd ?? process.cwd();
          record(cwd, 'opaque');
          for (const pattern of [].concat(input)) {
            if (typeof pattern !== 'string' || pattern.includes('..') || isAbsolute(pattern)) {
              writeSync(fd, JSON.stringify(['opaque', 'unbounded filesystem glob']) + '\n');
            }
          }
        }
        else record(input, stem === 'cp' ? 'tree' : ['readdir','opendir'].includes(stem) ?
          (args[0]?.recursive ? 'tree' : 'listing') : 'file');
        return Reflect.apply(fn, this, [input, ...args]);
      };
      api[name] = wrap(original);
      if (original.native) api[name].native = wrap(original.native);
    }
  }
}
syncBuiltinESMExports();
registerHooks({ load(url, context, next) {
  if (url.startsWith('file:')) record(new URL(url), 'file');
  return next(url, context);
} });
