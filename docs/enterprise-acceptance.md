# Local acceptance checks

Use Node 22.23.2 and run `npm ci`. Configure Git with `git config core.hooksPath .githooks` in a new clone. Install the three Playwright browser engines with `npx playwright install chromium firefox webkit`.

Run `npm run gate:commit` to qualify the staged Git tree. For a family change, the hook prints its affected families, Chromium journeys, unit cases, packed contract checks and bundle budgets. It includes dependents and runs the iPhone Simulator when native paths change. A private dependency cache reuses installs across snapshots with matching lockfiles and workspace manifests.

Shared tokens, build or gate changes, and unclassified files trigger the full suite. Run `npm run gate:integration` to check the current commit locally. The full suite runs the three browser engines, visual and portable scenarios, hydration, package upgrades and rollbacks, native consumer builds and iPhone Simulator journeys. The pre-push hook checks each distinct outgoing revision. Pull requests run the full suite on macOS.

When MAIN already holds a batch lock with `withLock`, pass the callback’s reservation ID to each child Git or gate process as `ULD_INTEGRATION_LEASE`. Wait for each child to finish before advancing the branch. The gate acquires its own simulator lock when needed.

Library contributors edit the owning file in `packages/tokens/domains/`. From the repository root, run `node packages/tokens/build.mjs --write-source` to regenerate the published `tokens.json` and its CSS and typed JavaScript outputs.

## Set up the iPhone Simulator on Apple silicon

Use full Xcode with an available iPhone Simulator runtime, Maestro 2.4.0, an arm64 Java 17 JDK, and CocoaPods 1.16.2. The simulator host installs pods in deployment mode using its [committed lockfile](../tests/simulator/host/Podfile.lock).

For a JDK registered with macOS, use `export JAVA_HOME="$(/usr/libexec/java_home -F -v 17 -a arm64)"`. For Homebrew OpenJDK 17, use `export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"`. Set this in the shell that runs the gate. Check the selected tools before building.

```sh
"$JAVA_HOME/bin/java" -XshowSettings:properties -version
pod --version
xcodebuild -version
xcrun simctl list devices available
```

The Java output should report version 17 and `os.arch = aarch64`. Use `MAESTRO_BIN` to select a specific Maestro executable and `UI_SIMULATOR_ID` to select an iPhone by UDID. The runner otherwise uses a booted iPhone when available and starts an available iPhone if necessary.

The workspace journey checks validation, draft retention, duplicate save input, failed-save recovery and background/resume. Two appearance journeys exercise long text and saving under light mode at standard text size and dark mode at accessibility-extra-large. The runner restores the original appearance and text size after the journeys. A standalone run writes the pass counts, platform and tool versions, profiles and archive hashes to `release/evidence/ios-simulator.json`. Inspect the JUnit XML and driver diagnostics in `test-results/ios-simulator/`.

Physical-device, Android runtime, screen-reader, independent review and production measurements are pending.
