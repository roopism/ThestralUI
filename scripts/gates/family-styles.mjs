import { gzipSync } from 'node:zlib';
import postcss from 'postcss';
import { sheets } from '../selection/manifest-changes.mjs';

export const packedGzipSize = bytes => gzipSync(bytes, { level: 9 }).length;

export function packedEntrySize(label, output) {
  const size = { entry: label, gzip: packedGzipSize(output.contents) };
  if (label.endsWith('.css')) size.css = output.text;
  return size;
}

// Skip a compatibility destination only if every family rule there is already supplied.
export function sharedStyleEntries(files, sources, pkg, published, standalone) {
  const rules = new Map();
  for (const path of files) {
    if (!path.startsWith('packages/web/src/') || !path.endsWith('.css')) continue;
    const source = sources.get(path) ?? '';
    for (const css of source.split(/(?=^\/\* @uld-css-chunk [\w-]+(?:\.\d+)? \*\/\n)/m)) {
      const [entry] = sheets(css, path, published);
      const name = pkg + entry.slice(1);
      if (!rules.has(name)) rules.set(name, []);
      let nodes;
      try { nodes = postcss.parse(css, { from: path }).nodes; }
      catch (error) {
        if (error.name !== 'CssSyntaxError') throw error;
        // A numbered chunk can finish a rule from another source. Charge its packed sheet.
        rules.get(name).push(Symbol(path));
        continue;
      }
      for (const node of nodes) {
        if (node.type === 'comment') continue;
        const target = node.type === 'atrule' && node.name === 'import' && /^(["'])(\.\/[\w-]+\.css)\1$/.exec(node.params);
        rules.get(name).push(target ? pkg + target[2].slice(1) : 'rule:' + node.toString());
      }
    }
  }

  const covered = new Set(standalone);
  for (const name of standalone) for (const rule of rules.get(name) ?? []) covered.add(rule);
  const additional = new Set();
  function visit(name, visiting) {
    if (covered.has(name)) return;
    if (visiting.has(name)) throw Error('Cyclic family stylesheet import: ' + name);
    visiting.add(name);
    const content = rules.get(name);
    for (const rule of content) if (rules.has(rule)) visit(rule, visiting);
    if (content.some(rule => !covered.has(rule))) additional.add(name);
    for (const rule of content) covered.add(rule);
    covered.add(name);
    visiting.delete(name);
  }
  for (const name of rules.keys()) visit(name, new Set());
  // Even an empty registered sheet needs packed evidence for a shared-only family.
  return !standalone.size && !additional.size ? new Set(rules.keys()) : additional;
}

// Compare rules in their enclosing at-rules so matching selectors in different scopes remain distinct.
export function familyStyleBytes(sizes, standalone, measurements) {
  const paid = new Set();
  let total = 0;
  for (const [name, size] of sizes) {
    if (!size) continue;
    const measurement = measurements?.find(item => item?.entry === name);
    const css = measurement?.css;
    if (css === undefined || measurement.gzip !== size) {
      total += size;
      continue;
    }
    if (typeof css !== 'string' || packedGzipSize(css) !== size) throw Error('Invalid packed CSS for ' + name);
    const sheet = postcss.parse(css, { from: undefined }), current = new Set();
    let removed = false;
    function visit(parent, scope) {
      for (const node of [...parent.nodes]) {
        if (node.type === 'atrule' && node.nodes && node.nodes.length && node.params &&
            ['layer', 'media', 'supports', 'container', 'scope'].includes(node.name)) {
          visit(node, [...scope, [node.name, node.params]]);
          if (!node.nodes.length) node.remove();
        } else {
          const key = JSON.stringify([...scope, node.toString()]);
          current.add(key);
          if (!standalone.has(name) && paid.has(key)) {
            node.remove();
            removed = true;
          }
        }
      }
    }
    visit(sheet, []);
    for (const rule of current) paid.add(rule);
    total += removed ? (sheet.nodes.length ? packedGzipSize(sheet.toString()) : 0) : size;
  }
  return total;
}
