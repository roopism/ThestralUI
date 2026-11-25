const assert = require('node:assert/strict');
const { readFileSync, realpathSync, writeFileSync } = require('node:fs');
const { gzipSync } = require('node:zlib');
const Metro = require('metro');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

(async () => {
  const cwd = realpathSync(__dirname);
  const config = mergeConfig(getDefaultConfig(cwd), {
    projectRoot: cwd,
    maxWorkers: 2,
    watchFolders: [cwd],
    resolver: { useWatchman: false },
  });
  const results = [];
  for (const platform of ['ios', 'android']) {
    const path = platform + '.bundle';
    await Metro.runBuild(config, {
      entry: 'index.js',
      platform,
      dev: false,
      minify: true,
      bundleOut: path,
      sourceMap: true,
      sourceMapUrl: path + '.map',
      sourceMapOut: path + '.map',
    });
    const bytes = readFileSync(path);
    assert.ok(bytes.includes('NativeReleaseProbe'));
    const sourcesOf = (map) =>
      map.sections ? map.sections.flatMap((section) => sourcesOf(section.map)) : map.sources;
    const sources = sourcesOf(JSON.parse(readFileSync(path + '.map', 'utf8')));
    for (const name of [
      'index.js',
      'button/binding.js',
      'labeled-field/binding.js',
      'modal-dialog/binding.js',
    ])
      assert.ok(
        sources.some((source) => source.endsWith('/ui-native/dist/' + name)),
        'Missing packed ' + name,
      );
    assert.ok(sources.some((source) => source.endsWith('/tokens/dist/index.js')));
    assert.ok(
      !sources.some((source) => /ui-web\/dist|react-dom\//.test(source)),
      'Web code shipped in native',
    );
    results.push({ platform, bytes: bytes.length, gzip: gzipSync(bytes).length });
  }
  writeFileSync('results.json', JSON.stringify(results));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
