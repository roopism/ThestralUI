import assert from 'node:assert/strict';
import {
  mkdtempSync,
  cpSync,
  mkdirSync,
  appendFileSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, extname } from 'node:path';
import { scanProject } from '../../packages/style-policy/cli.mjs';

// Inject a unique token violation into every renderer source in an isolated working tree.
const root = resolve('.');
const temp = mkdtempSync(join(tmpdir(), 'ui-style-scope-'));
function list(path) {
  return readdirSync(join(root, path), { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory()
      ? list(child)
      : /\.(?:css|tsx?|jsx?|svg)$/.test(child)
        ? [child]
        : [];
  });
}
try {
  for (const path of [
    'packages/web/src',
    'packages/native/src',
    'catalog',
    'packages/tokens/tokens.json',
  ]) {
    mkdirSync(join(temp, dirname(path)), { recursive: true });
    cpSync(join(root, path), join(temp, path), { recursive: true });
  }
  const files = ['packages/web/src', 'packages/native/src'].flatMap(list).sort();
  assert.ok(
    files.includes('packages/web/src/avatar/binding.tsx'),
    'The published avatar entry must have an independently checked source.',
  );
  for (const path of files) {
    const file = join(temp, path);
    switch (extname(path)) {
      case '.css':
        appendFileSync(file, '\n.uld-scope-proof{border-radius:12347px}');
        break;
      case '.svg':
        writeFileSync(
          file,
          readFileSync(file, 'utf8').replace('</svg>', '<path stroke-width="12347"/></svg>'),
        );
        break;
      default:
        appendFileSync(
          file,
          '\ndocument.documentElement.style.setProperty("border-radius","12347px");\n',
        );
    }
  }
  const hits = scanProject(temp, 'library').findings.filter(
    (finding) => finding.rule === 'style/token' && finding.value.includes('12347'),
  );
  assert.deepEqual(hits.map((hit) => hit.path).sort(), files);
  console.log(
    'All ' +
      files.length +
      ' production renderer sources rejected a new raw style, including the published avatar.',
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
