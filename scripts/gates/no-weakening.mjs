import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import ts from 'typescript';
import { fixtureRegistry, registeredNativeSlugs } from '../selection/native-tier-two.mjs';
import { stagedDiff } from '../selection/staged-tree.mjs';

const budget = /budget|limit|allowance|threshold|ceiling|max(?:imum|[A-Z_-])/i;
const baseline = /baseline|exceptions/i;
const registry = /(?:matrix|roster|scenario|manifest|families|policy|rules|\.eslintrc|tsconfig)/i;
const disabled = value => [false, 'off', 'disabled', 0].includes(Array.isArray(value) ? value[0] : value);
const sourceCode = /\.[cm]?[jt]sx?$/;
const measuredStories = new Set([
  'catalog/MotionGallery.stories.tsx', 'catalog/EnterpriseWorkspace.stories.tsx',
  'catalog/EnterpriseCollections.stories.tsx', 'catalog/collection-events.ts',
]);
const special = /^(?:tests\/|manifests\/|\.githooks\/|\.github\/|scripts\/|packages\/(?:policy|style-policy)\/)|(?:^|\/)(?:__tests__|test|scenarios|baselines)\/|\.(?:test|spec)\.|\.(?:scenarios\.ya?ml)$|(?:baseline|budget|threshold|ceiling|exceptions|eslint|prettier|roster)/i;

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

const immutableRegistry = 'scripts/gates/immutable-paths.json';
const immutablePaths = ['scripts/gates/no-weakening.mjs', 'scripts/selection/staged-tree.mjs'];

// The integration ledger and the supervisor's local gate-file-decisions.md each need one
// exact line: Owner authorizes gate file <path> from <old Git blob> to <new Git blob>.
function ownerApproved(root, source, parent, next, path) {
  if (!source) return false;
  try {
    const integration = git(source, ['rev-parse', '--verify', 'refs/remotes/origin/feat/enterprise-ui^{tree}']).trim();
    if (integration !== parent) return false;
    const oldBlob = git(root, ['rev-parse', parent + ':' + path]).trim();
    const newBlob = git(root, ['rev-parse', next + ':' + path]).trim();
    const prefix = 'Owner authorizes gate file ' + path + ' from ' + oldBlob + ' to ';
    const exact = text => {
      const records = text.split(/\r?\n/).map(line => line.trim().replace(/^- /, '')).filter(line => line.startsWith(prefix));
      return records.length === 1 && records[0] === prefix + newBlob;
    };
    const ledger = git(root, ['show', parent + ':docs/ui-lazy-dev-state.md']);
    const sections = ledger.split(/^## Owner decisions[ \t]*\r?$/m);
    if (sections.length !== 2 || !exact(sections[1].split(/^## /m)[0])) return false;
    const common = realpathSync(git(source, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
    const evidence = join(common, 'uld-delivery', 'gate-file-decisions.md');
    return realpathSync(evidence) === evidence && lstatSync(evidence).isFile() && exact(readFileSync(evidence, 'utf8'));
  } catch { return false; }
}

function protectedPaths(root, tree) {
  return git(root, ['show', tree + ':.github/CODEOWNERS']).split('\n')
    .filter(line => line.startsWith('/')).map(line => line.split(/\s/)[0].slice(1));
}

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value);

// Match duplicate records individually. Groups may shrink their nested entries.
function subset(next, previous) {
  if (Array.isArray(previous) && Array.isArray(next)) {
    const remaining = previous.slice();
    return next.every(row => {
      const index = remaining.findIndex(old => subset(row, old));
      if (index < 0) return false;
      remaining.splice(index, 1);
      return true;
    });
  }
  if (plain(previous) && plain(next))
    return Object.keys(next).every(key => Object.hasOwn(previous, key) && subset(next[key], previous[key]));
  if (typeof previous === 'number' && typeof next === 'number') return next <= previous;
  return isDeepStrictEqual(next, previous);
}

const checksWorkflow = '.github/workflows/checks.yml';

function trustedV4Pins(root, parent) {
  const file = '.github/workflows/release-gates.yml';
  const pins = new Set();
  if (!git(root, ['ls-tree', parent, '--', file])) return pins;
  const source = git(root, ['show', parent + ':' + file]);
  // Bind the comment to its actual YAML step. A matching line inside a run block is shell text.
  const tagged = source.replace(/^( *- uses: actions\/(?:checkout|setup-node|upload-artifact)@[a-f0-9]{40})[ \t]+#[ \t]*v4[ \t]*$/gm, '$1#v4');
  const originalJobs = yaml.safeLoad(source).jobs;
  const taggedJobs = yaml.safeLoad(tagged).jobs;
  for (const [name, job] of Object.entries(originalJobs)) {
    for (const [index, step] of (job.steps ?? []).entries()) {
      if (typeof step.uses === 'string' && taggedJobs[name].steps[index].uses === step.uses + '#v4')
        pins.add(step.uses);
    }
  }
  return pins;
}

function retainedWorkflowAction(old, next, pins) {
  if (isDeepStrictEqual(old, next)) return true;
  if (!pins.has(next?.uses) || old.uses !== next.uses.split('@')[0] + '@v4') return false;
  const expected = { ...old, uses: next.uses };
  if (old.uses === 'actions/checkout@v4') expected.with = { ...old.with, 'persist-credentials': false };
  return isDeepStrictEqual(expected, next);
}

// Package-size rows are the only baseline that may gain entries, and only for a family that enters
// the change. These rules and limits live here, in the trusted judge. The candidate provides data only.
const sizeBaseline = 'tests/packaging/bundle-baseline.json';
// Frozen goal section 9 size bands.
const bandLimits = Object.freeze({
  primitives: 1024, simple: 2560, inputs: 5120, overlays: 7168, heavy: 15360, datetime: 81920,
});
const publicLabel = /^(@[^/]+\/[^/#]+)(\/[^#]+)?(?:#([A-Za-z_$][\w$]*))?$/;

function treeJson(root, tree, path) {
  if (!git(root, ['ls-tree', tree, '--', path])) return undefined;
  return JSON.parse(git(root, ['show', tree + ':' + path]));
}

function packageNames(root, tree) {
  const names = new Map(), exports = new Map();
  for (const line of git(root, ['ls-tree', tree, 'packages/']).split('\n').filter(Boolean)) {
    const dir = line.split('\t')[1];
    const pkg = treeJson(root, tree, dir + '/package.json');
    if (!plain(pkg) || typeof pkg.name !== 'string') continue;
    names.set(dir.slice('packages/'.length), pkg.name);
    exports.set(pkg.name, plain(pkg.exports) ? Object.keys(pkg.exports) : typeof pkg.exports === 'string' ? ['.'] : []);
  }
  return { names, exports };
}

function familyManifests(root, tree) {
  const rows = new Map();
  for (const path of git(root, ['ls-tree', '--name-only', tree, 'manifests/families/']).split('\n').filter(Boolean))
    if (path.endsWith('.json')) rows.set(path, treeJson(root, tree, path));
  return rows;
}

const entryOf = label => {
  const match = publicLabel.exec(label);
  return match && { pkg: match[1], entry: match[2] ? '.' + match[2] : '.', symbol: match[3] };
};
const declaredEntries = (row, names) => (Array.isArray(row?.entries) ? row.entries : [])
  .map(item => plain(item) && names.get(item.pkg) && typeof item.path === 'string' ? names.get(item.pkg) + ' ' + item.path : undefined)
  .filter(Boolean);
const budgetRows = row => (Array.isArray(row?.budgets) ? row.budgets : []).filter(item => plain(item) && typeof item.name === 'string');

// All existing rows are retained. A new entry needs its own family, a band and packed evidence.
function baselineAdmission(root, parent, next, before, after, options) {
  if (!plain(before) || !plain(after)) return [sizeBaseline + ' requires a size map'];
  const added = Object.keys(after).filter(name => !Object.hasOwn(before, name));
  const issues = [];
  const problem = (name, message) => issues.push(sizeBaseline + ' ' + name + ' ' + message);
  for (const [name, old] of Object.entries(before)) {
    if (!Object.hasOwn(after, name)) problem(name, 'baseline removed an existing entry');
    else if (!Number.isSafeInteger(after[name]) || after[name] <= 0 || after[name] > old)
      problem(name, 'baseline gained or enlarged an existing entry');
  }
  if (!added.length) return issues;
  const candidatePackages = packageNames(root, next), parentPackages = packageNames(root, parent);
  const previous = familyManifests(root, parent), current = familyManifests(root, next);
  const shared = [treeJson(root, parent, 'manifests/shared.json'), treeJson(root, next, 'manifests/shared.json')];
  const parentEntries = new Set([...previous.values(), shared[0]].flatMap(row => declaredEntries(row, parentPackages.names)));
  const parentBudgets = new Set([...previous.values(), shared[0]].flatMap(row => budgetRows(row).map(item => item.name)));
  const sharedBudgets = new Set(budgetRows(shared[1]).map(item => item.name));
  const measured = options.measurements;
  for (const name of added) {
    const value = after[name], entry = entryOf(name);
    if (!Number.isInteger(value) || value <= 0 || !entry) { problem(name, 'new baseline row is not a positive public entry size'); continue; }
    const owners = [...current].filter(([, row]) => budgetRows(row).some(item => item.name === name));
    if (owners.length !== 1 || sharedBudgets.has(name) || parentBudgets.has(name)) {
      problem(name, 'new baseline row has no single new family budget');
      continue;
    }
    const [[path, row]] = owners;
    if (!row.id || previous.has(path) || [...previous.values()].some(existing => existing.id === row.id)) {
      problem(name, 'new baseline row requires a newly added family');
      continue;
    }
    const owned = entry.pkg + ' ' + entry.entry;
    if (!declaredEntries(row, candidatePackages.names).includes(owned) || parentEntries.has(owned) ||
        !(candidatePackages.exports.get(entry.pkg) ?? []).includes(entry.entry)) {
      problem(name, 'new baseline row is not a new public entry of ' + path);
      continue;
    }
    if (budgetRows(row).find(item => item.name === name).bytes !== value)
      problem(name, 'new baseline row differs from the family budget');
    if (!Object.hasOwn(bandLimits, row.band)) problem(name, 'new baseline row requires a known size band');
    else if (value > bandLimits[row.band]) problem(name, 'new baseline row exceeds its family band');
    if (measured) {
      const matching = measured.filter(item => item?.entry === name);
      if (matching.length !== 1 || matching[0].gzip !== value) problem(name, 'new baseline row differs from the packed measurement');
    } else if (options.deferMeasurement) options.pending?.push(name);
    else problem(name, 'new baseline row requires the trusted packed measurement');
  }
  return issues;
}

function checkData(file, before, after, issues, pins, admitted) {
  const problem = (path, message) => issues.push(file + ' ' + path + ' ' + message);
  // An admitted size map was compared row by row in baselineAdmission.
  const isBaseline = baseline.test(file) && !admitted;
  if (isBaseline && after !== undefined && !subset(after, before ?? (Array.isArray(after) ? [] : {})))
    problem('', 'baseline gained or enlarged an entry');
  function visit(old, next, path, limit, rules, exceptions) {
    if (!isBaseline && Array.isArray(old) && old.length && !Array.isArray(next))
      problem(path, 'registered entry removed or changed');
    if (next === undefined) {
      if ((limit && typeof old === 'number') || !isBaseline && (rules || limit || registry.test(file) && /cases|scenario|assertion|roster|evidence|nativeUnit|browser|visual|unit|project/i.test(path)))
        problem(path, 'registration or rule removed');
      return;
    }
    if (rules && !disabled(old) && disabled(next)) problem(path, 'rule disabled');
    if (limit && typeof old === 'number' && (typeof next !== 'number' || next > old))
      problem(path, 'numeric limit raised or removed');
    if (/\.(?:exceptions|exemptions)$/i.test(path)) {
      const entries = Array.isArray(next) ? next : plain(next) ? Object.values(next) : [next];
      for (const entry of entries) {
        if (!date(entry?.expires ?? entry?.expiry)) problem(path, 'exception lacks a valid expiry');
      }
    }
    if (Array.isArray(next)) {
      if (Array.isArray(old) && !isBaseline) {
        // Identified records may add cases or tighten limits without changing registration identity.
        const identity = item => plain(item) ? item.id ?? item.name ?? item.path ?? item.file : undefined;
        const candidates = next.slice();
        for (const entry of old) {
          const id = identity(entry);
          const index = candidates.findIndex(item => {
            if (file === checksWorkflow && /^\$\[[^\]]+\]\.jobs\.verify\.steps$/.test(path) && typeof entry?.uses === 'string')
              return retainedWorkflowAction(entry, item, pins);
            return id === undefined ? subset(entry, item) : identity(item) === id;
          });
          if (index < 0) { problem(path, 'registered entry removed or changed'); continue; }
          const [match] = candidates.splice(index, 1);
          visit(entry, match, path + '[' + (id ?? 'entry') + ']', limit, rules, exceptions);
        }
        for (const added of candidates) visit(undefined, added, path, limit, rules, exceptions);
      } else {
        next.forEach((item, index) => visit(old?.[index], item, path + '[' + index + ']', limit, rules, exceptions));
      }
      return;
    }
    if (!plain(next)) return;
    if ((exceptions && (next.reason !== undefined || next.fingerprint !== undefined || next.entries !== undefined)) &&
        !date(next.expires ?? next.expiry)) problem(path, 'exception lacks a valid expiry');
    for (const key of new Set([...Object.keys(plain(old) ? old : {}), ...Object.keys(next)]))
      visit(old?.[key], next[key], path + '.' + key, limit || budget.test(key),
        rules || key === 'rules', exceptions || /exceptions|exemptions/i.test(key));
  }
  visit(before, after, '$', budget.test(file), false, isBaseline);
}

// Structural tokens avoid treating formatting, quotes and comments as changed assertions.
function shape(node, omit) {
  if (ts.isParenthesizedExpression(node)) return shape(node.expression, omit);
  const children = [];
  ts.forEachChild(node, child => { if (!omit?.(child)) children.push(shape(child, omit)); });
  return children.length ? [node.kind, ...children] : [node.kind, node.text ?? ''];
}

// Only a standard cause on the thrown error can be added without changing its rejection.
function caughtCauseOptions(statement) {
  let error = statement.expression;
  while (ts.isParenthesizedExpression(error)) error = error.expression;
  if (ts.isCallExpression(error) && ts.isPropertyAccessExpression(error.expression) &&
      ts.isIdentifier(error.expression.expression) && error.expression.expression.text === 'Object' &&
      error.expression.name.text === 'assign' && error.arguments.length)
    error = error.arguments[0];
  while (ts.isParenthesizedExpression(error)) error = error.expression;
  if (!(ts.isNewExpression(error) || ts.isCallExpression(error)) || !ts.isIdentifier(error.expression) ||
      !/^(?:Aggregate|Eval|Range|Reference|Syntax|Type|URI)?Error$/.test(error.expression.text)) return;
  const args = error.arguments;
  if (args?.length !== (error.expression.text === 'AggregateError' ? 3 : 2)) return;
  const options = args.at(-1);
  if (!ts.isObjectLiteralExpression(options) || options.properties.length !== 1) return;
  const property = options.properties[0];
  const value = ts.isShorthandPropertyAssignment(property) ? property.name :
    ts.isPropertyAssignment(property) ? property.initializer : undefined;
  if (!value || !ts.isIdentifier(value) || property.name.text !== 'cause') return;
  const scope = ts.findAncestor(statement, node => ts.isCatchClause(node) || ts.isFunctionLike(node));
  const binding = scope && ts.isCatchClause(scope) && scope.variableDeclaration?.name;
  if (binding && ts.isIdentifier(binding) && value.text === binding.text) return options;
}

function hasEarlyExit(statement) {
  function leaves(node) {
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return false;
    if (ts.isReturnStatement(node)) return true;
    if (ts.isBreakStatement(node) || ts.isContinueStatement(node)) {
      // A transfer inside a completed inner loop cannot skip the next outer statement.
      for (let target = node.parent; target && !ts.isFunctionLike(target); target = target.parent) {
        const matches = node.label
          ? ts.isLabeledStatement(target) && target.label.text === node.label.text
          : ts.isIterationStatement(target, false) || (ts.isBreakStatement(node) && ts.isSwitchStatement(target));
        if (matches) return target.pos < statement.pos || target.end > statement.end;
      }
      return true;
    }
    return ts.forEachChild(node, leaves);
  }
  return leaves(statement);
}
const signature = (node, omit) => createHash('sha256').update(JSON.stringify(shape(node, omit))).digest('hex');

function facts(path, body) {
  const file = ts.createSourceFile(path, body, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw Error('Cannot parse protected source ' + path);
  const obligations = [], forbidden = [], limits = new Map();
  const causeOptions = new WeakSet();
  if (body && path === fixtureRegistry)
    registeredNativeSlugs(body, (_slug, _descriptor, id) => obligations.push('native fixture ' + id));
  const testFile = /\.(?:test|spec)\.|\/test\//.test(path);
  function visit(node, owner, numericContext, inRules = false) {
    let context = owner;
    if (ts.isFunctionDeclaration(node) && node.name) context += '/' + node.name.text;
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(file);
      if (path.startsWith('scripts/gates/') && call === 'step' && node.arguments[0]) {
        const suite = context + ' ' + JSON.stringify(shape(node.arguments[0]));
        obligations.push('registered suite ' + suite);
        const handler = node.arguments[1];
        if (handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
            ts.isBlock(handler.body) && !handler.body.statements.length) forbidden.push('disabled suite ' + suite);
      }
      if (/^(?:[xf](?:it|test|describe)|(?:it|test|describe|suite)(?:\.(?:describe|suite|serial|parallel|concurrent|each))*\.(?:only|skip|todo|fixme|fails|skipIf|runIf))(?:\b|$)/.test(call))
        forbidden.push(context + ':' + JSON.stringify(shape(node.expression)));
      if (/^(?:it|test|describe|suite)(?:\.(?:each|concurrent|serial|parallel)\b.*)?$/.test(call) && node.arguments[0]) {
        context += '/' + JSON.stringify(shape(node.arguments[0]));
        obligations.push('case ' + context);
        for (const arg of node.arguments) if (ts.isObjectLiteralExpression(arg))
          for (const prop of arg.properties) if (ts.isPropertyAssignment(prop) && ['skip', 'only', 'todo'].includes(prop.name.text) &&
            prop.initializer.kind !== ts.SyntaxKind.FalseKeyword) forbidden.push(context + ' ' + prop.name.text);
      } else if (/^(?:assert(?:\.|$)|expect(?:\.|\())/.test(call) && !/^expect(?:\.(?:soft|poll))?$/.test(call)) {
        const upper = /\.toBeLessThan(?:OrEqual)?$/.test(call) && node.arguments.length === 1 &&
          ts.isNumericLiteral(node.arguments[0]);
        if (upper) {
          const key = 'assert ' + context + ' ' + JSON.stringify(shape(node.expression));
          const bounds = limits.get(key) ?? [];
          bounds.push(Number(node.arguments[0].text));
          limits.set(key, bounds);
          obligations.push(key);
        } else obligations.push('assert ' + context + ' ' + JSON.stringify(shape(node)));
      } else if (!testFile && /^(?:report|addIssue|violation|fail|issues\.push|problem)$/.test(call)) {
        obligations.push('rule ' + context + ' ' + JSON.stringify(shape(node)));
      }
    }
    if (measuredStories.has(path) && ts.isJsxAttribute(node) && node.name.getText(file) === 'animate')
      obligations.push('measured animation ' + context + ' ' + JSON.stringify(shape(node)));
    if (ts.isThrowStatement(node) && !testFile) {
      const options = caughtCauseOptions(node);
      if (options) causeOptions.add(options);
      const id = context + ' ' + JSON.stringify(shape(node, child => child === options));
      obligations.push('reject ' + id);
      if (options) obligations.push('reject cause ' + JSON.stringify(shape(options)) + ' ' + id);
    }
    if (ts.isPropertyAssignment(node) || ts.isVariableDeclaration(node)) {
      const name = node.name.getText(file);
      if (inRules && node.initializer) {
        const setting = ts.isArrayLiteralExpression(node.initializer) ? node.initializer.elements[0] : node.initializer;
        if (setting && !['off', '0', 'false'].includes(setting.text ?? setting.getText(file)))
          obligations.push('enabled rule ' + context + '/' + name);
      }
      inRules ||= node.name.text === 'rules';
      if (numericContext || budget.test(name)) numericContext += '/' + name;
      if (numericContext && node.initializer && ts.isNumericLiteral(node.initializer)) {
        const key = context + numericContext;
        const values = limits.get(key) ?? [];
        values.push(Number(node.initializer.text));
        limits.set(key, values);
      }
    }
    const descend = (child, scope = context) => visit(child, scope, numericContext, inRules);
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      let scope = context;
      for (const statement of node.statements) {
        descend(statement, scope);
        if (hasEarlyExit(statement)) scope += '/after ' + signature(statement, child => causeOptions.has(child));
      }
    } else if (ts.isIfStatement(node) || ts.isConditionalExpression(node)) {
      const condition = ts.isIfStatement(node) ? node.expression : node.condition;
      descend(condition);
      const guard = signature(condition);
      descend(ts.isIfStatement(node) ? node.thenStatement : node.whenTrue, context + '/if ' + guard);
      const otherwise = ts.isIfStatement(node) ? node.elseStatement : node.whenFalse;
      if (otherwise) descend(otherwise, context + '/else ' + guard);
    } else if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
      descend(node.left);
      descend(node.right, context + '/when ' + node.operatorToken.getText(file) + ' ' + signature(node.left));
    } else ts.forEachChild(node, child => descend(child));
  }
  visit(file, '', budget.test(path) ? path : '');
  return { obligations, forbidden, limits };
}

// The Android and iPhone harnesses contain Java and Kotlin checks outside the
// TypeScript syntax tree. Compare their assertion tokens independent of layout.
function jvmFacts(body) {
  const scan = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, body);
  const tokens = [];
  for (let kind = scan.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scan.scan()) {
    if (kind === ts.SyntaxKind.GreaterThanToken) scan.reScanGreaterToken();
    tokens.push(scan.getTokenText());
  }
  const obligations = [], limits = new Map();
  for (let start = 0; start < tokens.length; start++) {
    const name = tokens[start];
    if (name === 'throw') obligations.push('throw ' + tokens[start + (tokens[start + 1] === 'new' ? 2 : 1)]);
    if (!/^(?:assert(?:[A-Z]\w*)?|check(?:NotNull)?|require(?:NotNull)?|if)$/.test(name)) continue;
    let end = start + 1;
    if (tokens[end] === '(') {
      let depth = 1;
      while (depth && ++end < tokens.length) {
        if (tokens[end] === '(') depth++;
        if (tokens[end] === ')') depth--;
      }
    } else if (name === 'assert') {
      while (end < tokens.length && tokens[end] !== ';') end++;
    } else continue;
    if (name === 'if' && tokens[end + (tokens[end + 1] === '{' ? 2 : 1)] !== 'throw') continue;
    const expression = tokens.slice(start, end + 1);
    // A throwing guard rejects its condition. An assertion requires it.
    // Compare a simple named operand and literal numerically. Preserve the
    // exact tokens for compound or negated conditions with unknown direction.
    const comparison = expression.findIndex(token => ['<', '<=', '>', '>='].includes(token));
    const first = expression[1] === '(' ? 2 : 1;
    const operand = expression.slice(first, comparison).join(' ');
    let bound;
    if (comparison === expression.length - 3 && /^[\w$]+(?: \. [\w$]+)*$/.test(operand) &&
        /^\d+(?:\.\d+)?$/.test(expression[comparison + 1])) {
      const upperLimit = expression[comparison].startsWith('<') !== (name === 'if');
      bound = Number(expression[comparison + 1]) * (upperLimit ? 1 : -1);
      expression[comparison + 1] = '#bound';
    }
    const identity = JSON.stringify(expression);
    obligations.push('assertion ' + identity);
    if (bound !== undefined) limits.set(identity, [...(limits.get(identity) ?? []), bound]);
  }
  return { obligations, limits, forbidden: [] };
}

function removed(before, after) {
  const counts = new Map();
  for (const entry of after) counts.set(entry, (counts.get(entry) ?? 0) + 1);
  return before.filter(entry => {
    const count = counts.get(entry) ?? 0;
    if (!count) return true;
    counts.set(entry, count - 1);
    return false;
  });
}

const inventoryBaseline = 'tests/acceptance/inventory-baseline.json';
function initialInventory(source, parent, next, data) {
  const branch = 'gates/inventory-batch-1';
  if (!source || git(source, ['branch', '--show-current']).trim() !== branch) return false;
  if (git(source, ['rev-parse', 'refs/remotes/origin/feat/enterprise-ui^{tree}']).trim() !== parent) return false;
  const tip = git(source, ['rev-parse', 'HEAD']).trim();
  const localTree = git(source, ['write-tree']).trim();
  const merge = git(source, ['merge-tree', '--write-tree', 'refs/remotes/origin/feat/enterprise-ui', tip]).trim();
  if (next !== localTree && next !== merge) return false;
  if (!plain(data) || data.schema !== 1 || Object.keys(data).sort().join(',') !== 'entries,schema' || !Array.isArray(data.entries)) return false;
  return data.entries.every(entry => Array.isArray(entry) && entry.length === 4 &&
    ['format', 'lint', 'package', 'a11y', 'messages', 'policy'].includes(entry[0]) &&
    typeof entry[1] === 'string' && entry[1].length > 0 && typeof entry[2] === 'string' &&
    !entry[2].startsWith('/') && !entry[2].split('/').includes('..') && /^[0-9a-f]{64}$/.test(entry[3]));
}
// options.measurements: the packed bundle measurement rows ({ entry, gzip }) of the candidate.
// options.deferMeasurement: collect unmeasured new size rows in options.pending for a later measured run.
export function noWeakening(root, base, candidate, source, options = {}) {
  const tree = revision => git(root, ['rev-parse', '--verify', '--end-of-options', revision + '^{tree}']).trim();
  const parent = tree(base), next = tree(candidate);
  const incumbentOwners = protectedPaths(root, parent), proposedOwners = protectedPaths(root, next);
  const owners = [...incumbentOwners, ...proposedOwners, ...measuredStories];
  const issues = [];
  const adopted = Boolean(git(root, ['ls-tree', parent, '--', immutableRegistry]));
  for (const old of incumbentOwners) {
    if (!proposedOwners.includes(old)) issues.push('.github/CODEOWNERS removed protected path ' + old);
  }
  for (const { status, path } of stagedDiff(root, { parent, tree: next }).changes) {
    if (!special.test(path) && !owners.some(entry => entry.endsWith('/') ? path.startsWith(entry) : path === entry) &&
        path !== 'docs/ui-lazy-dev-goal.md') continue;
    if (!['M', 'A'].includes(status) || path === 'docs/ui-lazy-dev-goal.md') {
      issues.push(path + ' protected file removed, replaced or frozen');
      continue;
    }
    if (path === immutableRegistry && (adopted ||
        !isDeepStrictEqual(JSON.parse(git(root, ['show', next + ':' + path])), immutablePaths)))
      issues.push(path + ' immutable gate registry must retain the reviewed paths');
    if (adopted && immutablePaths.includes(path) && !ownerApproved(root, source, parent, next, path))
      issues.push(path + ' frozen gate change requires the exact trusted owner decision');
    if (path === 'tests/android/profiles.json' && !ownerApproved(root, source, parent, next, path)) {
      issues.push(path + ' frozen hardware profiles require a recorded owner decision');
    }
    const read = ref => git(root, ['show', ref + ':' + path]);
    const mode = ref => git(root, ['ls-tree', ref, '--', path]).split(' ')[0];
    if (!/^100(?:644|755)$/.test(mode(next)) || status === 'M' && mode(next) !== mode(parent)) {
      issues.push(path + ' protected file mode changed');
      continue;
    }
    if (/\.(?:png|tgz|jar|zip)$/.test(path)) {
      if (status === 'M') issues.push(path + ' protected binary baseline replaced');
      continue;
    }
    const before = status === 'A' ? undefined : read(parent), after = read(next);
    if (path.startsWith('.githooks/') || /\.sh$/.test(path)) {
      const commands = text => (text ?? '').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      if (removed(commands(before), commands(after)).length) issues.push(path + ' removed a protected shell command');
    }
    const suppressions = source => (source ?? '').split('\n')
      .filter(line => /(?:^|\s)(?:\/\/|\/\*|#|<!--)\s*(?:eslint-disable|@ts-(?:ignore|nocheck)|istanbul ignore|c8 ignore|coverage ignore|prettier-ignore)\b/.test(line))
      .map(line => line.trim());
    if (removed(suppressions(after), suppressions(before)).length) issues.push(path + ' adds a rule suppression');
    if (/\.(?:json|ya?ml)$/.test(path) && path !== 'package-lock.json') {
      const parse = text => path.endsWith('.json') ? JSON.parse(text) : yaml.safeLoadAll(text);
      const data = parse(after);
      if (path === inventoryBaseline && before === undefined && initialInventory(source, parent, next, data)) continue;
      const pins = path === checksWorkflow ? trustedV4Pins(root, parent) : undefined;
      const admission = path === sizeBaseline && before !== undefined
        ? baselineAdmission(root, parent, next, parse(before), data, options) : undefined;
      if (admission) issues.push(...admission);
      checkData(path, before === undefined ? undefined : parse(before), data, issues, pins, Boolean(admission));
    } else if (sourceCode.test(path) || /\.(?:java|kt|kts)$/.test(path)) {
      const inspect = body => sourceCode.test(path) ? facts(path, body) : jvmFacts(body);
      const old = inspect(before ?? ''), current = inspect(after);
      if (before !== undefined && current.obligations.length < old.obligations.length && /(?:rules?|gates?)\//.test(path))
        issues.push(path + ' reduced executable checks');
      for (const fact of removed(old.obligations, current.obligations))
        issues.push(path + ' removed ' + fact.slice(0, 145));
      for (const fact of removed(current.forbidden, old.forbidden)) issues.push(path + ' focused or skipped test ' + fact);
      for (const [key, values] of old.limits) {
        const now = current.limits.get(key);
        if (!now || now.length < values.length || values.some((value, i) => now[i] > value))
          issues.push(path + ' numeric limit raised or removed ' + key);
      }
    }
  }
  return issues;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), options = { pending: [] };
  const flag = args.indexOf('--measurements');
  if (flag >= 0) options.measurements = JSON.parse(readFileSync(args.splice(flag, 2)[1], 'utf8'));
  const defer = args.indexOf('--defer-measurement');
  if (defer >= 0) { args.splice(defer, 1); options.deferMeasurement = true; }
  if (args.length > 3 || (options.measurements && options.deferMeasurement))
    throw Error('Pass either --measurements <bundles.json> or --defer-measurement once');
  const [base, tree, source] = args;
  if (!base || !tree) throw Error('Usage: no-weakening.mjs <base> <candidate tree>');
  const issues = noWeakening(process.cwd(), base, tree, source, options);
  for (const issue of issues) console.error(issue);
  if (issues.length) process.exitCode = 1;
  else {
    console.log('Protected inputs passed.');
    if (options.pending.length) console.log('New size rows await the packed measurement: ' + options.pending.join(', '));
  }
}
