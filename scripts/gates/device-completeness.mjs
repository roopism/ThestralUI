import assert from 'node:assert/strict';
import { skipReasons } from '../selection/device-inputs.mjs';
import { classifyDevicePath } from '../selection/proposal-devices.mjs';

// Compare the production classifier to the independent observations of each full
// device stage. Directory copies cover content; listings also cover future names.
export function checkDeviceCompleteness(map, platforms, classify = classifyDevicePath) {
  assert.deepEqual(Object.keys(platforms).sort(), ['android', 'iphone']);
  const check = (path, status) => assert.ok(!skipReasons.has(
    classify(map, [{ platforms }], new Set(), path, status)), 'Device input classified as skippable: ' + path);
  for (const record of Object.values(platforms)) {
    assert.ok(record.bundle.length && record.files.length);
    for (const [, path] of record.bundle) {
      if (path.endsWith('/')) {
        const members = [...map.classes.keys()].filter(file => file.startsWith(path));
        assert.ok(members.length, 'Missing bundle workspace ' + path);
        for (const file of members) check(file, 'M');
      } else check(path, 'M');
    }
    for (const file of record.files) check(file, 'M');
    for (const path of record.directories) for (const file of map.classes.keys())
      if (!path || file.startsWith(path + '/')) check(file, 'M');
    for (const {path: dir} of record.listings) check((dir ? dir + '/' : '') + 'new-input', 'A');
  }
}
