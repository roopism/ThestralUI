// Metro already returns a source map even when the Release CLI does not write it.
// Read the result of that very build without changing the bundle or Hermes flags.
const { writeFileSync } = require('node:fs');
const { relative, resolve } = require('node:path');
const host = process.cwd();
const Server = require('metro/private/Server').default;
const build = Server.prototype.build;
Server.prototype.build = async function(...args) {
  const result = await Reflect.apply(build, this, args);
  const files = new Set();
  function sources(map) {
    if (map.version !== 3 || map.sourceRoot) throw Error('Unknown Metro source map');
    if (map.sections) { for (const section of map.sections) sources(section.map); }
    else for (const file of map.sources) files.add(file);
  }
  sources(JSON.parse(result.map));
  for (const asset of result.assets) for (const file of asset.files) files.add(file);
  const paths = [...files].map(file => relative(host, resolve(host, file))).sort();
  if (!paths.includes('index.js')) throw Error('Metro did not report the device entry');
  writeFileSync(process.env.ULD_METRO_INPUTS, JSON.stringify(paths), { flag: 'wx' });
  return result;
};
