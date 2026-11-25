import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { basename, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { verifyDefaultTransfer, verifyDefaultStyleOwners } from '../packages/policy/quality/transfer-policy.mjs';
import { readDefaultCeiling } from '../packages/policy/quality/size-ceiling.mjs';

// All shipped root components plus the documented enterprise theme/provider, loaded together.
const host = `
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
`;
const library = `
import { AdaptiveGrid, Button, FormField, useButton } from '@ui-lazy-dev/ui-web';
import { ModeProvider } from '@ui-lazy-dev/ui-web/modes';
import '@ui-lazy-dev/ui-web/styles.css';
import '@ui-lazy-dev/tokens/modes.css';
import '@ui-lazy-dev/tokens/brands/enterprise.css';
`;
function source(application) {
  const content = application
    ? '<ModeProvider brand="enterprise" scheme="light" density="comfortable"><AdaptiveGrid><FormField label="Name"><input /></FormField><Button onClick={save}>Save</Button><button {...headless.buttonProps}>Save again</button></AdaptiveGrid></ModeProvider>'
    : '<button onClick={save}>Save</button>';
  return host + (application ? library : '') + `
    function App() {
      const [count, setCount] = useState(0);
      const save = () => setCount(n => n + 1);
      ${application ? 'const headless = useButton({ onClick: save });' : ''}
      return <main><h1>Review</h1>${content}<output>{count}</output></main>;
    }
    createRoot(document.getElementById('app')).render(<App />);
  `;
}

function inputName(path) {
  if (path === 'consumer.tsx') return path;
  const prefix = 'node_modules/';
  assert.ok(path.startsWith(prefix), 'Dependency outside the packed installation: ' + path);
  const pos = path.lastIndexOf(prefix);
  assert.ok(pos >= 0, 'Dependency outside the packed installation: ' + path);
  return path.slice(pos + prefix.length);
}

async function bundle(cwd, application, externalPeers) {
  const result = await build({
    absWorkingDir: cwd, stdin: { contents: source(application), sourcefile: 'consumer.tsx', resolveDir: cwd, loader: 'tsx' },
    bundle: true, write: false, metafile: true, minify: true, treeShaking: true,
    platform: 'browser', format: 'esm', target: 'es2022', jsx: 'automatic', outfile: join(cwd, 'out/app.js'),
    external: externalPeers ? ['react', 'react-dom'] : [], define: { 'process.env.NODE_ENV': '"production"' },
  });
  const assets = result.outputFiles.map(file => {
    const key = relative(cwd, file.path), output = result.metafile.outputs[key];
    assert.equal(output?.bytes, file.contents.length, 'Unmeasured compiler output: ' + key);
    // A remote URL, an unmeasured chunk or an unexpected external would undercount transfer.
    for (const dependency of output.imports) {
      assert.ok(externalPeers && dependency.external && /^(?:react|react-dom)(?:\/|$)/.test(dependency.path),
        'Unmeasured transitive asset: ' + dependency.path);
    }
    if (file.path.endsWith('.js')) {
      assert.equal(output.entryPoint, 'consumer.tsx');
      assert.equal(output.cssBundle, application ? 'out/app.css' : undefined);
    }
    const inputs = Object.entries(output.inputs).filter(([, value]) => value.bytesInOutput > 0).map(([path]) => inputName(path));
    const body = gzipSync(file.contents, { level: 9 });
    return { name: basename(key), body, gzip: body.length, raw: file.contents.length,
      sha256: createHash('sha256').update(file.contents).digest('hex'), inputs };
  });
  assert.equal(result.outputFiles.length, Object.keys(result.metafile.outputs).length, 'Missing packed output file');
  return assets;
}

async function transfer(browser, assets, application) {
  const counts = new Map(), html = '<!doctype html><meta charset="utf-8">' +
    (application ? '<link rel="stylesheet" href="/app.css">' : '') + '<div id="app"></div><script type="module" src="/app.js"></script>';
  const server = createServer((req, res) => {
    if (req.url === '/') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    const asset = assets.find(row => '/' + row.name === req.url);
    if (!asset) return res.writeHead(404).end();
    counts.set(asset.name, (counts.get(asset.name) ?? 0) + 1);
    res.writeHead(200, { 'Content-Type': asset.name.endsWith('.css') ? 'text/css' : 'text/javascript',
      'Content-Encoding': 'gzip', 'Content-Length': asset.gzip, 'Cache-Control': 'no-store' }).end(asset.body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let context;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('1', { exact: true }).waitFor();
    if (application) {
      await page.getByRole('textbox', { name: 'Name' }).waitFor();
      await page.getByRole('button', { name: 'Save again' }).click();
      await page.getByText('2', { exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    const requests = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.initiatorType !== 'other' || !entry.name.endsWith('/favicon.ico'))
      .map(entry => ({ name: new URL(entry.name).pathname.slice(1), encoded: entry.encodedBodySize, decoded: entry.decodedBodySize })));
    return requests.map(request => ({ ...request, served: counts.get(request.name) ?? 0 }));
  } finally {
    try { await context?.close(); }
    finally { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  }
}

export async function measureDefaultTransfer(directory, browser) {
  const cwd = await realpath(directory);
  verifyDefaultStyleOwners(process.cwd());
  const require = createRequire(join(cwd, 'package.json'));
  const root = await import(pathToFileURL(require.resolve('@ui-lazy-dev/ui-web')));
  assert.deepEqual(Object.keys(root).sort(), ['AdaptiveGrid', 'Button', 'FormField', 'useButton'],
    'The documented default fixture must exercise every root runtime export');
  const report = {};
  const evidence = rows => rows.map(({ body, ...metadata }) => metadata);
  for (const [kind, application] of [['emptyHost', false], ['application', true]]) {
    const external = await bundle(cwd, application, true), full = await bundle(cwd, application, false);
    report[kind] = { externalPeers: evidence(external), full: evidence(full), network: await transfer(browser, full, application) };
  }
  verifyDefaultTransfer(report, readDefaultCeiling());
  return report;
}
