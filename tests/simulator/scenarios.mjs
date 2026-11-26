import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectNativeScenarios } from '../../scripts/selection/native-scenarios.mjs';
import nativeReader from '../../scripts/scenarios/native.cjs';
import nativeRoles from '../../scripts/scenarios/native-roles.cjs';
import { readCandidateScenarios } from '../../scripts/scenarios/fixture-metadata.mjs';
import { target as androidTarget } from '../android/tree.mjs';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function resourceId(raw, platform) {
  return '^' + (platform === 'android' ? '(?:[^:]+:id/)?' : '') + escapeRegex(raw) + '$';
}

function selector({ role, name }, platform, busy = false) {
  assert.ok(['button', 'checkbox', 'text', 'alert'].includes(role), 'Unsupported native role ' + role);
  // On the English Android fixture React Native joins accessibilityLabel and its busy state.
  const description = busy && platform === 'android' ? name + ', busy' : name;
  const stateSuffix = role === 'checkbox' && platform === 'android' ? '(?:, mixed)?' : '';
  return { text: '^' + escapeRegex(description) + stateSuffix + '$', id: resourceId('scenario.' + role + '.' + name, platform),
    ...(busy ? { enabled: false } : {}) };
}

// Roles beyond the original four. Unsupported roles throw here, before any interaction.
// Android joins a value's text to the label of value-bearing roles, as for busy and mixed states.
export function roleSelector(target, platform, busy = false) {
  const spec = nativeRoles.nativeRole(target.role);
  if (spec.incumbent) return selector(target, platform, busy);
  assert.ok(!busy, 'Only a button can be busy');
  const valueSuffix = platform === 'android' && spec.android.value === true ? '(?:, .+)?' : '';
  return { text: '^' + escapeRegex(target.name) + valueSuffix + '$',
    id: resourceId('scenario.' + target.role + '.' + target.name, platform) };
}

export function verifyAndroidBusyButton(nodes, name) {
  const button = androidTarget(nodes, 'scenario.button.' + name, { role: 'Button', name: name + ', busy', enabled: false });
  assert.equal(button.focusable, 'true', 'A busy Android button remains focusable');
}

// Fabric exposes the checkbox's localized role and state in its iOS accessibility value.
// On Android the native CheckBox class exposes boolean states. RN appends mixed to the label.
export function verifyNativeCheckbox(source, platform, name, { enabled, state } = {}) {
  const id = 'scenario.checkbox.' + name;
  let actual;
  if (platform === 'android') {
    const node = androidTarget(source, id, { role: 'CheckBox', enabled });
    const mixed = node['content-desc'] === name + ', mixed';
    assert.ok(mixed || [node['content-desc'], node.text].includes(name), id + ' accessible name');
    if (mixed) actual = 'mixed';
    else {
      assert.equal(node.checkable, 'true', id + ' checkable');
      assert.ok(['true', 'false'].includes(node.checked), id + ' checked state');
      actual = node.checked === 'true' ? 'checked' : 'unchecked';
    }
  } else {
    assert.equal(platform, 'ios');
    const matches = [];
    function walk(node) {
      if (node.attributes?.['resource-id'] === id) matches.push(node.attributes);
      for (const child of node.children ?? []) walk(child);
    }
    walk(source);
    assert.equal(matches.length, 1, 'Expected one accessible fixture element ' + id);
    const [node] = matches;
    assert.equal(node.accessibilityText, name, id + ' accessible name');
    const match = /^checkbox, (checked|unchecked|mixed)$/.exec(node.value ?? '');
    assert.ok(match, id + ' native checkbox role and state');
    if (enabled !== undefined) assert.equal(String(node.enabled), String(enabled), id + ' enabled state');
    actual = match[1];
  }
  if (state !== undefined) assert.equal(actual, state, id + ' checked state');
  return actual;
}

// Maestro 2.4 prefixes an unfiltered iOS tree with its inspector name, "None:".
export function parseHierarchy(output) {
  return JSON.parse(output.replace(/^\s*None:\s*/, ''));
}

export function inAccessibilityOrder(tree, targets, platform = 'ios') {
  const nodes = [];
  function walk(node) {
    if (node.attributes) nodes.push(node.attributes);
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return targets.map(({ role, name }) => {
    const id = 'scenario.' + role + '.' + name;
    const identifier = new RegExp(resourceId(id, platform));
    const matches = nodes.filter(item => identifier.test(item['resource-id']));
    assert.equal(matches.length, 1, 'Expected one accessible fixture element ' + id);
    const [node] = matches;
    const label = platform === 'android' && nativeRoles.nativeRole(role).android?.value
      ? new RegExp(roleSelector({ role, name }, platform).text) : null;
    assert.ok([node.accessibilityText, node['content-desc'], node.text].includes(name) ||
      typeof node['content-desc'] === 'string' && label?.test(node['content-desc']),
      'Expected one accessible fixture element ' + id + ' named ' + name);
    return nodes.indexOf(node);
  });
}

export function runNativeScenarios({ root, appId, maestro, device, env, run, reports, registry, reset, platform = 'ios', readAndroidTree, readIOSElements, log = console.log }) {
  const scenarios = selectNativeScenarios(root, registry ? nativeReader.deviceScenarios(root, registry) : readCandidateScenarios(root));
  const directory = mkdtempSync(join(tmpdir(), 'ui-' + platform + '-scenarios-'));
  const call = (args) => run(root, maestro, ['--device', device, ...args], { env });
  function flow(id, commands) {
    const path = join(directory, id + '.yaml');
    // Two YAML documents. JSON flow style keeps localized names and backslashes intact.
    writeFileSync(path, JSON.stringify({ appId, name: id }) + '\n---\n' + JSON.stringify(commands) + '\n');
    call(['test', '--test-output-dir', join(reports, id), '--debug-output', join(reports, id), path]);
  }
  try {
    for (const scenario of scenarios) {
      const { id, fixtureId } = scenario;
      reset?.(id);
      const evidence = [];
      const fixture = { id: resourceId('fixture.' + fixtureId, platform) };
      let commands = [
        'launchApp', { tapOn: { id: resourceId('open-scenarios', platform) } },
        { runFlow: { when: { notVisible: fixture }, commands: [
          { scrollUntilVisible: { element: fixture, direction: 'DOWN' } },
        ] } }, { assertVisible: fixture }, { tapOn: fixture },
      ];
      // One Maestro session per uninterrupted sequence. Read the live tree exactly at "before".
      for (const [index, step] of scenario.steps.entries()) {
        const label = id + ' step ' + (index + 1);
        try {
          const targets = [step.target, ...(step.other ? [step.other] : [])];
          for (const target of targets) {
            const query = roleSelector(target, platform, step.expect === 'busy');
            commands.push({ assertVisible: { ...query, label } },
              { assertNotVisible: { ...query, index: '1', label: label + ' (unique target)' } });
          }
          const roleTargets = targets.filter(target => !nativeRoles.nativeRole(target.role).incumbent);
          if (roleTargets.length) {
            flow(id, commands);
            commands = [];
            const tree = platform === 'android' ? readAndroidTree?.() : readIOSElements?.();
            assert.ok(tree, 'Native ' + platform + ' role evidence requires the live accessibility tree');
            for (const target of roleTargets) evidence.push(nativeRoles.verifyNativeRole(tree, platform, target));
          }
          const checkboxes = targets.filter(target => target.role === 'checkbox');
          if (checkboxes.length) {
            flow(id, commands);
            commands = [];
            const tree = platform === 'android' ? readAndroidTree() : parseHierarchy(call(['hierarchy', '--no-ansi', '--no-reinstall-driver']));
            for (const target of checkboxes) verifyNativeCheckbox(tree, platform, target.name, {
              enabled: step.act === 'activate' ? true : undefined,
              state: ['checked', 'unchecked', 'mixed'].includes(step.expect) ? step.expect : undefined,
            });
          }
          if (step.act === 'activate') commands.push({ tapOn: { ...roleSelector(step.target, platform), enabled: true, label } });
          if (step.expect === 'busy' && platform === 'android') {
            flow(id, commands);
            commands = [];
            verifyAndroidBusyButton(readAndroidTree(), step.target.name);
          }
          if (step.expect === 'before') {
            if (commands.length) flow(id, commands);
            commands = [];
            const tree = parseHierarchy(call(['hierarchy', '--no-ansi', '--no-reinstall-driver']));
            const [first, second] = inAccessibilityOrder(tree, targets, platform);
            assert.ok(first < second, 'Unexpected ' + platform + ' accessibility traversal order');
          }
        } catch (error) {
          throw new Error(label + ': ' + error.message, { cause: error });
        }
      }
      if (commands.length) flow(id, commands);
      log(platform + ' scenario passed:', id);
      // Name the evidence level of each role beyond the original four.
      for (const row of evidence) log(platform + ' role evidence:', id, row.role, row.evidence);
    }
    return scenarios.map(({ id }) => id);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
