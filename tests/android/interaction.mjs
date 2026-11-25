import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { accessibilityNodes, bounds, target } from './tree.mjs';
import { appId } from './host.mjs';

export function androidTree(device) {
  const path = '/data/local/tmp/uld-accessibility.xml';
  device('shell', 'uiautomator', 'dump', path);
  const xml = device('shell', 'cat', path);
  return { xml, nodes: accessibilityNodes(xml) };
}

export function keyboardVisible(inputMethodDump) {
  const states = [...inputMethodDump.matchAll(/\b(?:mInputShown|isInputViewShown\(\))=(true|false)\b/g)];
  assert.ok(states.length, 'Missing Android input method visibility');
  return states.some(([, value]) => value === 'true');
}

function screenshot(tools, serial) {
  const data = execFileSync(tools.adb, ['-s', serial, 'exec-out', 'screencap'], {
    env: tools.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  const width = data.readUInt32LE(0),
    height = data.readUInt32LE(4),
    format = data.readUInt32LE(8);
  assert.ok(format === 1 || format === 2, 'Expected Android RGBA/RGBX screenshot');
  const offset = data.length - width * height * 4;
  assert.ok(offset === 12 || offset === 16, 'Unsupported Android raw screenshot header');
  return { data, width, height, offset };
}

export function changedPixels(a, b, rect) {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let changed = 0;
  for (let y = rect.y + 2; y < rect.bottom - 2; y++) {
    for (let x = rect.x + 2; x < rect.right - 2; x++) {
      const k = (y * a.width + x) * 4;
      for (let c = 0; c < 3; c++)
        if (Math.abs(a.data[a.offset + k + c] - b.data[b.offset + k + c]) > 4) {
          changed++;
          break;
        }
    }
  }
  return changed;
}

function dominantColorChange(before, held, rect) {
  const changes = new Map();
  for (let y = rect.y + 2; y < rect.bottom - 2; y += 2) {
    for (let x = rect.x + 2; x < rect.right - 2; x += 2) {
      const offset = (y * before.width + x) * 4;
      const a = before.data.subarray(before.offset + offset, before.offset + offset + 3);
      const b = held.data.subarray(held.offset + offset, held.offset + offset + 3);
      if (!a.some((channel, index) => Math.abs(channel - b[index]) > 4)) continue;
      const pair = '#' + a.toString('hex') + ' → #' + b.toString('hex');
      changes.set(pair, (changes.get(pair) ?? 0) + 1);
    }
  }
  return [...changes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export async function verifyRipple({ device, serial, tools, reports, nodes, review }) {
  const help = target(nodes, 'workspace-help', {
    role: 'Button',
    name: 'Workspace name help',
    enabled: true,
  });
  const helpBounds = bounds(help),
    untouched = bounds(review);
  const before = screenshot(tools, serial);
  device(
    'shell',
    'input',
    'motionevent',
    'DOWN',
    String(helpBounds.centerX),
    String(helpBounds.centerY),
  );
  let held;
  try {
    await delay(180);
    held = screenshot(tools, serial);
  } finally {
    device(
      'shell',
      'input',
      'motionevent',
      'UP',
      String(helpBounds.centerX),
      String(helpBounds.centerY),
    );
  }
  await delay(600);
  const after = screenshot(tools, serial);
  const ripple = {
    heldPixels: changedPixels(before, held, helpBounds),
    dominantTargetChange: dominantColorChange(before, held, helpBounds),
    releasedPixels: changedPixels(before, after, helpBounds),
    controlPixels: changedPixels(before, held, untouched),
  };
  writeFileSync(join(reports, 'ripple.json'), JSON.stringify(ripple, null, 2) + '\n');
  assert.ok(
    ripple.heldPixels >= 20 &&
      ripple.releasedPixels < ripple.heldPixels / 5 &&
      ripple.controlPixels < 10,
    'Expected a visible Android held ripple confined to the public IconButton: ' +
      JSON.stringify(ripple),
  );

  return ripple;
}

export async function verifyAndroidInteraction({ device, serial, tools, reports, profile }) {
  const start = () =>
    device('shell', 'am', 'start', '-S', '-W', '-n', appId + '/com.helloworld.MainActivity');
  const tree = (label) => {
    const { xml, nodes } = androidTree(device);
    if (label) writeFileSync(join(reports, label + '.xml'), xml);
    return nodes;
  };
  const tap = (node) => {
    const { centerX, centerY } = bounds(node);
    device('shell', 'input', 'tap', String(centerX), String(centerY));
  };
  // Switching navigation modes relaunches some AOSP activities. Set the device profile before entering the draft.
  const gestural = /\[x\]\s+com\.android\.internal\.systemui\.navbar\.gestural\s*$/m;
  if (!gestural.test(device('shell', 'cmd', 'overlay', 'list'))) {
    device(
      'shell',
      'cmd',
      'overlay',
      'enable-exclusive',
      '--category',
      'com.android.internal.systemui.navbar.gestural',
    );
    assert.match(device('shell', 'cmd', 'overlay', 'list'), gestural);
    device('shell', 'am', 'wait-for-broadcast-idle');
  }
  let nodes;
  start();
  await delay(800);
  nodes = tree('android-initial-tree');
  const review = target(nodes, 'workspace-review', {
    role: 'Button',
    name: 'Review changes',
    enabled: true,
  });
  const ripple = await verifyRipple({ device, serial, tools, reports, nodes, review });

  tap(review);
  nodes = tree('android-validation-tree');
  target(nodes, 'workspace-name', { role: 'EditText', name: 'Workspace name', focused: true });
  assert.ok(
    nodes.some((node) => node.text === 'Enter a workspace name'),
    'Missing announced validation copy',
  );
  assert.equal(
    keyboardVisible(device('shell', 'dumpsys', 'input_method')),
    true,
    'Keyboard must open on invalid input',
  );
  device('shell', 'input', 'text', 'Android%sdraft');
  device('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await delay(350);
  assert.equal(
    keyboardVisible(device('shell', 'dumpsys', 'input_method')),
    false,
    'Hardware Back must close the keyboard',
  );
  nodes = tree();
  const field = target(nodes, 'workspace-name', { role: 'EditText', name: 'Workspace name' });
  assert.equal(field.text, 'Android draft');
  tap(target(nodes, 'workspace-review'));
  nodes = tree('android-modal-tree');
  target(nodes, 'workspace-cancel', { role: 'Button', name: 'Keep editing', enabled: true });
  device('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  nodes = tree();
  assert.equal(target(nodes, 'workspace-name').text, 'Android draft');
  tap(target(nodes, 'workspace-review'));
  target(tree(), 'workspace-cancel');
  const y = String(Math.floor(profile.height * 0.55));
  device('shell', 'input', 'swipe', '2', y, String(Math.floor(profile.width * 0.68)), y, '280');
  nodes = tree('android-gesture-back-tree');
  assert.equal(target(nodes, 'workspace-name').text, 'Android draft');
  tap(target(nodes, 'workspace-review'));
  tap(target(tree(), 'workspace-save'));
  nodes = tree('android-pending-tree');
  target(nodes, 'workspace-save', { role: 'Button', enabled: false });
  target(nodes, 'workspace-cancel', { role: 'Button', enabled: false });
  target(nodes, 'workspace-pending', { name: 'Saving request 1' });
  return ripple;
}
