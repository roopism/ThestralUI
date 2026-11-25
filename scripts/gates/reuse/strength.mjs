import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { stagedDiff, treeFiles } from '../../selection/staged-tree.mjs';

const matrixPath = 'tests/acceptance/suite-inputs.json';
const limitsPath = 'scripts/gates/reuse/guardrails.json';
const incumbent = JSON.parse(readFileSync(new URL('./guardrails.json', import.meta.url)));
const supported = ['docs/**', '*.md'];
const devices = ['iPhone Simulator','Android standard and low-end'];
const linux = 'Linux browser behavior';
const array = value => Array.isArray(value) && value.every(x => typeof x === 'string' && x) && value.length === new Set(value).size;
const retained = (next, prior) => array(next) && prior.every(value => next.includes(value));

function validateLimits(before, after, report) {
  if (!after || after.contractVersion !== 1) { report('removed or unknown guardrails'); return; }
  for (const limits of [before ?? incumbent, incumbent]) {
    if (!Number.isFinite(after.ttlHours) || after.ttlHours < 0 || after.ttlHours > limits.ttlHours) report('extended record lifetime');
    if (!Number.isSafeInteger(after.flakeWindow) || after.flakeWindow < limits.flakeWindow) report('shortened fresh failure history');
    if (!Number.isSafeInteger(after.minAuditGroups) || after.minAuditGroups < limits.minAuditGroups) report('reduced the audit rate');
    if (!retained(after.neverExclude, limits.neverExclude)) report('removed a mandatory fingerprint input');
    if (!retained(after.neverGroups, limits.neverGroups)) report('removed an always-fresh group');
  }
}

function validateMatrix(before, after, limits, report, mac) {
  if (after?.contractVersion !== 1 || !after.groups || typeof after.groups !== 'object' || Array.isArray(after.groups)) {
    report('removed or unknown input matrix'); return;
  }
  for (const id of Object.keys(before?.groups ?? {})) if (!after.groups[id]) report('removed group ' + id);
  for (const id of limits.neverGroups) if (after.groups[id]?.reusable !== false || after.groups[id]?.mode !== 'never')
    report('enabled or removed always-fresh group ' + id);
  for (const [id, group] of Object.entries(after.groups)) {
    const prior = before?.groups[id];
    if (!group || typeof group.reusable !== 'boolean' || !['tree','app','never'].includes(group.mode) ||
        ![group.envFacts,group.extraInputs,group.exclude].every(array)) { report('malformed group ' + id); continue; }
    if (prior?.mode === 'never' && group.mode !== 'never' || group.mode === 'never' && group.reusable) report('enabled a never group ' + id);
    if (prior && !retained(group.envFacts, prior.envFacts)) report('removed an environment fact for ' + id);
    if (prior && !retained(group.extraInputs, prior.extraInputs)) report('removed an external input for ' + id);
    if (group.exclude.some(pattern => !supported.includes(pattern))) report('unknown exclusion for ' + id);
    if (group.reusable && group.mode !== (devices.includes(id) ? 'app' : 'tree')) report('wrong fingerprint mode for ' + id);
    if (group.exclude.length && (group.mode !== 'tree' || ![...mac,linux].includes(id)))
      report('added an exclusion to a group without enforcement: ' + id);
    if (id === 'Mac visual comparisons' && !retained(group.envFacts,
      ['hardware-model', 'gpu', 'display-scale', 'fonts', 'macos-build'])) report('missing visual environment facts');
  }
}

const core = 'scripts/gates/reuse/';
const runners = ['scripts/gates/local-run.mjs','scripts/qualify.mjs','scripts/land.mjs','scripts/gates/linux-vm.mjs'];
const controlFiles = path => path.startsWith(core) && path.endsWith('.mjs') || path.startsWith('scripts/gates/tests/reuse-') ||
  path === 'scripts/gates/canaries.mjs' || path === matrixPath || path === limitsPath || runners.includes(path);

// Compare executable decisions, ignoring comments and whitespace. An earlier exit, a new
// conditional around the old operation, or returning the original unsandboxed command differs.
function operations(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw Error('Cannot parse reuse safeguard ' + path);
  const result = new Map();
  const wrapper = /\/sandbox-(?:mac|linux)\.mjs$/.test(path);
  const canary = /(?:canaries|mutation-controls|mutations|tests\/reuse-[^/]+\.test)\.mjs$/.test(path);
  function shape(node) {
    if (!node) return null;
    const children = [];
    ts.forEachChild(node, child => { children.push(shape(child)); });
    return children.length ? [node.kind, ...children] : [node.kind, node.text ?? ''];
  }
  function visit(node, context) {
    const name = ts.isCallExpression(node) ? node.expression.getText(file) : '';
    const policyGuard = path === core+'policy.mjs' && (
      ts.isIfStatement(node) && /ttlHours|flakeWindow|neverGroups|minAuditGroups|retries|audit/.test(node.expression.getText(file)) ||
      ts.isPropertyAssignment(node) && node.name.getText(file) === 'reuse');
    const fingerprintGuard = path === core+'fingerprint.mjs' && (
      ts.isVariableDeclaration(node) && node.name.getText(file) === 'protectedInput' || name === 'protectedInput');
    if (policyGuard || fingerprintGuard || (path === 'scripts/gates/linux-vm.mjs' && ts.isStringLiteralLike(node) && node.text.includes('sandbox-linux.mjs')) ||
        (wrapper && (ts.isReturnStatement(node) || ts.isStringLiteralLike(node) &&
         /sandbox-exec|deny file-read|landlock|no_new_privs/i.test(node.text))) ||
        (/^(?:macCommand|linuxCommand|selectAudit|assertAuditResult|reusePolicyIssues|disabledGroups)$/.test(name)) ||
        (canary && /^(?:assert(?:\..+)?|test)$/.test(name))) {
      const identity = canary && name === 'test' ? shape(node.arguments[0]) : shape(node);
      const key = JSON.stringify([context, identity]);
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      const preceding = [];
      for (const statement of node.statements) {
        visit(statement, [...context,...preceding]);
        if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement) ||
            ts.isIfStatement(statement) && ts.forEachChild(statement.thenStatement, child => ts.isReturnStatement(child)) ||
            ts.isIfStatement(statement) && ts.isReturnStatement(statement.thenStatement)) preceding.push(shape(statement));
      }
      return;
    }
    ts.forEachChild(node, child => {
      let frame;
      if (ts.isFunctionLike(node) && child === node.body) frame = ['function',node.name?.getText(file) ?? ''];
      if (ts.isIfStatement(node) && child !== node.expression) frame = ['if',shape(node.expression),child === node.thenStatement];
      if (ts.isConditionalExpression(node) && child !== node.condition) frame = ['conditional',shape(node.condition),child === node.whenTrue];
      if (ts.isCallExpression(node) && ['test','describe'].includes(name)) frame = [name,shape(node.arguments[0])];
      visit(child,frame ? [...context,frame] : context);
    });
  }
  visit(file,[]);
  return result;
}

function enrolledGroupIds(files) {
  const path=core+'store.mjs';
  const source=ts.createSourceFile(path,files.get(path) ?? '',ts.ScriptTarget.Latest,true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const list=declaration.initializer;
      if (declaration.name.getText(source)==='receiptGroups' && list && ts.isArrayLiteralExpression(list) &&
          list.elements.every(ts.isStringLiteralLike)) return new Set(list.elements.map(node=>node.text));
    }
  }
  return new Set();
}

function hasSandboxCall(path, text, guest) {
  const file=ts.createSourceFile(path,text ?? '',ts.ScriptTarget.Latest,true);
  if (file.parseDiagnostics.length) return false;
  let call=false, uploaded=false, executed=false;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text===(guest?'linuxCommand':'macCommand')) call=true;
    if (guest && ts.isNewExpression(node) && node.expression.getText(file)==='URL' &&
        node.arguments?.some(arg=>ts.isStringLiteralLike(arg) && arg.text==='./reuse/sandbox-linux.mjs')) uploaded=true;
    if (guest && ts.isStringLiteralLike(node) &&
        /\bnode\s+"[^"]*\/sandbox-linux\.mjs"\s+/.test(node.text)) executed=true;
    ts.forEachChild(node,visit);
  }
  visit(file);
  return call || (guest && uploaded && executed);
}

const parse = (files,path) => files.has(path) ? JSON.parse(files.get(path)) : undefined;

export function reusePolicyIssues(root, base, tree) {
  const changes = stagedDiff(root, { parent: base, tree }).changes;
  if (!changes.some(({path}) => controlFiles(path))) return [];
  const before = treeFiles(root, base, controlFiles), after = treeFiles(root, tree, controlFiles);
  const issues = new Set();
  const add = (file, message) => issues.add(file + ' ' + message);
  if (before.has(limitsPath) || after.has(limitsPath))
    validateLimits(parse(before,limitsPath),parse(after,limitsPath),message => add(limitsPath,message));
  const matrix = parse(after,matrixPath);
  const enrolled=enrolledGroupIds(after);
  const mac=[...enrolled].filter(id=>!devices.includes(id) && !incumbent.neverGroups.includes(id));
  if (before.has(matrixPath) || matrix)
    validateMatrix(parse(before,matrixPath),matrix,incumbent,message => add(matrixPath,message),mac);
  if (after.has(limitsPath) && after.has(matrixPath)) {
    const groups = Object.entries(matrix?.groups ?? {});
    for (const [group,entry] of groups.filter(([,entry]) => entry?.exclude?.length)) {
      const guest = group === linux;
      const wrapper = core + (guest ? 'sandbox-linux' : 'sandbox-mac') + '.mjs';
      const caller = guest ? 'scripts/gates/linux-vm.mjs' : 'scripts/gates/local-run.mjs';
      if (!entry.reusable || !enrolled.has(group) || !after.has(wrapper) || !hasSandboxCall(caller,after.get(caller),guest))
        add(matrixPath,'added an exclusion to a group without enforcement: ' + group);
    }
  }
  for (const {path,status} of changes) {
    if (!controlFiles(path)) continue;
    if (status === 'D') { add(path,'removed a reuse safeguard or canary'); continue; }
    if (status !== 'M' || !path.endsWith('.mjs')) continue;
    const previous = operations(path,before.get(path)), next = operations(path,after.get(path));
    for (const [key,count] of previous) if ((next.get(key) ?? 0) < count) {
      add(path,'disabled a reuse safeguard or removed a canary'); break;
    }
  }
  // The comparison itself and its data reader are the root of trust. They run from the adopted base.
  if (before.has(core+'strength.mjs') && before.get(core+'strength.mjs') !== after.get(core+'strength.mjs'))
    add(core+'strength.mjs','changed the trusted reuse comparison');
  return [...issues];
}

if (import.meta.main) {
  const [root, base, tree] = process.argv.slice(2);
  if (!root || !base || !tree) throw Error('Expected repository, base and candidate');
  const issues = reusePolicyIssues(root, base, tree);
  for (const message of issues) console.error(message);
  if (issues.length) process.exitCode = 1;
}
