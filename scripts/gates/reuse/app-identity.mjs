import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const byName = (left, right) => Buffer.compare(Buffer.from(left[0]), Buffer.from(right[0]));

// Bind the file type, permissions and the contents of every bundle member. For
// a directory, "fileSha256" identifies the entire signed distribution.
export function appIdentity(platform, path) {
  if (platform === 'android') {
    assert.ok(lstatSync(path).isFile(), 'Expected a regular APK');
    const program = fileURLToPath(new URL('../apk-identity.py', import.meta.url));
    const { apkSha256, entryManifestSha256 } = JSON.parse(execFileSync('python3', [program, path], { encoding: 'utf8' }));
    return { fileSha256: apkSha256, manifestSha256: entryManifestSha256 };
  }
  assert.equal(platform, 'ios', 'Unknown app platform');
  assert.ok(path.endsWith('.app') && lstatSync(path).isDirectory(), 'Expected an iOS .app directory');
  const root = realpathSync(path), entries = [['', 'directory', lstatSync(root).mode & 0o7777]];
  function visit(directory) {
    for (const component of readdirSync(join(root, directory), { encoding: 'buffer' })) {
      const child = component.toString('utf8');
      assert.ok(Buffer.from(child).equals(component), 'Ambiguous iOS bundle filename');
      const name = directory ? directory + '/' + child : child;
      const full = join(root, name), stat = lstatSync(full), mode = stat.mode & 0o7777;
      if (name === '_CodeSignature') assert.ok(stat.isDirectory(), 'Invalid iOS code signature directory');
      if (name === 'embedded.mobileprovision') assert.ok(stat.isFile(), 'Invalid iOS provisioning profile');
      if (stat.isDirectory()) {
        entries.push([name, 'directory', mode]);
        visit(name);
      } else if (stat.isFile()) {
        entries.push([name, 'file', mode, hash(readFileSync(full))]);
      } else {
        assert.ok(stat.isSymbolicLink(), 'Unexpected iOS app entry ' + name);
        const target = readlinkSync(full, { encoding: 'buffer' });
        const location = relative(root, realpathSync(full));
        assert.ok(location && !isAbsolute(location) && location !== '..' && !location.startsWith('..' + sep),
          'External or cyclic iOS app link ' + name);
        assert.ok(!signature(location) || signature(name), 'iOS app link depends on a signature ' + name);
        entries.push([name, 'link', mode, hash(target)]);
      }
    }
  }
  function signature(name) {
    return name === 'embedded.mobileprovision' || name === '_CodeSignature' || name.startsWith('_CodeSignature/');
  }
  visit('');
  entries.sort(byName);
  assert.ok(entries.some(([name, kind]) => name === 'Info.plist' && kind === 'file'), 'Missing iOS app metadata');
  return {
    fileSha256: hash(JSON.stringify(entries)),
    manifestSha256: hash(JSON.stringify(entries.filter(([name]) => !signature(name)))),
  };
}
