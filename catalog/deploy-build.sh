#!/bin/sh
set -eu

if [ -e .git ] || [ -n "${ULD_ARTIFACT_COMMON:-}" ]; then
  exec npm run build
fi

# A source export nested in another checkout must never take that checkout's lock.
if [ "$(uname -s)" != Linux ] || [ "${VERCEL:-}" != 1 ] ||
   [ -n "${ULD_TIMING_RESERVATION:-}" ] || git rev-parse --git-dir >/dev/null 2>&1; then
  echo 'Set ULD_ARTIFACT_COMMON to the original checkout’s shared Git directory for local export builds.' >&2
  exit 1
fi

# The hosted Linux worker receives a source export without a Git lock directory.
for workspace in tokens ui-web ui-native; do
  npm run build -w "@ui-lazy-dev/$workspace"
done
exec npm exec --offline -- storybook build -o dist/catalog --disable-telemetry
