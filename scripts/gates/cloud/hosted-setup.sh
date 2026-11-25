set -euo pipefail
test "$GITHUB_ACTIONS" = true
test "$GITHUB_SHA" = "$MERGE"
test "$(git rev-parse HEAD)" = "$BASE"
test "$(id -u)" != "$(id -u nobody)"
# Keep the CI user's metadata and credential-free checkout outside the build user.
root=$(mktemp -d /tmp/thestral-shard.XXXXXXXX)
chmod 755 "$root"
trusted="$root/base"
candidate="$root/candidate"
home="$root/home"
mkdir "$home" "$home/tmp" "$home/cache"
git clone --quiet --no-local --no-checkout "$PWD" "$trusted"
git -C "$trusted" fetch --quiet --no-tags "$PWD" "$MERGE"
git -C "$trusted" checkout --quiet --detach "$BASE"
git -C "$trusted" cat-file -e "$MERGE^{commit}"
git clone --quiet --no-local --no-checkout "$PWD" "$candidate"
git -C "$candidate" fetch --quiet --no-tags "$PWD" "$MERGE"
git -C "$candidate" checkout --quiet --detach "$MERGE"
# Clone only from the authenticated local object database. Do not copy Actions credentials.
cp -R node_modules "$trusted/node_modules"
cp -R "$(dirname "$(dirname "$(command -v node)")")" "$root/node"
export PATH="$root/node/bin:$PATH"
cp -R "$RUNNER_TEMP/qualification-browsers" "$root/browsers"
export PLAYWRIGHT_BROWSERS_PATH="$root/browsers"
mkdir "$home/device-hosts" "$home/bundle"
if test "$SUITE" = "iPhone Simulator" && test -d "$RUNNER_TEMP/iphone-cache"; then
  cp -R "$RUNNER_TEMP/iphone-cache/." "$home/bundle"
fi
if test "$SUITE" = "iPhone Simulator"; then
  cp -R "$RUNNER_TEMP/qualification-maestro/maestro" "$root/maestro"
  cp -R "$RUNNER_TEMP/qualification-gems" "$root/gems"
  export MAESTRO_BIN="$root/maestro/bin/maestro" GEM_HOME="$root/gems" GEM_PATH="$root/gems"
  export DEVELOPER_DIR=/Applications/Xcode_26.3.app/Contents/Developer
  export PATH="$GEM_HOME/bin:$PATH"
fi
chmod -R a+rX,go-w "$trusted" "$root/node" "$root/browsers"
sudo -n chown -R nobody "$candidate" "$home"
(
  cd "$candidate"
  sudo -n -u nobody /usr/bin/env -i HOME="$home" TMPDIR="$home/tmp" PATH="$PATH" CI=1 \
    npm ci --ignore-scripts --no-audit --no-fund > "$RUNNER_TEMP/candidate-install.log" 2>&1
  # Both the fixture imports and the launcher must load the same browser kit.
  sudo -n -u nobody /usr/bin/env -i HOME="$home" PATH="$PATH" node --input-type=module - "$trusted" <<'JS'
import assert from 'node:assert/strict';
import { lstatSync, readFileSync, realpathSync, renameSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
const base = process.argv[2];
const lock = root => JSON.parse(readFileSync(join(root,'package-lock.json'))).packages;
const before = lock(base), after = lock('.');
for (const name of ['@playwright/test','playwright','playwright-core']) {
  const dir = 'node_modules/' + name;
  assert.ok(before[dir]?.integrity && before[dir].integrity === after[dir]?.integrity);
  assert.equal(realpathSync(dir), resolve(dir));
  assert.ok(lstatSync(dir).isDirectory());
  renameSync(dir, dir + '.candidate-install');
  symlinkSync(join(base,dir), dir, 'dir');
}
JS
)
if test "$SUITE" = "iPhone Simulator"; then
  cache_host() {
    sudo -n -u nobody /usr/bin/env -i PATH="$PATH" HOME="$home" python3 -I       "$trusted/scripts/gates/cloud/host-cache.py" "$1" "$home/device-hosts" "$home/bundle/host.tar" "$ImageVersion-$BASE-$MERGE"
  }
  cache_host restore
fi
keep_failed_visuals() {
  local status=$?
  if test "$status" = 0; then return; fi
  if test "$SUITE" = "Mac visual comparisons" && test -d "$candidate/test-results/cloud-visual"; then
    # Export only rendered PNGs from the unprivileged shard. Expected images stay immutable.
    sudo -n -u nobody /usr/bin/env -i PATH="$PATH" python3 -I - "$candidate/test-results/cloud-visual" \
      > "$RUNNER_TEMP/visual-observations.zip" <<'PYTHON'
from pathlib import Path
import os, sys, zipfile
root = Path(sys.argv[1]).resolve(strict=True)
with zipfile.ZipFile(sys.stdout.buffer, "w") as output:
    for directory, _, files in os.walk(root, followlinks=False):
        for name in sorted(files):
            path = Path(directory) / name
            if name.endswith("-actual.png") and path.is_file() and path.resolve() == path:
                output.write(path, path.relative_to(root))
PYTHON
  fi
  return "$status"
}
trap keep_failed_visuals EXIT
node "$trusted/scripts/gates/cloud/hosted-runner.mjs" "$trusted" "$candidate" "$home" "$BASE" "$MERGE" "$SHARD" "$RUNNER_TEMP/verified-shard"
if test "$SUITE" = "iPhone Simulator" && ! test -e "$home/bundle/host.tar"; then
  cache_host save
  if test -f "$home/bundle/host.tar"; then
    mkdir -p "$RUNNER_TEMP/iphone-cache"
    for file in host.json host.tar; do
      # Read candidate-owned cache output as the same unprivileged OS user.
      sudo -n -u nobody /bin/cat "$home/bundle/$file" > "$RUNNER_TEMP/iphone-cache/$file"
    done
  fi
fi
