import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const contract = [
  'Purpose and when not to use it',
  'Anatomy',
  'Variants',
  'States matrix',
  'Keyboard, pointer and touch',
  'Accessibility',
  'State patterns',
  'Localization',
  'Tokens',
  'Composition and content guidelines',
];
const binding = [
  'Rendering',
  'Headless API',
  'Test helpers',
  'Platform differences',
  'Performance',
  'Tests',
  'Changelog and deprecations',
];
const structure = [
  '## Part A — Contract',
  ...contract.map((name) => '### ' + name),
  '## Part B — Bindings',
  '### API',
  ...['React web', 'React Native'].flatMap((platform) => [
    '### ' + platform,
    ...binding.map((name) => '#### ' + name),
  ]),
];
const slotColumns = [
  'Slot',
  'Requirement',
  'Omission',
  'Spacing owner',
  'Accessible name',
  'Focus order',
];
const stateColumns = [
  'State',
  'Trigger',
  'Visual tokens',
  'Semantics',
  'Activatable',
  'Focusable',
  'Scenario',
];
const implementationTerm =
  /\b(?:react(?:dom|node|element)?|jsx|tsx|dom|ios|android|flutter|javascript|typescript|html(?:element)?|aria-[\w-]+|data-[\w-]+|className|tabIndex|href|onClick|onPress|forwardRef|useState|useEffect|accessibilityRole|testID)\b|<\/?[a-z][\w-]*(?:\s[^>\n]*)?\s*\/?>/i;

function checkSlots(body, table, report) {
  const slots = table(body, slotColumns, report);
  if (!slots.length) report('slots', 'List each slot, or explain that the family has none.');
  const seen = new Set();
  for (const [slot, requirement, omission, spacing] of slots) {
    const name = slot.toLowerCase();
    if (seen.has(name)) report('slots', 'Duplicate slot ' + slot);
    seen.add(name);
    if (name === 'none') {
      if (slots.length !== 1 || [requirement, omission, spacing].some((cell) => cell !== 'N/A'))
        report('slots', 'Use one None row with N/A for requirement, omission and spacing.');
      continue;
    }
    if (spacing.toLowerCase() !== 'container gap')
      report('slot-spacing', 'The container gap owns spacing for ' + slot);
    if (requirement === 'Required' && /^N\/A\s*[—–:-]\s*\S/.test(omission)) continue;
    if (
      requirement === 'Optional' &&
      /^(?:collapse|(?:fallback|placeholder)\s*[—–:-]\s*\S.+)$/i.test(omission)
    )
      continue;
    report('slot-omission', 'Identify the requirement and omission behavior for ' + slot);
  }
}

function checkScenarios(body, file, status, table, report) {
  const states = table(body, stateColumns, report);
  if (!states.length)
    report('state-scenario', 'Describe the default or applicable states and their scenarios.');
  const slug = basename(file, '.md');
  const filename = slug + '.scenarios.yaml';
  const verifiedLinks = new Set();
  let ids;
  for (const [state, , , , , , link] of states) {
    if (status === 'draft' && /^Pending:\s*\S.+/i.test(link)) continue;
    const match = /^\[([\w.-]+)\]\(([^)]+)\)$/.exec(link);
    if (!match || match[2] !== filename || !match[1].startsWith(slug + '.')) {
      report('state-scenario', state + ' needs a scenario ID linked to ' + filename);
      continue;
    }
    if (!ids) {
      try {
        const doc = JSON.parse(readFileSync(join(dirname(file), filename), 'utf8'));
        ids = new Set(doc.scenarios.map((scenario) => scenario.id));
        if (
          ids.size !== doc.scenarios.length ||
          typeof doc.family !== 'string' ||
          doc.family
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') !== slug
        )
          throw Error('Family name or scenario IDs differ');
      } catch (error) {
        report('state-scenario', filename + ': ' + error.message);
        ids = new Set();
      }
    }
    if (!ids.has(match[1])) report('state-scenario', 'Unknown scenario ID ' + match[1]);
    else verifiedLinks.add(link);
  }
  return verifiedLinks;
}

export function readContract(text, file, status, table, report) {
  const visible = text.replace(/<!--[\s\S]*?-->/g, '');
  // Markdown headings inside fenced examples do not create document sections.
  // Keep their offsets so the language check still sees the rendered code.
  const clean = visible.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, (block) =>
    block.replace(/[^\n]/g, ' '),
  );
  const marks = [...clean.matchAll(/^(#{2,4})[ \t]+([^\n]+)$/gm)];
  if (marks.length !== structure.length || marks.some((m, i) => m[0].trimEnd() !== structure[i]))
    report('sections', 'Use the complete contract and both binding sections in template order.');
  const sections = new Map();
  let part, platform;
  for (const [index, match] of marks.entries()) {
    const [, level, rawName] = match;
    const name = rawName.trim();
    if (level.length === 2) {
      part = name;
      platform = undefined;
      continue;
    }
    if (part === 'Part B — Bindings' && level.length === 3 && name !== 'API') {
      platform = name;
      continue;
    }
    const body = clean.slice(match.index + match[0].length, marks[index + 1]?.index).trim();
    const key = platform ? platform + '/' + name : name;
    if (!body || (/^N\/A\b/i.test(body) && !/^N\/A[ \t]*(?:[—–:.-]|because)[ \t]*\S/i.test(body)))
      report('section-empty', 'Write the contract or explain N/A in ' + key);
    if (name !== 'API') {
      for (const marker of body.matchAll(/\bPending[ \t]*:[ \t]*([^|\n]*)/gi)) {
        if (status !== 'draft' || !/[\p{L}\p{N}]/u.test(marker[1]))
          report('pending', 'Only drafts can carry an open item with a specific reason in ' + key);
      }
    }
    if (part === 'Part A — Contract') {
      let prose = visible.slice(match.index + match[0].length, marks[index + 1]?.index);
      if (name === 'States matrix') {
        const verified = checkScenarios(body, file, status, table, report);
        // Only the final cell of a state row describes its executable scenario.
        // Keep the link text in every other position visible to the language check.
        prose = prose.replace(/^([ \t]*\|[^\n]*\|)[ \t]*(\[[\w.-]+\]\([^)\n]+\))[ \t]*\|?[ \t]*$/gm,
          (line, row, link) => verified.has(link) ? row : line);
      }
      const leak = implementationTerm.exec(prose.replace(/\]\([^)]+\)/g, ']'));
      if (leak)
        report('contract-language', 'Move ' + leak[0] + ' to the platform binding in ' + name);
    }
    sections.set(key, body);
  }
  if (sections.has('Anatomy')) checkSlots(sections.get('Anatomy'), table, report);
  return sections;
}
