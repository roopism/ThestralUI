import { packedGzipSize } from '../verify-policy.mjs';
import postcss from 'postcss';
import { sheets } from '../selection/manifest-changes.mjs';

export { packedEntrySize, packedGzipSize } from '../verify-policy.mjs';

// Assemble immutable sources in copy-styles.mjs order. PostCSS offsets then identify the owning blocks.
function stylesheetBlocks(sources) {
  const destinations = new Map();
  for (const path of [...sources.keys()].sort()) {
    if (!path.startsWith('packages/web/src/') || !path.endsWith('.css')) continue;
    const source = sources.get(path);
    const headers = [...source.matchAll(/^\/\* @uld-css-chunk ([\w-]+)(?:\.(\d+))? \*\/\n/gm)];
    for (const [index, header] of headers.entries()) {
      const entry = './' + header[1] + '.css';
      const text = source.slice(header.index + header[0].length, headers[index + 1]?.index);
      if (header[2] && !text.endsWith('\n')) throw Error('Unterminated numbered stylesheet block in ' + path);
      const order = header[2] ? Number(header[2]) : Infinity;
      if (!destinations.has(entry)) destinations.set(entry, []);
      destinations.get(entry).push({ path, order, css: header[2] ? text.slice(0, -1) : '\n' + text.trimEnd() });
    }
  }
  for (const blocks of destinations.values()) blocks.sort((a, b) => a.order - b.order);
  return destinations;
}

// Skip a compatibility destination only if every family rule there is already supplied.
export function sharedStyleEntries(files, sources, pkg, published, standalone) {
  const destinations = stylesheetBlocks(sources);
  const rules = new Map();
  for (const path of files) {
    if (!path.startsWith('packages/web/src/') || !path.endsWith('.css')) continue;
    const source = sources.get(path) ?? '';
    for (const entry of new Set(sheets(source, path, published))) {
      const name = pkg + entry.slice(1);
      if (!rules.has(name)) rules.set(name, []);
      const blocks = destinations.get(entry);
      const ranges = [];
      let css = '';
      for (const block of blocks) {
        const start = css.length;
        css += block.css;
        if (block.path === path && css.length > start) ranges.push([start, css.length]);
      }
      let nodes;
      try { nodes = postcss.parse(css, { from: path }).nodes; }
      catch (error) {
        if (error.name !== 'CssSyntaxError') throw error;
        // An unparseable destination cannot supply proof of a duplicate.
        rules.get(name).push(Symbol(path));
        continue;
      }
      for (const node of nodes) {
        // A selector or enclosing condition may begin and end in another family's blocks.
        if (node.type === 'comment' || !ranges.some(([start, end]) =>
          node.source.start.offset < end && node.source.end.offset > start)) continue;
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
