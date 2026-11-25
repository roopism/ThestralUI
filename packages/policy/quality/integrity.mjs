import ts from 'typescript';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function checkMatrix(rows, required) {
  assert.equal(rows.length, required.length, 'required matrix entry missing or repeated');
  for (const engine of required) {
    const row = rows.find((result) => result.engine === engine);
    assert.ok(
      row &&
        Number.isSafeInteger(row.passed) &&
        row.passed > 0 &&
        row.skipped === 0 &&
        row.failed === 0 &&
        row.flaky === 0,
      'required matrix failed, empty, skipped or flaky: ' + engine,
    );
  }
}

function expression(node) {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return node;
}

function memberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(expression(node.argumentExpression)))
    return expression(node.argumentExpression).text;
}

function globalObject(node) {
  node = expression(node);
  return ts.isIdentifier(node) && ['globalThis', 'window', 'self', 'global'].includes(node.text);
}

function globalApi(node, name) {
  node = expression(node);
  return ts.isIdentifier(node) ? node.text === name : memberName(node) === name && globalObject(node.expression);
}

// Look up locally constructed images only when a renderer assigns an image URL. Keep ordinary data properties valid.
function imageReceiver(value, seen = new Set()) {
  const node = expression(value);
  if (ts.isNewExpression(node)) return globalApi(node.expression, 'Image');
  if (!ts.isIdentifier(node) || seen.has(node)) return false;
  seen.add(node);
  for (let scope = node.parent; scope; scope = scope.parent) {
    if (ts.isFunctionLike(scope) && scope.parameters.some(parameter => parameter.name.getText() === node.text)) return false;
    const sources = [];
    let declared = false;
    for (const statement of scope.statements ?? []) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === node.text) {
            declared = true;
            if (declaration.initializer) sources.push(declaration.initializer);
          }
        }
      } else if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
        const write = statement.expression;
        if (write.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(write.left) && write.left.text === node.text)
          sources.push(write.right);
      }
    }
    if (sources.some(source => imageReceiver(source, seen))) return true;
    if (declared) return false;
  }
  return false;
}

export function checkSource(path, text) {
  const errors = [];
  const production = /^packages\/(web|native)\/src\//.test(path);
  const test = /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
  if (!production && !test) return errors;
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  function report(node, message) {
    errors.push(
      path + ':' + (source.getLineAndCharacterOfPosition(node.getStart()).line + 1) + ' ' + message,
    );
  }
  function stringKey(node) {
    if (!ts.isStringLiteralLike(node)) return false;
    return node.parent.name === node || ts.isComputedPropertyName(node.parent) ||
      (ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node);
  }
  function visit(node) {
    if (production && ts.isCallExpression(node)) {
      const fn = expression(node.expression);
      if (memberName(fn) === 'get' && globalApi(fn.expression, 'Reflect')) {
        const [target, key] = node.arguments;
        if (target && globalObject(target)) report(node, 'Reflective global access is forbidden in shared renderers.');
        if (key && ts.isStringLiteralLike(expression(key)) && expression(key).text === 'constructor')
          report(node, 'Dynamic code constructors are forbidden in shared renderers.');
      }
      if (ts.isIdentifier(fn) && fn.text === 'constructor') report(node, 'Dynamic code constructors are forbidden in shared renderers.');
    }
    if (production && (memberName(node) === 'constructor' || (ts.isBindingElement(node) &&
        ts.isObjectBindingPattern(node.parent) && (node.propertyName ?? node.name).text === 'constructor')))
      report(node, 'Dynamic code constructors are forbidden in shared renderers.');
    if (production && ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const target = expression(node.left);
      if (memberName(target) === 'src' && imageReceiver(target.expression))
        report(node, 'Keep image source assignments outside shared renderers. Delegate network I/O to the host.');
    }
    if (production && ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        (!node.arguments[0] || !ts.isStringLiteralLike(node.arguments[0]))) {
      report(node, 'Use a literal module specifier so the renderer dependency can be checked.');
    }
    if (production && (ts.isIdentifier(node) || stringKey(node)) && ['eval', 'Function'].includes(node.text))
      report(node, 'Dynamic code evaluation is forbidden in shared renderers.');
    if (
      production &&
      (ts.isIdentifier(node) || stringKey(node)) &&
      [
        'dangerouslySetInnerHTML',
        'innerHTML',
        'outerHTML',
        'insertAdjacentHTML',
        'fetch',
        'sendBeacon',
        'XMLHttpRequest',
        'WebSocket',
        'EventSource',
        'console',
      ].includes(node.text)
    ) {
      report(
        node,
        'Keep raw HTML, network traffic and logging outside shared renderers. Render labels as text or delegate I/O to the host.',
      );
    }
    if (test && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const fn = node.expression;
      if (
        ['skip', 'only', 'todo', 'fixme', 'fails', 'skipIf', 'runIf'].includes(fn.name.text) &&
        /^(?:test|it|describe|suite)(?:\.|$)/.test(fn.expression.getText(source))
      ) {
        // This app test always runs under the production gate. The matrix also rejects runtime skips.
        const legacyDevGuard =
          path === 'tests/e2e/workspace.spec.ts' &&
          fn.name.text === 'skip' &&
          node.arguments[0]?.getText(source) === "process.env.E2E_PRODUCTION !== '1'" &&
          node.arguments[1]?.getText(source) === "'Uses compressed production assets'";
        if (!legacyDevGuard)
          report(
            node,
            'Required tests must run. Restore this case and remove the skip or focus modifier.',
          );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return errors;
}

const secrets = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-(?:proj-)?[A-Za-z0-9_-]{36,}|AKIA[A-Z0-9]{16})\b/,
  /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{18,}\b/,
  // Gitleaks-style rules. Each one has a rejecting fixture in tests/contracts/integrity.test.mjs.
  /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----/,
  /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}\b/,
  /\baws.{0,20}?(?:secret|private).{0,20}?['"][A-Za-z0-9/+]{40}['"]/i,
  /\bey[A-Za-z0-9_-]{17,}\.ey[A-Za-z0-9_-]{17,}\.(?:[A-Za-z0-9_-]{10,}={0,2})?/,
  /\bnpm_[A-Za-z0-9]{36}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\bxox[abposr]-[0-9A-Za-z-]{10,}/,
  /\bhooks\.slack\.com\/(?:services|workflows)\/[A-Za-z0-9+/]{43,}/,
  /\b[sr]k_(?:live|test)_[0-9A-Za-z]{24,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}/,
  /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/,
  /\bdckr_pat_[A-Za-z0-9_-]{27,}/,
  /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/,
  /\bhf_[A-Za-z]{34}\b/,
  /_authToken\s*=\s*(?!\$\{)[^\s'"]{8,}/,
];
// A key-like name assigned a long, high-entropy literal. Placeholders and repeated text fall below the floor.
const assignment =
  /(?:api[_-]?key|secret|token|passw(?:or)?d|client[_-]?secret|access[_-]?key)["']?\s*[:=]\s*["']([A-Za-z0-9_+/=-]{20,})["']/gi;
function entropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) bits -= (count / value.length) * Math.log2(count / value.length);
  return bits;
}
function assignedSecret(text) {
  for (const match of text.matchAll(assignment)) if (entropy(match[1]) >= 3.5) return true;
  return false;
}
export function inspectSecret(path, bytes) {
  if (
    /(?:^|\/)(?:\.env(?:$|\.(?:local|production|development|test)$)|id_rsa|id_ed25519|[^/]+\.p12)$/.test(
      path,
    )
  )
    return [path + ' — remove the private configuration from the candidate'];
  const text = bytes.toString('latin1');
  return secrets.some((pattern) => pattern.test(text)) || assignedSecret(text)
    ? [
        path +
          ' — suspected credential; replace it with a synthetic fixture and inspect its history',
      ]
    : [];
}
export function inspectArchive(archive) {
  const errors = [];
  const members = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
  for (const member of members) {
    if (!member.startsWith('package/') || member.includes('\\') || member.split('/').includes('..')) {
      errors.push(archive + ' — unexpected archive member: ' + member);
      continue;
    }
    if (member.endsWith('/')) continue;
    const bytes = execFileSync('tar', ['-xOzf', archive, '--', member], {
      maxBuffer: 64 * 1024 * 1024,
    });
    errors.push(...inspectSecret(member, bytes));
  }
  return errors;
}

export function scan(root = process.cwd()) {
  const names = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root },
  )
    .toString()
    .split('\0')
    .filter(Boolean);
  const errors = [];
  for (const path of names) {
    const full = resolve(root, path);
    if (!existsSync(full)) continue;
    const bytes = readFileSync(full);
    errors.push(...inspectSecret(path, bytes));
    if (/\.[cm]?[tj]sx?$/.test(path)) errors.push(...checkSource(path, bytes.toString()));
    if (path.endsWith('.tgz')) errors.push(...inspectArchive(full));
  }
  if (errors.length) throw new Error(errors.join('\n'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) scan();
