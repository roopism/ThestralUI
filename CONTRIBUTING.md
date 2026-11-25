# Contributing

Use the Node version in `.nvmrc`. Start each branch at the fetched integration commit. The delivery ledger records the current integration commit and its qualification results.

```sh
nvm use
git fetch --no-tags origin feat/enterprise-ui
git switch -c family/icon-button origin/feat/enterprise-ui
npm ci
```

Use `gates/<topic>` for shared verification changes and `docs/<topic>` for documentation. Open pull requests against `feat/enterprise-ui`. The maintainer handles releases separately.

## Authoring

A family owns its source, styles, specification, fixtures, stories, scenarios, consumer examples and manifest. Edit the manifest when its bindings, file ownership or registered cases change. Build the packages and check the whole TypeScript project, including the browser tests. Compare discovered cases with the rosters. Keep the generated outputs in the same commit as their inputs. Read the [manifest guide](manifests/README.md) and [standing rules](AGENTS.md).

Use separate worktrees for independent authors. Port bases are 6006 for integration and 6106, 6206 and 6306 for the three workers. Storybook uses the base port. The browser and visual fixtures use the next two ports. Set `ULD_PORT_BASE` in a worker checkout.

## Qualification and landing

The commit hook takes an isolated snapshot of the index. It runs the source, type and regression checks. The full command checks a committed tree and uses the local VM and devices. Fetch the server's merge result when the proposal and integration have diverged.

```sh
git fetch --no-tags origin refs/pull/123/merge
npm run qualify -- FETCH_HEAD
npm run land -- 123
```

Keep the Mac idle during timing. The simulator and both Android profiles share a queued reservation. Preserve stale-lock metadata and use the recovery function in `scripts/workers/lock.mjs` only after verifying the original process is dead. Low-end Android may reuse the integration base’s passing timing trials when every app entry has the same name and SHA-256. The comparison ignores ZIP timestamps and signature files directly under META-INF ending in .RSA, .SF, .EC or .DSA. The receipt records both signed APK file hashes, the entry-manifest hash and the source receipt. A changed app entry requires all timing trials. Each build runs its own selected functional scenarios. See the [check inventory](docs/enterprise-check-inventory.md) for the inspection stages.

The local guest is named `uld-linux`. This Mac uses a 20 GiB disk, 4 virtual CPUs and 6 GiB of memory. The guest runs Ubuntu 24.04 arm64, Node 22.23.2 and the Playwright version in the lockfile. The pipeline verifies its recorded source image and pinned SSH host key after each boot. It sends the requested commit to the guest's bare repository, then stops the guest after Linux browser checks.

The guest has a local working clone at `~/qualification` and a bare repository at `~/repo.git`. The working clone fetches only from that bare repository. The Mac holds the VM-only SSH identity and its configuration under `~/Library/Application Support/ui-lazy-dev/linux-vm/`. Keep GitHub credentials off the guest.

The Git common directory holds per-tree receipts under `uld-receipts/`, attempts under `uld-receipts/attempts/` and historical evidence under `uld-delivery/`. A successful landing verifies the merged tree and preserves the source commit before removing the remote proposal branch. Enter its commit, timing and open release work in the [ledger](docs/ui-lazy-dev-state.md).
