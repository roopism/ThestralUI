import { createHash } from 'node:crypto';
import { SaxesParser } from 'saxes';
import { inspectCss, literalIssue } from './css.mjs';
import { inspectScript } from './jsx.mjs';
export { validateTokens } from './tokens.mjs';

const messages = {
  'style/palette': 'Read a semantic color from the active mode instead of the source palette.',
  'style/token': 'Replace the literal or unknown variable with a declared semantic token.',
  'style/scope':
    'Anchor each selector to a component scope and keep its matches inside that scope.',
  'style/runtime':
    'Use a semantic token or record this exact measured expression with its owner, reason and expiry.',
};
function digest(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function inspectSource(path, source, options) {
  options = { ...options, component: /^packages\/(?:web|native)\/src\//.test(path) };
  const findings = [];
  function report(rule, line, context, property, value) {
    const id = digest([path, rule, context.trim(), property, value.trim()]);
    findings.push({
      id,
      path,
      line,
      rule,
      property,
      context: context.trim(),
      value: value.trim(),
      message: messages[rule],
    });
  }
  if (path.endsWith('.css')) inspectCss(source, options, report);
  else if (path.endsWith('.svg')) {
    const xml = new SaxesParser();
    let styleText = false;
    xml.on('opentag', (node) => {
      styleText = node.name === 'style';
      for (const [key, value] of Object.entries(node.attributes)) {
        if (key === 'style')
          inspectCss('.uld-svg{' + value + '}', options, report, xml.line, node.name);
        if (
          [
            'fill',
            'stroke',
            'stroke-width',
            'font-size',
            'font-family',
            'opacity',
            'stop-color',
            'flood-color',
          ].includes(key) &&
          literalIssue(key.replace(/^(?:stop|flood)-color$/, 'color'), value, options)
        )
          report('style/token', xml.line, node.name, key, value);
      }
    });
    xml.on('text', (value) => {
      if (styleText) inspectCss(value, options, report, xml.line);
    });
    xml.on('closetag', () => {
      styleText = false;
    });
    xml.write(source).close();
  } else inspectScript(path, source, options, report);
  return findings;
}

export function checkBaseline(findings, baseline, today = new Date().toISOString().slice(0, 10)) {
  const issues = [];
  const byId = new Map();
  for (const entry of baseline) {
    if (
      !/^[a-f0-9]{64}$/.test(entry.id) ||
      byId.has(entry.id) ||
      !entry.owner?.trim() ||
      !entry.reason?.trim() ||
      !Number.isInteger(entry.count) ||
      entry.count < 1 ||
      !messages[entry.rule]
    )
      throw new Error('Invalid or duplicate exact style exception: ' + entry.id);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires) ||
      Number.isNaN(Date.parse(entry.expires)) ||
      new Date(entry.expires).toISOString().slice(0, 10) !== entry.expires ||
      entry.expires <= today
    )
      issues.push('Expired style exception: ' + entry.path + ' ' + entry.id);
    if (entry.expires > '2027-02-18') issues.push('Style exception exceeds its retirement date: ' + entry.id);
    byId.set(entry.id, { ...entry, used: 0 });
  }
  for (const finding of findings) {
    const allowance = byId.get(finding.id);
    if (
      allowance &&
      allowance.path === finding.path &&
      allowance.rule === finding.rule &&
      ++allowance.used <= allowance.count
    )
      continue;
    issues.push(
      finding.path +
        ':' +
        finding.line +
        ' ' +
        finding.rule +
        ' [' +
        finding.property +
        '] ' +
        finding.message +
        ' (' +
        finding.id +
        ')',
    );
  }
  for (const entry of byId.values())
    if (entry.used < entry.count)
      issues.push('Remove an obsolete style exception: ' + entry.path + ' ' + entry.id);
  return issues;
}
