# Enterprise check inventory

Every automated check that a staff-level review of a 100M-DAU UI library expects, grouped by what it verifies, with its status in this repository on 24 November 2026 and the stage where it runs or would run. Rows marked **Running** have an existing enforcement point. The local pipeline landed in PR #19 after all 18 stages passed. The delivery ledger identifies the exact tree and the evidence for reused Android timing. **Partial** names the fixtures or platforms where a check already runs. **Planned** means neither. Third-party rule sets are listed with their upstream identifiers so adoption is a configuration task, not a research task.

**Fast** covers source and policy checks. **Typed** uses the TypeScript program or built packages. **Browser** covers Chromium, Firefox and WebKit. **Device** covers the iPhone Simulator and both Android profiles under a shared reservation. **Release**, **Scheduled** and **Manual** retain separate status. Phase 8 covers all applicable non-release entries before family delivery resumes. The 821 entries span 15 check sets. The appendix lists 88 additional entries for other technology stacks. The six work items originally listed for the first batch are part of that scope. Conditional checks apply when their matching inputs exist. A scheduled check belongs in Phase 8 if it serves development independently of a release.

| Check set | Rules | Status | Stage |
| --- | ---: | --- | --- |
| Existing checks in ui-lazy-dev | 51 | Running except the retired branch-routing check | Fast, Typed, Browser, Device |
| Runtime accessibility | 14 | Mixed | Browser, Device |
| Internationalization and localization | 8 | Mostly planned | Browser, Device, Fast |
| Performance and size | 12 | Mostly running | Browser, Device, Release |
| Server rendering and hydration | 6 | Mostly running | Typed, Browser |
| Runtime security | 9 | Mixed | Browser, Fast, Release |
| API stability and versioning | 10 | Mixed | Fast, Typed, Release |
| Documentation and catalog completeness | 6 | Mostly planned | Fast |
| Written policy presence | 6 | Planned | Fast |
| Manual evidence per release | 6 | Recorded, not automated | Manual |
| Core source checks: ESLint, typescript-eslint, jsx-a11y and React | 130 | Planned | Fast |
| Additional fast source checks for this library | 285 | Planned | Fast |
| Checks requiring types, a dependency graph, network data or a built package | 81 | Planned | Typed, Release |
| Optional checks for matching files, conventions or tooling | 178 | Planned | Fast |
| Release and scheduled checks | 19 | Planned | Release, Scheduled |
| **Total in scope** | **821** | | |

## Existing checks in ui-lazy-dev

### Browser, package and device qualification

The local qualification command runs these suites on the proposed merge tree. Browser behavior also runs in the local Linux guest. Shared code, harness changes, unknown inputs and release qualification select every native scenario. Family changes select the affected native scenarios. Omitting the iPhone requires proof that every changed input is web-only.

| Rule | Check | Where |
| --- | --- | --- |
| `browser behavior` | Run every registered family scenario and adapter regression in Chromium, Firefox and WebKit, and match executed cases against the registered roster | `tests/scenarios/web`, `packages/policy/quality/browser-matrix.mjs` |
| `visual checks` | Compare rendered components with approved light and dark, phone and desktop baselines per engine | `tests/<family>/*.visual.ts` |
| `browser performance` | Measure opening, typing, scroll and motion frame p95 and fail any metric above its recorded baseline times allowance | `tests/browser/quality-perf.mjs`, `quality-perf-policy.mjs` |
| `packed family contracts` | Install the packed tarballs into a clean consumer and probe every public export, prop union and compatibility alias | `packages/policy/quality/api-depth` |
| `minimum-version consumer` | Build and render the packed packages in the oldest supported React and Next.js combination | `scripts/verify-consumers.mjs min` |
| `maximum-version consumer` | Build and render the packed packages in the newest supported React and Next.js combination | `scripts/verify-consumers.mjs max` |
| `packed bundle limits` | Measure each packed import and stylesheet gzip size against the per-family band and the 60 KB default install ceiling | `tests/packaging/bundle-baseline.json`, `size-ceiling.mjs` |
| `native package consumer` | Install the packed native package into a React Native consumer and resolve every exported renderer | `scripts/verify-native-consumer.mjs` |
| `iPhone Simulator` | Run the registered native journeys and selected scenarios on a reused iPhone 17 Pro build, verifying the installed JavaScript hash matches the candidate | `scripts/verify-ios-simulator.mjs`, `tests/simulator/scenarios.mjs` |
| `android profiles` | Run the registered native scenarios and family journeys on the standard and low-end Android emulator profiles with reused native builds | `scripts/verify-android-emulator.mjs`, `tests/android/profiles.json` |
| `android frame and input budgets` | On the low-end profile, fail a candidate whose scroll input delay, press frame or scroll frame p95 exceeds the calibrated limit, and record every trial | `tests/android/frame-budget.mjs`, `tests/android/low-end-budget.json` |
| `hydration` | Render each family on the server, hydrate it, and fail on markup mismatch or unexpected client JavaScript | `scripts/verify-hydration.mjs` |
| `server foundations` | Verify server-safe leaves and client boundaries hold in a React Server Components consumer | `scripts/verify-server-foundations.mjs` |

### Fast and Typed stages

The staged commit hook and the full qualification command run these checks. Fast covers policy, style, integrity and manifest drift. Typed covers package builds, type-checking, unit rosters, public contracts and generated artifacts.

| Rule | Check | Where |
| --- | --- | --- |
| `policy check` | Apply the configured source rules using the registered owners and adapters | `packages/policy/cli.mjs check --config ui-policy.json` |
| `style policy --prove` | Enforce token-only visual values, scoped selectors and dated exceptions, and prove each rule still rejects its fixture | `packages/style-policy/cli.mjs` |
| `integrity` | Scan every tracked candidate file for credentials and private keys, and reject focused or skipped tests | `packages/policy/quality/integrity.mjs` |
| `typecheck` | Strict TypeScript project check across packages, catalog and tests | `tsc --noEmit -p tsconfig.json` |
| `token build --check` | Rebuild design tokens and fail if the committed outputs differ | `packages/tokens/build.mjs --check` |
| `unit matrix` | Run Vitest and native Jest suites and compare the discovered cases with the registered roster | `scripts/unit-matrix.mjs`, `packages/policy/quality/unit-matrix.mjs` |
| `inventory` | Validate public bindings and report exported, supported and experimental families | `scripts/inventory.mjs`, `scripts/verify-inventory.mjs` |
| `manifests --check` | Regenerate family manifests and fail on drift | `scripts/manifests/generate.mjs --check` |
| `artifacts` | Verify each built snapshot matches its recorded digest and file list | `scripts/verify-artifacts.mjs` |
| `version` | Require a version increase appropriate to the public additions in the change | `scripts/verify-version.mjs` |

### Built artifacts and runtime evidence (policy rule ids)

| Rule | Check |
| --- | --- |
| `ui-lazy-dev/archive-digest` | Match the digest of each packed workspace to its release record |
| `ui-lazy-dev/browser-case-roster` | Match executed browser cases and projects against their registered test matrix |
| `ui-lazy-dev/public-styles` | Preserve previously published CSS class names |
| `ui-lazy-dev/runtime-inventory` | Validate the bill of materials and licenses for the installed release packages |
| `ui-lazy-dev/version-public-additions` | Require the appropriate version increase for new public exports, classes or tokens |
| `ui-lazy-dev/visual-regression` | Compare rendered components with their approved visual baselines |

### Source and policy (policy rule ids)

| Rule | Check |
| --- | --- |
| `ui-lazy-dev/budget-approval` | Reject increases to published size budgets |
| `ui-lazy-dev/css-scope` | Require each CSS selector branch to stay inside its component scope |
| `ui-lazy-dev/cycle` | Reject circular runtime imports between modules |
| `ui-lazy-dev/design-token-values` | Require approved token references for governed visual values |
| `ui-lazy-dev/platform` | Reject imports from the other rendering platform |
| `ui-lazy-dev/primitive-owner` | Restrict raw interactive controls to their registered owners |
| `ui-lazy-dev/private-import` | Reject imports through undeclared package entry points |
| `ui-lazy-dev/product-import` | Keep application routing and application services out of library packages |
| `ui-lazy-dev/protected-paths` | Route edits to protected policy files through the gate-change branch. The old workflow is disabled. PR #19 checks the proposed rules against integration in the local pipeline. |
| `ui-lazy-dev/renderer-html` | Reject raw HTML injection sinks in component renderers |
| `ui-lazy-dev/renderer-io` | Keep network calls out of shared component renderers |
| `ui-lazy-dev/retained-test-registrations` | Preserve existing test registrations and engines on product proposals |
| `ui-lazy-dev/source-secrets` | Check tracked candidate files for credential patterns and private key files |
| `ui-lazy-dev/style-exceptions` | Require an owner, reason, exact source match and expiry for style exceptions |
| `ui-lazy-dev/test-import` | Reject production imports of stories, tests and fixtures |
| `ui-lazy-dev/test-selection` | Reject focused, skipped or disabled test declarations covered by the integrity policy |
| `ui-lazy-dev/theme-role-parity` | Match the names and types of light and dark theme roles |
| `ui-lazy-dev/token-alias-cycle` | Reject alias cycles in design tokens |
| `ui-lazy-dev/token-alias-target` | Resolve each token alias to an existing target |
| `ui-lazy-dev/token-alias-type` | Preserve token types across aliases |
| `ui-lazy-dev/token-outputs` | Compare generated token files with the committed outputs |

### Type and API contracts (policy rule ids)

| Rule | Check |
| --- | --- |
| `ui-lazy-dev/compatible-public-types` | Check published TypeScript declarations for compatibility with prior inputs and exports |

## Runtime accessibility

Static JSX rules cannot see focus management, live regions or what a screen reader announces. This set runs against rendered output in browsers and on devices.

| Rule | Check | Where |
| --- | --- | --- |
| `a11y/scenario-semantics` | Every scenario step resolves its target by neutral role and exact accessible name on web, iPhone and Android; a hidden duplicate or ambiguous name fails | Running · `docs/scenarios.md`, all three adapters |
| `a11y/keyboard-first-stop` | Press Tab to the declared first stop, verify focus and a visible outline before the shared steps | Running · `webKeyboardFocus` |
| `a11y/busy-state` | A busy control keeps its name, exposes busy and unavailable, and Android reads the platform busy suffix | Running · `expect: busy` |
| `a11y/reading-order` | Accessible reading order matches the declared order, including native traversal overrides | Running · `expect: before` |
| `a11y/zoom-200` | At 200% zoom every action in the fixture stays reachable and visible in all three engines | Running · overlay specs |
| `a11y/forced-colors` | Labels, borders and focus remain visible in Windows high-contrast and forced-colors mode | Running · repaired in PR 15 |
| `a11y/live-region` | A failed save exposes an assertive live region and nothing else on the screen does | Running on Android · extend to web and iPhone |
| `a11y/axe-rules` | Run the axe-core WCAG 2.2 A and AA rule set against every family fixture in every engine, with zero violations and no rule disabled without a dated exception | Partial · Button, Dialog, Data Table and catalog tests already run axe. All-family WCAG 2.2 A and AA coverage is pending. |
| `a11y/contrast-computed` | Compute contrast on rendered text and controls per brand and scheme: AA everywhere, AAA in high-contrast mode | Planned · browser suite |
| `a11y/target-size` | Interactive targets meet 24 by 24 CSS pixels (WCAG 2.2 2.5.8) or the documented exception | Planned · browser suite |
| `a11y/reduced-motion` | With reduced motion requested, no transform or opacity animation runs longer than one frame | Planned · motion visual config |
| `a11y/focus-restore` | Closing any overlay returns focus to the opener, including nested overlays and after unmount | Running for Dialog · generalize to every overlay family |
| `a11y/accessible-virtualization` | With virtualization enabled, a screen reader reaches an unmounted option, hears its name and state, and selects it | Planned · goal amendment 4, Data Table and List |
| `a11y/device-name-role-state` | VoiceOver and TalkBack report label, role and state through ready, busy and ready again on simulator and emulator | Partial · driver assertions inspect accessibility nodes on iPhone and Android. Physical VoiceOver and TalkBack walkthroughs remain release evidence |

## Internationalization and localization

The goal requires ten locales, right-to-left layout and locale-aware formatting on every family. Nothing in the third-party catalog covers this.

| Rule | Check | Where |
| --- | --- | --- |
| `i18n/rtl-render` | Render each family fixture with `dir="rtl"` and Arabic strings in all three engines and compare against RTL visual baselines | Running for Data Table · extend to every family |
| `i18n/message-completeness` | Every key in the English catalog exists in ar, he, ja, zh-Hans, hi, de, fr, es and pt-BR, with no untranslated fallback | Planned · `@ui-lazy-dev/messages` |
| `i18n/locale-provider-formatting` | Dates, times, numbers, plurals and selection counts format through the provider for each locale, including Arabic-Indic digits | Planned · locale provider family |
| `i18n/hermes-intl` | Every `Intl` constructor the library uses exists on the Hermes engine of the minimum supported React Native | Planned · found three missing during Locale provider work |
| `i18n/pseudo-locale` | Render with 40% expanded pseudo-locale strings and fail on clipping, overflow or overlapping controls | Planned · visual suite project |
| `i18n/bidi-mixed` | Mixed left-to-right and right-to-left content keeps isolation and correct punctuation placement | Planned · browser suite |
| `i18n/long-strings` | German and Finnish length strings fit every control at phone width without truncating accessible names | Planned · visual suite |
| `i18n/no-hardcoded-strings` | Component source contains no user-facing literal strings outside the message catalog | Planned · fast stage |

## Performance and size

Numbers come from the frozen goal and the calibrated low-end Android reference. Historical hosted timing samples remain diagnostic. Current timing runs on the reserved Mac and devices.

| Rule | Check | Where |
| --- | --- | --- |
| `perf/family-size-band` | Script plus styles gzip per family: primitives 1 KB, simple 2.5 KB, inputs 5 KB, overlays 7 KB, heavy 15 KB, date and time 80 KB opt-in | Running · `packed bundle limits` |
| `perf/default-install-ceiling` | The default install for an app is at most 60 KB gzip; icons, motion, date and time never count | Running · `size-ceiling.mjs` |
| `perf/budget-approval` | Published size budgets may only tighten | Running · `ui-lazy-dev/budget-approval` |
| `perf/browser-p95` | Opening, typing, scroll-two-frames and motion-frame p95 stay within baseline times allowance on the calibrated M3 | Running · `quality-perf.mjs` |
| `perf/android-low-end` | On the low-end profile, 95% of scroll updates arrive within the calibrated limit, press and scroll frames stay within theirs, every trial retained | Enforced · the calibrated scroll input limit is 26.513970 ms. The ledger retains the passing reference trials and subsequent failed attempts. |
| `perf/old-versus-new` | A timing failure is charged to the candidate only after the unchanged release passes the same fixture on the same device in the same session | Manual procedure · compare the two versions on the same device under the family cycle in AGENTS.md |
| `perf/idle-machine` | Benchmarks run only while the device lock is held and no other suite is active | Running · `simulator` lock |
| `perf/first-layout` | First layout of a data-heavy family on low-end Android within 2x the stock React Native screen | Planned · Data Table measured 72 ms versus 38 to 41 ms |
| `perf/virtualized-scroll` | Virtualized lists and grids drop no frames at 10,000 rows on the standard profile | Planned · List and Data Table |
| `perf/memory-low-end` | Resident memory of the catalog app stays flat across 50 open and close cycles of every overlay | Planned · Android profile |
| `perf/cold-start` | Catalog app cold start to first interaction on low-end Android within the recorded baseline plus allowance | Planned |
| `perf/hosted-diagnostic-only` | Hosted macOS timing results are recorded and compared old versus new on the same runner, never used as a pass or fail | Inapplicable to local builds · hosted execution is prohibited |

## Server rendering and hydration

| Rule | Check | Where |
| --- | --- | --- |
| `ssr/hydrate-clean` | Server markup hydrates with zero mismatch warnings for every family | Running · `verify-hydration.mjs` |
| `ssr/zero-extra-client-js` | Server-safe families add no client JavaScript beyond the registered chunk | Running · min and max consumers |
| `ssr/client-boundary` | Server-safe leaves and mixed re-exports reject a blanket client boundary | Running · policy test |
| `ssr/min-max-next` | Oldest and newest supported Next.js render the packed packages without warnings | Running · `verify-consumers.mjs` |
| `ssr/streaming` | Families render correctly inside a streamed Suspense boundary without layout shift on resolve | Planned |
| `ssr/csp-nonce` | Emitted styles and scripts carry the consumer's nonce; no inline style attribute is required at runtime | Planned · pairs with `security/strict-csp` |

## Runtime security

Supply-chain and workflow rules are catalogued under release and scheduled checks below. These cover the shipped components at runtime.

| Rule | Check | Where |
| --- | --- | --- |
| `security/renderer-html` | Reject raw HTML injection sinks in component renderers | Running · `ui-lazy-dev/renderer-html` |
| `security/renderer-io` | Keep network calls out of shared component renderers | Running · `ui-lazy-dev/renderer-io` |
| `security/source-secrets` | Check tracked candidate files for credential patterns and private key files | Running · `ui-lazy-dev/source-secrets` |
| `security/license-inventory` | Validate the bill of materials and licenses of the installed release packages | Running · `ui-lazy-dev/runtime-inventory` |
| `security/strict-csp` | Every family fixture renders and operates under `default-src 'self'` with no `unsafe-inline`, in all three engines | Planned · Playwright project |
| `security/sanitize-rich-content` | Families that accept markup or URLs neutralize script, event-handler and `javascript:` payloads | Planned · per-family spec |
| `security/no-eval` | No `eval`, `new Function` or dynamic `import()` of a computed string in shipped code | Planned · fast stage |
| `security/dependency-audit` | Published vulnerability data and registry signatures for every runtime dependency, run on release and nightly | Planned · scheduled local audit and release verification (see `npm/audit-signatures`) |
| `security/provenance-and-sbom` | Publish with build provenance and attach a CycloneDX SBOM per tarball to the release | Planned · release evidence (see Scorecard and SLSA rows) |

## API stability and versioning

| Rule | Check | Where |
| --- | --- | --- |
| `api/compatible-public-types` | Published declarations stay compatible with prior inputs and exports | Running · `ui-lazy-dev/compatible-public-types` |
| `api/version-public-additions` | New public exports, classes or tokens require the appropriate version increase | Running · `ui-lazy-dev/version-public-additions` |
| `api/public-styles` | Previously published CSS class names are preserved | Running · `ui-lazy-dev/public-styles` |
| `api/archive-digest` | Each packed workspace matches the digest in its release record | Running · `ui-lazy-dev/archive-digest` |
| `api/spec-and-story` | Every public export has a matching API spec and a public story with the reviewed properties | Running · api-depth test |
| `api/declaration-diff` | Diff packed `.d.ts` against the last release tag; removal or narrowing without a major bump fails | Planned · extend `scripts/check-api.mjs` |
| `api/deprecation-window` | A deprecated export names its replacement and removal version, and survives at least one minor | Planned |
| `api/changelog-entry` | Any public change carries a changelog entry under the correct heading | Planned · fast stage |
| `api/codemod-for-breaking` | A breaking change ships a codemod with a before and after fixture | Planned · `button-icon-slots` is the pattern |
| `api/exports-map-health` | Export conditions, types resolution and ESM/CJS shape are valid for every entry | Planned · publint and attw rows below |

## Documentation and catalog completeness

| Rule | Check | Where |
| --- | --- | --- |
| `docs/spec-status` | Every family spec declares draft, experimental, stable or deprecated and the full gate qualifies that declaration against the built package | Running · `enterprise-checklist.md` |
| `docs/scenario-referenced` | Every scenario ID is referenced from its family spec's states matrix and vice versa | Planned · fast stage |
| `docs/web-fixtures-present` | Every family with web scenarios exports the matching `web-fixtures.tsx` | Planned · fast stage |
| `docs/story-renders` | Every public story renders without console errors in Storybook build | Planned · `npm run build` |
| `docs/no-broken-links` | Relative links in `docs/` resolve to tracked files | Planned · fast stage |
| `docs/browser-matrix-generated` | The published support matrix is generated from `browser-matrix.mjs` and fails when stale | Planned |

## Written policy presence

Phase 8 calls for a Fast-stage check that these files are tracked and identify the supported version. This check is planned.

| Rule | Check | Where |
| --- | --- | --- |
| `policy/security-md` | `SECURITY.md` names a reporting channel, response time and supported versions | Planned |
| `policy/semver-and-deprecation` | A versioning document states the semver contract, deprecation window and codemod promise | Planned |
| `policy/support-window` | Supported React, Next.js, React Native, iOS and Android versions are listed and match the min and max consumers | Planned |
| `policy/license-and-notices` | `LICENSE` and third-party notices are present and match the runtime inventory | Planned |
| `policy/changelog` | `CHANGELOG.md` exists and its top entry matches the package version | Planned |
| `policy/contributing-current` | `CONTRIBUTING.md` and `AGENTS.md` reference only scripts that exist | Planned |

## Manual evidence per release

These cannot be automated. Each is recorded per release with the tested revision, platform, fixture, tester and date, as the goal's section on first-exercise criteria requires. A release that lacks a row is marked experimental.

| Rule | Check | Where |
| --- | --- | --- |
| `manual/physical-voiceover` | VoiceOver walkthrough on a physical iPhone for every stable family | Goal, after 1.0 · move to each release |
| `manual/physical-talkback` | TalkBack walkthrough on a physical low-end Android phone for every stable family | Goal, after 1.0 · move to each release |
| `manual/external-wcag-audit` | External WCAG 2.2 AA audit including NVDA and JAWS | Goal, after 1.0 |
| `manual/independent-review` | Each promoted family is reviewed by someone who did not author it, recorded in the PR | Manual release evidence · independent review is outside the automated integration checks |
| `manual/production-measurement` | First adopting app reports bundle, frame and input metrics from production within one release | Planned |
| `manual/rollback-drill` | A release can be reverted on `main` and republished within one hour, exercised once per quarter | Planned |

## Core source checks: ESLint, typescript-eslint, jsx-a11y and React

> **Status:** Planned. The project does not invoke this ESLint configuration during qualification. Adopt as a baseline-and-ratchet so existing violations are recorded and only new ones fail.

### JavaScript correctness

| Rule | Check |
| --- | --- |
| `accessor-pairs` | Flag a setter that lacks its matching getter |
| `array-callback-return` | Require a returned value from array transforms that consume it |
| `constructor-super` | Require a valid parent constructor call in a derived constructor |
| `eqeqeq` | Flag coercive equality comparisons outside configured exceptions |
| `for-direction` | Check that a for-loop counter moves toward its exit condition |
| `getter-return` | Flag getter paths that can finish without returning a value |
| `no-async-promise-executor` | Reject an async callback passed to the Promise constructor |
| `no-case-declarations` | Require block scope for lexical declarations inside switch cases |
| `no-class-assign` | Prevent reassignment of a class declaration |
| `no-compare-neg-zero` | Flag comparisons that cannot distinguish negative zero |
| `no-cond-assign` | Detect unintended assignments in branch conditions |
| `no-const-assign` | Reject assignment to a constant binding |
| `no-constant-binary-expression` | Detect comparisons and logical expressions with predetermined results |
| `no-constant-condition` | Flag branch conditions that always have the same outcome |
| `no-constructor-return` | Flag a constructor returning an unrelated value |
| `no-control-regex` | Detect unintended control characters in regular expressions |
| `no-debugger` | Reject debugger statements in committed source |
| `no-delete-var` | Reject attempts to delete a declared variable |
| `no-dupe-class-members` | Detect colliding class members |
| `no-dupe-else-if` | Detect an else-if branch already covered by an earlier condition |
| `no-dupe-keys` | Detect object properties overwritten by duplicate literal keys |
| `no-duplicate-case` | Detect duplicate switch case values |
| `no-empty` | Flag empty control-flow blocks |
| `no-empty-character-class` | Flag regular-expression character sets that match nothing |
| `no-empty-pattern` | Flag destructuring patterns that bind nothing |
| `no-empty-static-block` | Flag empty static initialization blocks |
| `no-eval` | Reject direct evaluation of source strings |
| `no-ex-assign` | Prevent reassignment of a caught exception |
| `no-extend-native` | Reject mutation of built-in object prototypes |
| `no-fallthrough` | Detect accidental execution of the next switch case |
| `no-func-assign` | Detect reassignment of a declared function |
| `no-global-assign` | Prevent reassignment of read-only global bindings |
| `no-implied-eval` | Reject APIs invoked with strings interpreted as code |
| `no-import-assign` | Reject mutation of imported bindings |
| `no-invalid-regexp` | Validate constant patterns passed to RegExp constructors |
| `no-irregular-whitespace` | Detect unusual whitespace that can disguise source boundaries |
| `no-loop-func` | Flag loop-created closures that capture changing bindings |
| `no-loss-of-precision` | Detect numeric literals rounded during parsing |
| `no-misleading-character-class` | Detect regular-expression character classes that split a character sequence |
| `no-new-func` | Reject generation of functions from runtime strings |
| `no-new-native-nonconstructor` | Reject constructor syntax for nonconstructible native functions |
| `no-new-wrappers` | Reject accidental boxed strings, numbers and booleans |
| `no-nonoctal-decimal-escape` | Reject ambiguous decimal escapes in string literals |
| `no-obj-calls` | Reject attempts to invoke noncallable global objects |
| `no-promise-executor-return` | Flag values returned from Promise executors and silently discarded |
| `no-prototype-builtins` | Flag direct calls to inherited object inspection methods on untrusted objects |
| `no-redeclare` | Detect duplicate declarations of a binding within a scope |
| `no-regex-spaces` | Flag ambiguous runs of literal spaces in regular expressions |
| `no-return-assign` | Flag unintended assignments inside return statements |
| `no-script-url` | Reject javascript-scheme URLs in source |
| `no-self-assign` | Flag assignments that write a value back to itself |
| `no-self-compare` | Flag comparisons of an expression with itself |
| `no-setter-return` | Reject values returned by property setters |
| `no-shadow-restricted-names` | Prevent declarations from hiding restricted built-in names |
| `no-sparse-arrays` | Detect accidental empty slots in array literals |
| `no-template-curly-in-string` | Flag interpolation syntax mistakenly placed in ordinary strings |
| `no-this-before-super` | Reject access to this before parent initialization |
| `no-unassigned-vars` | Flag declared variables read without ever receiving a value |
| `no-undef` | Detect use of undeclared JavaScript identifiers |
| `no-unexpected-multiline` | Detect newlines that unexpectedly join separate statements |
| `no-unmodified-loop-condition` | Flag loop conditions whose controlling variables never change |
| `no-unreachable` | Detect statements after unconditional control transfers |
| `no-unreachable-loop` | Flag loops with no path to a second iteration |
| `no-unsafe-finally` | Reject control transfers that override errors or returns during cleanup |
| `no-unsafe-negation` | Flag a misplaced negation in a relational comparison |
| `no-unsafe-optional-chaining` | Detect optional-chain results used where undefined would throw |
| `no-unused-expressions` | Detect standalone expressions that have no effect |
| `no-unused-labels` | Detect labels never referenced by control flow |
| `no-unused-private-class-members` | Detect private class members never consumed by the class |
| `no-unused-vars` | Detect unused bindings and parameters under the configured conventions |
| `no-useless-assignment` | Detect assigned values overwritten before any read |
| `no-useless-backreference` | Detect regex backreferences that can never match meaningfully |
| `no-useless-catch` | Flag catch blocks that only rethrow the same exception |
| `no-useless-escape` | Detect escape sequences that leave the interpretation unchanged |
| `no-with` | Reject dynamic scope introduced by with statements |
| `prefer-promise-reject-errors` | Flag Promise rejections without Error objects |
| `preserve-caught-error` | Require new exceptions in catch blocks to preserve the original cause |
| `use-isnan` | Detect NaN comparisons that can never succeed |
| `valid-typeof` | Validate string literals compared with typeof |

### JSX accessibility

| Rule | Check |
| --- | --- |
| `jsx-a11y/alt-text` | Require text alternatives on images and other elements that need them |
| `jsx-a11y/anchor-ambiguous-text` | Flag links whose text does not identify their destination |
| `jsx-a11y/anchor-has-content` | Require an accessible name for links |
| `jsx-a11y/anchor-is-valid` | Require anchors used as links to have navigable destinations |
| `jsx-a11y/aria-activedescendant-has-tabindex` | Ensure the element managing an active descendant is keyboard-focusable |
| `jsx-a11y/aria-props` | Reject unrecognized ARIA attribute names |
| `jsx-a11y/aria-proptypes` | Check the value type of each ARIA attribute |
| `jsx-a11y/aria-role` | Reject invalid ARIA role names |
| `jsx-a11y/aria-unsupported-elements` | Reject ARIA attributes on elements that cannot expose them |
| `jsx-a11y/autocomplete-valid` | Validate input autocomplete tokens |
| `jsx-a11y/click-events-have-key-events` | Require keyboard handling for clickable non-native controls |
| `jsx-a11y/control-has-associated-label` | Check that interactive controls have an accessible name |
| `jsx-a11y/heading-has-content` | Require headings to have accessible content |
| `jsx-a11y/html-has-lang` | Require a language on the root HTML element |
| `jsx-a11y/iframe-has-title` | Require an accessible title for each iframe |
| `jsx-a11y/img-redundant-alt` | Flag redundant image descriptions in alternative text |
| `jsx-a11y/interactive-supports-focus` | Require interactive elements with handlers to accept keyboard focus |
| `jsx-a11y/label-has-associated-control` | Check that each form label is associated with its input |
| `jsx-a11y/lang` | Validate the document language tag |
| `jsx-a11y/media-has-caption` | Require applicable prerecorded media to include a captions track |
| `jsx-a11y/mouse-events-have-key-events` | Pair mouse-only hover handlers with equivalent focus handlers |
| `jsx-a11y/no-aria-hidden-on-focusable` | Reject keyboard-focusable elements directly marked aria-hidden |
| `jsx-a11y/no-distracting-elements` | Reject blinking and scrolling marquee elements |
| `jsx-a11y/no-interactive-element-to-noninteractive-role` | Flag noninteractive roles that remove native control semantics |
| `jsx-a11y/no-noninteractive-element-interactions` | Flag interaction handlers attached to noninteractive elements |
| `jsx-a11y/no-noninteractive-element-to-interactive-role` | Flag interactive roles applied to unsuitable native elements |
| `jsx-a11y/no-redundant-roles` | Flag roles that merely repeat an element's default role |
| `jsx-a11y/role-has-required-aria-props` | Require the ARIA properties a role needs |
| `jsx-a11y/role-supports-aria-props` | Check that each ARIA property is supported by its element's role |
| `jsx-a11y/scope` | Restrict table-header scope attributes to header cells |
| `jsx-a11y/tabindex-no-positive` | Flag positive tab indexes that override document focus order |

### React and JSX correctness

| Rule | Check |
| --- | --- |
| `react/button-has-type` | Require an explicit valid button type |
| `react/checked-requires-onchange-or-readonly` | Require a checked input to define a change handler or be read-only |
| `react/forward-ref-uses-ref` | Check that a component using forwardRef receives the forwarded ref |
| `react/iframe-missing-sandbox` | Check iframe sandbox attributes for missing or unsafe configurations |
| `react/jsx-key` | Require keys on generated JSX children |
| `react/jsx-no-comment-textnodes` | Detect JSX comments rendered as visible text |
| `react/jsx-no-duplicate-props` | Reject duplicate JSX properties on an element |
| `react/jsx-no-script-url` | Reject JavaScript URLs in JSX links |
| `react/jsx-no-undef` | Reject undeclared JSX component references |
| `react/jsx-props-no-spread-multi` | Flag repeated spreads of the same object onto one element |
| `react/no-danger` | Flag direct insertion of raw HTML into a React element |
| `react/no-danger-with-children` | Reject elements specifying both injected HTML and React children |
| `react/no-direct-mutation-state` | Reject direct mutation of component state |
| `react/no-namespace` | Reject unsupported namespace syntax in React elements |
| `react/no-this-in-sfc` | Reject class-style instance access inside a function component |
| `react/no-unknown-property` | Check DOM property names used in JSX |
| `react/style-prop-object` | Check that JSX style properties receive objects |
| `react/void-dom-elements-no-children` | Reject children on HTML elements that cannot contain them |

### React Hooks and compiler diagnostics

| Rule | Check |
| --- | --- |
| `react-hooks/exhaustive-deps` | Check that Hook dependency lists reflect the values each Hook reads |
| `react-hooks/rules-of-hooks` | Check Hook call order and valid calling contexts |

## Additional fast source checks for this library

> **Status:** Planned. Same adoption path as the core set. The credential-disclosure and workflow supply-chain groups should land first.

### Code formatting

| Rule | Check |
| --- | --- |
| `prettier --check` | Require one literal tab per indentation level in new or modified source files (`useTabs: true`). Use spaces for YAML indentation. |

### Credential disclosure

| Rule | Check |
| --- | --- |
| `gitleaks/generic-api-key` | Detect credential-like values assigned to key-related fields |
| `gitleaks/github-app-token` | Detect exposed GitHub App installation credentials |
| `gitleaks/github-fine-grained-pat` | Detect exposed fine-grained GitHub personal tokens |
| `gitleaks/jwt` | Detect embedded JSON Web Tokens |
| `gitleaks/npm-access-token` | Detect committed npm registry publishing credentials |
| `gitleaks/private-key` | Detect committed private cryptographic keys |

### CSS correctness and compatibility

| Rule | Check |
| --- | --- |
| `stylelint/annotation-no-unknown` | Detect unrecognized CSS annotations |
| `stylelint/at-rule-no-unknown` | Detect unknown CSS at-rules |
| `stylelint/block-no-empty` | Reject CSS rule blocks with no declarations |
| `stylelint/color-no-invalid-hex` | Detect invalid hexadecimal colors |
| `stylelint/comment-no-empty` | Flag empty CSS comments |
| `stylelint/custom-property-no-missing-var-function` | Flag custom properties used as values without var() |
| `stylelint/declaration-block-no-duplicate-custom-properties` | Detect duplicate custom property declarations in one rule |
| `stylelint/declaration-block-no-duplicate-properties` | Detect repeated property declarations in a CSS block |
| `stylelint/declaration-block-no-shorthand-property-overrides` | Detect shorthand declarations that silently override earlier longhands |
| `stylelint/declaration-property-value-no-unknown` | Check CSS values against the grammar for their property |
| `stylelint/font-family-no-duplicate-names` | Detect repeated font names in a font-family list |
| `stylelint/function-calc-no-unspaced-operator` | Check whitespace around arithmetic operators in calc() |
| `stylelint/function-linear-gradient-no-nonstandard-direction` | Detect invalid linear-gradient directions |
| `stylelint/function-no-unknown` | Detect unknown CSS function names |
| `stylelint/keyframe-block-no-duplicate-selectors` | Detect duplicate selectors within a keyframes rule |
| `stylelint/keyframe-declaration-no-important` | Reject ineffective !important declarations inside keyframes |
| `stylelint/media-feature-name-no-unknown` | Detect unknown feature names in media queries |
| `stylelint/media-feature-name-value-no-unknown` | Detect invalid values in media feature queries |
| `stylelint/named-grid-areas-no-invalid` | Validate the rectangular layout of named grid areas |
| `stylelint/no-duplicate-at-import-rules` | Detect repeated stylesheet imports |
| `stylelint/no-duplicate-selectors` | Detect duplicate selectors in a stylesheet |
| `stylelint/no-empty-source` | Flag empty stylesheet sources |
| `stylelint/no-invalid-double-slash-comments` | Reject JavaScript-style line comments in ordinary CSS |
| `stylelint/no-invalid-position-at-import-rule` | Check that CSS imports precede rules where required |
| `stylelint/no-irregular-whitespace` | Detect unexpected invisible whitespace in CSS |
| `stylelint/property-no-unknown` | Detect unrecognized CSS properties |
| `stylelint/selector-pseudo-class-no-unknown` | Detect unknown CSS pseudo-classes |
| `stylelint/selector-pseudo-element-no-unknown` | Detect unknown CSS pseudo-elements |
| `stylelint/selector-type-no-unknown` | Detect unknown element selectors |
| `stylelint/shorthand-property-no-redundant-values` | Flag redundant values in shorthand declarations |
| `stylelint/string-no-newline` | Reject unescaped newlines in CSS string literals |
| `stylelint/unit-no-unknown` | Detect invalid CSS units |

### JavaScript correctness

| Rule | Check |
| --- | --- |
| `no-dupe-args` | Detect repeated parameter names |
| `no-octal` | Reject legacy octal number syntax |
| `no-octal-escape` | Reject legacy octal string escapes |

### JavaScript module contracts

| Rule | Check |
| --- | --- |
| `import/default` | Validate that default imports have corresponding default exports |
| `import/export` | Detect conflicting or invalid module export declarations |
| `import/named` | Validate that named imports exist on the referenced module |
| `import/namespace` | Check property names read from a module namespace |
| `import/no-duplicates` | Detect redundant imports resolving to the same module |
| `import/no-empty-named-blocks` | Flag empty named bindings in import declarations |
| `import/no-extraneous-dependencies` | Detect imports from dependencies absent from the importing package's declaration |
| `import/no-import-module-exports` | Detect ESM import syntax mixed with CommonJS module.exports |
| `import/no-mutable-exports` | Flag exported mutable bindings that callers cannot safely treat as stable |
| `import/no-named-as-default` | Flag a default import name that collides with a named export |
| `import/no-named-as-default-member` | Flag reads of named exports as properties of a default import |
| `import/no-self-import` | Flag modules importing themselves |
| `import/no-unresolved` | Check that statically imported modules can be resolved |

### Jest test correctness

| Rule | Check |
| --- | --- |
| `jest/no-alias-methods` | Flag obsolete aliases for Jest assertion matchers |

### Native API boundaries

| Rule | Check |
| --- | --- |
| `@react-native/no-deep-imports` | Flag React Native imports that depend on private package paths |
| `@react-native/platform-colors` | Validate the literal arguments used with native platform color APIs |

### Node.js and package runtime

| Rule | Check |
| --- | --- |
| `n/handle-callback-err` | Detect error-first callback parameters that are silently ignored |
| `n/hashbang` | Validate executable script shebangs for package bin entries |
| `n/no-callback-literal` | Flag non-error literals passed as callback errors |
| `n/no-deprecated-api` | Detect Node APIs marked deprecated in the configured runtime |
| `n/no-exports-assign` | Flag CommonJS exports bindings accidentally overwritten instead of module.exports |
| `n/no-missing-require` | Detect unresolved literal CommonJS require targets |
| `n/no-unpublished-bin` | Check that each declared package executable is included when published |
| `n/no-unpublished-import` | Detect ESM imports whose targets will be missing from the published package |
| `n/no-unpublished-require` | Detect CommonJS imports whose targets will be missing after publication |
| `n/no-unsupported-features/es-builtins` | Flag JavaScript built-ins unsupported by the declared Node version range |
| `n/no-unsupported-features/es-syntax` | Detect JavaScript syntax unsupported by the target Node release |
| `n/no-unsupported-features/node-builtins` | Detect Node-specific APIs unsupported by the declared engine range |

### Playwright test correctness

| Rule | Check |
| --- | --- |
| `playwright/missing-playwright-await` | Check that asynchronous browser actions and assertions are awaited |
| `playwright/no-commented-out-tests` | Detect browser tests left commented out |
| `playwright/no-conditional-expect` | Flag browser assertions that can be silently skipped by a branch |
| `playwright/no-duplicate-hooks` | Flag duplicate Playwright setup or teardown hooks in a suite |
| `playwright/no-duplicate-slow` | Flag repeated slow-test modifiers |
| `playwright/no-element-handle` | Flag ElementHandle use where rerendering may leave a stale reference |
| `playwright/no-eval` | Flag legacy selector-evaluation APIs in browser tests |
| `playwright/no-export` | Flag exports from browser test specification files |
| `playwright/no-focused-test` | Reject browser tests left in focused-only mode |
| `playwright/no-identical-title` | Detect repeated test titles in a browser suite |
| `playwright/no-page-pause` | Detect interactive debugger pauses left in browser tests |
| `playwright/no-skipped-test` | Detect browser tests marked to be skipped |
| `playwright/no-standalone-expect` | Flag browser assertions outside a test or an allowed callback |
| `playwright/no-unsafe-references` | Detect host variables referenced inside browser-evaluated callbacks |
| `playwright/no-unused-locators` | Detect browser locators created but never used |
| `playwright/no-useless-await` | Flag awaits on synchronous Playwright calls |
| `playwright/no-wait-for-navigation` | Flag deprecated browser navigation waits prone to races |
| `playwright/no-wait-for-selector` | Flag imperative selector waits in place of locator-based waiting |
| `playwright/no-wait-for-timeout` | Flag fixed sleeps used to synchronize browser tests |
| `playwright/prefer-to-have-count` | Use the retrying browser assertion for element counts |
| `playwright/prefer-web-first-assertions` | Use retrying browser assertions for live page state |
| `playwright/valid-describe-callback` | Check the shape of a Playwright suite-definition callback |
| `playwright/valid-expect` | Check browser assertions for invalid matcher chains or arguments |
| `playwright/valid-expect-in-promise` | Check that assertions inside promise chains are observed by browser tests |
| `playwright/valid-test-tags` | Validate the shape and syntax of Playwright test tags |

### Promise handling

| Rule | Check |
| --- | --- |
| `promise/always-return` | Check that each then-handler returns a value or throws when required |
| `promise/catch-or-return` | Detect promise chains that are neither returned nor rejection-handled |
| `promise/no-multiple-resolved` | Flag Promise executors that settle more than once on the same path |
| `promise/no-new-statics` | Reject new applied to a static Promise method |
| `promise/no-return-in-finally` | Flag finally callbacks whose returned values are ignored or mask prior outcomes |
| `promise/valid-params` | Validate Promise method argument counts |

### React and JSX correctness

| Rule | Check |
| --- | --- |
| `react/jsx-no-leaked-render` | Flag conditional JSX that may accidentally display a number or string |
| `react/no-invalid-html-attribute` | Check constrained HTML attribute values in JSX |

### Shell and Git hooks

| Rule | Check |
| --- | --- |
| `shellcheck/SC1008` | Identify the shell dialect used by executable hooks |
| `shellcheck/SC1010` | Separate the final loop command from its closing keyword |
| `shellcheck/SC1015` | Reject typographic quote characters used as shell quotes |
| `shellcheck/SC1020` | Separate test conditions from their closing bracket |
| `shellcheck/SC1046` | Reject shell conditionals without a closing fi |
| `shellcheck/SC1048` | Reject empty then clauses |
| `shellcheck/SC1066` | Reject dollar-prefixed variable names on the left of assignments |
| `shellcheck/SC1078` | Reject unterminated double-quoted strings |
| `shellcheck/SC1090` | Identify dynamically sourced scripts whose target cannot be analyzed |
| `shellcheck/SC1100` | Reject typographic dashes pasted into shell options |
| `shellcheck/SC1101` | Detect trailing whitespace after a line-continuation backslash |
| `shellcheck/SC1113` | Check the interpreter marker on executable shell scripts |
| `shellcheck/SC1128` | Place the interpreter declaration on the first line |
| `shellcheck/SC1143` | Reject attempted line continuations inside comments |
| `shellcheck/SC2031` | Detect values lost when a pipeline updates variables in a subshell |
| `shellcheck/SC2035` | Prevent filenames beginning with a dash from becoming command options |
| `shellcheck/SC2038` | Preserve unusual filenames when piping find results into another command |
| `shellcheck/SC2044` | Detect fragile loops over whitespace-split find output |
| `shellcheck/SC2045` | Detect fragile loops over ls output |
| `shellcheck/SC2048` | Preserve all original positional arguments when forwarding them |
| `shellcheck/SC2051` | Reject variable endpoints in Bash brace ranges |
| `shellcheck/SC2053` | Detect accidental pattern matching on the right of shell string equality |
| `shellcheck/SC2059` | Keep variable input out of printf format strings |
| `shellcheck/SC2064` | Check when a signal handler expands its variables |
| `shellcheck/SC2067` | Check the terminator of find -exec commands |
| `shellcheck/SC2068` | Preserve array element boundaries during shell expansion |
| `shellcheck/SC2070` | Check quoting of nonempty-string tests |
| `shellcheck/SC2071` | Use numeric comparison operators for arithmetic comparisons |
| `shellcheck/SC2072` | Reject decimal operands in integer-only shell arithmetic |
| `shellcheck/SC2076` | Detect regex operands accidentally quoted as literal strings |
| `shellcheck/SC2080` | Flag integer literals inadvertently interpreted as octal |
| `shellcheck/SC2086` | Detect unquoted variable expansions that split words or expand filenames |
| `shellcheck/SC2088` | Detect quoted tildes that cannot expand to a home directory |
| `shellcheck/SC2094` | Detect pipelines that overwrite a file while reading it |
| `shellcheck/SC2095` | Prevent ssh inside a read loop from consuming the loop input |
| `shellcheck/SC2114` | Flag shell commands that would delete a system directory |
| `shellcheck/SC2115` | Prevent empty path variables from expanding a deletion to the filesystem root |
| `shellcheck/SC2120` | Find functions that read arguments but are always called without arguments |
| `shellcheck/SC2124` | Detect array-to-scalar assignments that collapse argument boundaries |
| `shellcheck/SC2128` | Flag array expansion that reads only the first element |
| `shellcheck/SC2142` | Reject aliases that rely on positional arguments |
| `shellcheck/SC2144` | Detect file-existence tests incorrectly applied to a glob |
| `shellcheck/SC2145` | Detect an accidental concatenation of scalar text and an argument array |
| `shellcheck/SC2146` | Check grouping of find alternatives with actions |
| `shellcheck/SC2154` | Find reads of unassigned shell variables |
| `shellcheck/SC2155` | Detect declarations that hide a command's failure status |
| `shellcheck/SC2162` | Preserve backslashes when reading shell input |
| `shellcheck/SC2164` | Handle a failed directory change before running subsequent commands |
| `shellcheck/SC2165` | Detect nested loops that overwrite an outer loop index |
| `shellcheck/SC2168` | Reject local variable declarations outside functions |
| `shellcheck/SC2184` | Prevent filename expansion when unsetting indexed variables |
| `shellcheck/SC2195` | Detect case patterns that cannot match the tested word |
| `shellcheck/SC2213` | Check every accepted getopts flag has a handling branch |
| `shellcheck/SC2220` | Handle invalid flags in getopts |
| `shellcheck/SC2222` | Detect case branches made unreachable by earlier branches |
| `shellcheck/SC2223` | Quote value-initializing expansions that can expand arbitrary filenames |
| `shellcheck/SC2241` | Check the shell exit status is a single valid integer |
| `shellcheck/SC2251` | Detect negated commands that unexpectedly suppress error exit |
| `shellcheck/SC2260` | Detect output redirections that discard pipeline input for the next command |
| `shellcheck/SC2295` | Check quoting of shell pattern expansions within parameter substitution |
| `shellcheck/SC2310` | Detect conditional function calls that suppress errexit |
| `shellcheck/SC2311` | Detect command substitutions that suppress errexit inside a function |
| `shellcheck/SC2312` | Check for nested commands whose failure status is discarded |
| `shellcheck/SC2317` | Find unreachable shell commands |
| `shellcheck/SC2320` | Detect status checks that accidentally report the result of logging |
| `shellcheck/SC2324` | Detect attempted integer increments that append text |

### Test correctness (Jest)

| Rule | Check |
| --- | --- |
| `jest/expect-expect` | Detect test bodies with no recognized assertion call |
| `jest/no-commented-out-tests` | Find test cases silently disabled by comments |
| `jest/no-conditional-expect` | Detect assertions that a passing test can avoid by taking another branch |
| `jest/no-confusing-set-timeout` | Flag Jest timeout declarations placed where they have surprising scope |
| `jest/no-deprecated-functions` | Flag calls to retired Jest test APIs |
| `jest/no-disabled-tests` | Detect skipped or otherwise disabled Jest tests |
| `jest/no-done-callback` | Flag completion callbacks in tests intended to use promise-based completion |
| `jest/no-duplicate-hooks` | Detect repeated lifecycle hooks inside a test suite block |
| `jest/no-export` | Prevent test files from becoming importable application API |
| `jest/no-focused-tests` | Flag a focused test or suite that silently excludes its siblings |
| `jest/no-identical-title` | Detect tests or suites sharing a title at the same nesting level |
| `jest/no-interpolation-in-snapshots` | Reject computed text embedded into inline snapshots |
| `jest/no-jasmine-globals` | Flag Jasmine-only globals used in Jest tests |
| `jest/no-mocks-import` | Prevent tests from importing manual mock implementation folders directly |
| `jest/no-standalone-expect` | Detect assertions outside a test execution context |
| `jest/no-unneeded-async-expect-function` | Flag async wrappers that can distort exception assertions |
| `jest/no-untyped-mock-factory` | Require a module type when constructing an explicit Jest mock factory |
| `jest/valid-describe-callback` | Validate the shape and execution contract of suite callbacks |
| `jest/valid-expect` | Validate assertion arguments, matcher chains and async assertion handling |
| `jest/valid-expect-in-promise` | Detect promise-based assertions whose chain is neither returned nor awaited |
| `jest/valid-mock-module-path` | Detect mock declarations targeting modules that do not exist |
| `jest/valid-title` | Require valid string titles for Jest tests and suites |

### Test correctness (Vitest)

| Rule | Check |
| --- | --- |
| `vitest/hoisted-apis-on-top` | Identify Vitest hoisted APIs placed after non-hoisted setup |
| `vitest/no-conditional-tests` | Flag Vitest test declarations conditionally excluded at runtime |
| `vitest/no-import-node-test` | Prevent accidental use of Node's test adapter in Vitest suites |
| `vitest/require-awaited-expect-poll` | Require awaiting a Vitest polling assertion |
| `vitest/require-local-test-context-for-concurrent-snapshots` | Require the per-test assertion context for concurrent Vitest snapshots |

### Testing Library test correctness

| Rule | Check |
| --- | --- |
| `testing-library/await-async-events` | Await asynchronous user interactions in component tests |
| `testing-library/await-async-queries` | Wait for asynchronous element queries before using their results |
| `testing-library/await-async-utils` | Await asynchronous Testing Library utilities |
| `testing-library/no-await-sync-events` | Flag waits on synchronous test interactions |
| `testing-library/no-await-sync-queries` | Flag waits on synchronous element queries |
| `testing-library/no-debugging-utils` | Detect debugging calls left in component tests |
| `testing-library/no-dom-import` | Check that tests import from the correct framework-specific Testing Library entry |
| `testing-library/no-global-regexp-flag-in-query` | Flag stateful global regular expressions passed to element queries |
| `testing-library/no-manual-cleanup` | Flag redundant manual resets of the Testing Library environment |
| `testing-library/no-promise-in-fire-event` | Reject unresolved element promises passed into test events |
| `testing-library/no-wait-for-side-effects` | Flag interactions or renders inside callbacks that may run repeatedly |
| `testing-library/no-wait-for-snapshot` | Reject snapshots captured inside repeated polling callbacks |
| `testing-library/prefer-find-by` | Prefer the async element query for elements that appear later |

### TypeScript correctness

| Rule | Check |
| --- | --- |
| `@typescript-eslint/ban-ts-comment` | Require approved use of TypeScript diagnostic suppression comments |
| `@typescript-eslint/consistent-type-imports` | Identify imported symbols used exclusively at type level |
| `@typescript-eslint/no-confusing-non-null-assertion` | Flag non-null assertions easily confused with comparison operators |
| `@typescript-eslint/no-duplicate-enum-values` | Detect enum members sharing the same literal value |
| `@typescript-eslint/no-empty-object-type` | Flag empty object types that inadvertently accept nearly any value |
| `@typescript-eslint/no-extra-non-null-assertion` | Detect redundant consecutive non-null assertions |
| `@typescript-eslint/no-import-type-side-effects` | Prevent type-only named imports from accidentally executing a module |
| `@typescript-eslint/no-invalid-void-type` | Reject void annotations in positions that require an actual value type |
| `@typescript-eslint/no-misused-new` | Detect constructor signatures written as ordinary methods or vice versa |
| `@typescript-eslint/no-non-null-asserted-nullish-coalescing` | Flag a non-null assertion that contradicts an immediate nullish fallback |
| `@typescript-eslint/no-non-null-asserted-optional-chain` | Flag assertions that discard the undefined result of optional chaining |
| `@typescript-eslint/no-unnecessary-type-constraint` | Flag type-parameter constraints that impose no restriction |
| `@typescript-eslint/no-unsafe-declaration-merging` | Reject unsafe merging of class and interface declarations |
| `@typescript-eslint/no-unsafe-function-type` | Flag unrestricted Function types lacking an invocation contract |
| `@typescript-eslint/no-wrapper-object-types` | Reject boxed object types where primitive types are intended |

### Workflow configuration

| Rule | Check |
| --- | --- |
| `actionlint/action-metadata-syntax` | Validate metadata for local JavaScript, Docker and composite actions |
| `actionlint/check-action-format` | Check syntax of remote, container and local action references |
| `actionlint/check-comparison-types` | Flag comparisons between incompatible workflow expression types |
| `actionlint/check-contexts-and-builtin-func` | Check workflow context names and built-in function references |
| `actionlint/check-contextual-matrix-object` | Validate references to declared matrix dimensions |
| `actionlint/check-contextual-needs-object` | Validate references to dependency job outputs |
| `actionlint/check-contextual-step-object` | Validate references to outputs of named workflow steps |
| `actionlint/check-cron-syntax-and-timezone` | Check scheduled workflow cron expressions and timezones |
| `actionlint/check-empty-mapping` | Reject empty mappings where workflow configuration requires values |
| `actionlint/check-env-var-names` | Validate environment variable names in workflow definitions |
| `actionlint/check-glob-pattern` | Validate branch, tag and path filter glob syntax |
| `actionlint/check-hardcoded-credentials` | Detect literal credentials configured for job containers |
| `actionlint/check-job-deps` | Check the workflow job dependency graph for missing edges or cycles |
| `actionlint/check-job-step-ids` | Check uniqueness of workflow job and step identifiers |
| `actionlint/check-local-action-inputs` | Check supplied inputs against local action metadata |
| `actionlint/check-mapping-values` | Validate allowed values of workflow settings |
| `actionlint/check-matrix-values` | Check matrix include and exclude entries against declared dimensions |
| `actionlint/check-missing-required-duplicate-keys` | Validate required and unique keys in workflow definitions |
| `actionlint/check-popular-action-inputs` | Check supported third-party action inputs against known metadata |
| `actionlint/check-reusable-workflows` | Validate inputs, secrets and outputs against reusable workflow contracts |
| `actionlint/check-runner-labels` | Validate runner labels used by the workflow |
| `actionlint/check-shell-names` | Verify the shell selected by workflow steps |
| `actionlint/check-syntax-expression` | Parse expressions embedded in GitHub Actions workflows |
| `actionlint/check-type-check-expression` | Validate operand and function argument types in workflow expressions |
| `actionlint/check-unexpected-keys` | Reject unknown workflow configuration keys |
| `actionlint/check-webhook-events` | Validate workflow trigger names and their event filters |
| `actionlint/check-workflow-dispatch-events` | Check manual workflow input types, choices and defaults |
| `actionlint/ctx-spfunc-availability` | Check whether a context or special function is available at its point of use |
| `actionlint/deprecated-inputs-usage` | Flag inputs marked deprecated by action metadata |
| `actionlint/if-cond-constant` | Identify workflow conditions that cannot change the result |
| `actionlint/permissions` | Check spelling and supported values of GitHub token permission scopes |
| `actionlint/yaml-anchors` | Check permitted workflow YAML anchor and alias usage |

### Workflow supply-chain security

| Rule | Check |
| --- | --- |
| `zizmor/adhoc-packages` | Flag ad hoc package installation in workflow commands |
| `zizmor/archived-uses` | Identify workflow dependencies whose repositories are archived |
| `zizmor/artipacked` | Check checkout credential persistence and artifact exposure |
| `zizmor/bot-conditions` | Detect spoofable bot identity checks in workflow conditions |
| `zizmor/cache-poisoning` | Identify workflows where untrusted build caches can reach privileged jobs |
| `zizmor/concurrency-limits` | Check workflow concurrency controls to limit resource exhaustion |
| `zizmor/dangerous-checkout` | Detect checkout of untrusted revisions in privileged workflow contexts |
| `zizmor/dangerous-triggers` | Review privileged triggers that can process untrusted contributions |
| `zizmor/excessive-permissions` | Check workflow and job token permissions against least privilege |
| `zizmor/github-env` | Check untrusted values written to workflow environment files |
| `zizmor/insecure-commands` | Detect workflows opting into obsolete unsafe runner commands |
| `zizmor/insecure-url-scheme` | Flag insecure URL schemes in supported workflow references |
| `zizmor/overprovisioned-secrets` | Detect unnecessary secret exposure in workflow contexts |
| `zizmor/ref-version-mismatch` | Check action version comments match their pinned commits |
| `zizmor/secrets-inherit` | Review indiscriminate secret inheritance in reusable workflows |
| `zizmor/secrets-outside-env` | Identify secrets used in jobs without a dedicated GitHub environment |
| `zizmor/template-injection` | Detect untrusted expressions embedded directly in workflow scripts |
| `zizmor/unpinned-tools` | Check version pinning of tools installed by setup actions |
| `zizmor/unpinned-uses` | Check immutable pinning of third-party action references |
| `zizmor/unredacted-secrets` | Detect operations that can bypass GitHub log masking |
| `zizmor/unsound-contains` | Detect substring conditions mistaken for exact membership checks |
| `zizmor/unsound-ternary` | Detect conditional workflow expressions with a falsy middle value |

### YAML configuration

| Rule | Check |
| --- | --- |
| `yamllint/anchors` | Reject problematic anchors and aliases in general YAML |
| `yamllint/empty-values` | Detect implicit empty values where explicit nulls or values are required |
| `yamllint/float-values` | Check YAML for prohibited floating-point representations |
| `yamllint/indentation` | Validate indentation consistency in nested YAML configuration |
| `yamllint/key-duplicates` | Reject duplicate keys in non-workflow YAML configuration |
| `yamllint/octal-values` | Check for unintentionally octal values in YAML configuration |
| `yamllint/truthy` | Flag ambiguous boolean-like scalars interpreted differently by YAML parsers |

## Checks requiring types, a dependency graph, network data or a built package

> **Status:** Planned. Local qualification will check the packed tarballs with publint and attw, and run typed ESLint rules against the TypeScript project. The release signature check requires access to the dependency registry.

### Consumer module compatibility

| Rule | Check |
| --- | --- |
| `attw/CJSOnlyExportsDefault` | Check a CommonJS module does not wrap its only public value in a spurious default export |
| `attw/CJSResolvesToESM` | Detect CommonJS entry resolution to an ES-module-only implementation |
| `attw/FallbackCondition` | Detect type resolution that falls through intended export conditions |
| `attw/FalseCJS` | Detect CommonJS declarations describing an ES module implementation |
| `attw/FalseESM` | Detect ES module declarations describing a CommonJS implementation |
| `attw/FalseExportDefault` | Detect declarations promising a nonexistent default export |
| `attw/InternalResolutionError` | Detect unresolved imports inside distributed declaration files |
| `attw/MissingExportEquals` | Find CommonJS declarations missing an export assignment |
| `attw/NamedExports` | Check declared named exports can be loaded by Node.js |
| `attw/NoResolution` | Resolve every supported package entry from a consumer |
| `attw/UnexpectedModuleSyntax` | Detect source syntax incompatible with the selected module kind |
| `attw/UntypedResolution` | Check that a resolved JavaScript entry exposes type declarations |

### Dependency integrity

| Rule | Check |
| --- | --- |
| `npm/audit-signatures` | Verify supported dependency tarballs carry valid registry signatures |

### JavaScript module contracts

| Rule | Check |
| --- | --- |
| `import/no-cycle` | Detect cycles across runtime module imports |

### Package publication

| Rule | Check |
| --- | --- |
| `publint/BIN_FILE_NOT_EXECUTABLE` | Check package CLI entry files have a usable interpreter declaration |
| `publint/EXPORTS_DEFAULT_SHOULD_BE_LAST` | Place fallback exports after specific module conditions |
| `publint/EXPORTS_GLOB_NO_DEPRECATED_SUBPATH_MAPPING` | Reject deprecated trailing-slash export maps |
| `publint/EXPORTS_GLOB_NO_MATCHED_FILES` | Find exported subpath patterns that match no files |
| `publint/EXPORTS_MISSING_ROOT_ENTRYPOINT` | Detect missing root exports that shadow an advertised entry point |
| `publint/EXPORTS_MODULE_SHOULD_BE_ESM` | Require the module export condition to resolve to an ES module |
| `publint/EXPORTS_MODULE_SHOULD_PRECEDE_REQUIRE` | Put the module condition before require in export maps |
| `publint/EXPORTS_TYPES_INVALID_FORMAT` | Check declaration module format against the exported entry point |
| `publint/EXPORTS_TYPES_SHOULD_BE_FIRST` | Place type-resolution conditions before competing export conditions |
| `publint/EXPORTS_VALUE_CONFLICTS_WITH_BROWSER` | Identify conflicts between conditional exports and browser remapping |
| `publint/EXPORTS_VALUE_INVALID` | Validate relative paths in package export targets |
| `publint/FIELD_INVALID_VALUE_TYPE` | Validate package manifest field value types |
| `publint/FILE_DOES_NOT_EXIST` | Find package manifest references to nonexistent files |
| `publint/FILE_INVALID_JSX_EXTENSION` | Detect unsupported JSX module filename combinations |
| `publint/FILE_NOT_PUBLISHED` | Find manifest-referenced files excluded from the package archive |
| `publint/IMPLICIT_INDEX_JS_INVALID_FORMAT` | Validate the module format of implicit index entry points |
| `publint/IMPORTS_DEFAULT_SHOULD_BE_LAST` | Place default conditions last in private import maps |
| `publint/IMPORTS_GLOB_NO_MATCHED_FILES` | Find private import patterns that match no files |
| `publint/IMPORTS_KEY_INVALID` | Validate syntax of private package import keys |
| `publint/IMPORTS_VALUE_INVALID` | Validate internal package import targets |
| `publint/INVALID_REPOSITORY_VALUE` | Validate package repository metadata |
| `publint/LOCAL_DEPENDENCY` | Detect local-only dependencies in publishable package manifests |
| `publint/MODULE_SHOULD_BE_ESM` | Check the package-level module field points to an ES module |
| `publint/NESTED_PACKAGE_JSON_FIELD_IGNORED` | Find package fields ignored inside nested package manifests |
| `publint/TYPES_NOT_EXPORTED` | Check type declarations are reachable through the export map |
| `publint/USE_FILES` | Flag internal tests or configuration included in the published archive |
| `publint/USE_LICENSE` | Check package metadata identifies its published license |

### React Hooks and compiler diagnostics

| Rule | Check |
| --- | --- |
| `react-hooks/immutability` | Detect mutation of values React treats as immutable |
| `react-hooks/refs` | Flag unsafe reads or writes of refs during render |
| `react-hooks/set-state-in-render` | Flag unconditional state updates during rendering |

### Test correctness (Jest)

| Rule | Check |
| --- | --- |
| `jest/no-error-equal` | Flag comparisons that reduce Error equality to insufficient evidence |
| `jest/no-unnecessary-assertion` | Flag assertions whose expected outcome already follows from static types |
| `jest/valid-expect-with-promise` | Require promise matchers for promise-like assertions and reject them for plain values |

### TypeScript correctness

| Rule | Check |
| --- | --- |
| `@typescript-eslint/await-thenable` | Flag awaiting a value that cannot be awaited meaningfully |
| `@typescript-eslint/consistent-type-exports` | Check that type-only exports cannot introduce runtime imports |
| `@typescript-eslint/no-array-delete` | Reject deletion of array slots that silently creates holes |
| `@typescript-eslint/no-base-to-string` | Detect implicit stringification that produces an object's default tag |
| `@typescript-eslint/no-confusing-void-expression` | Flag void-returning expressions used where a value is expected |
| `@typescript-eslint/no-duplicate-type-constituents` | Detect repeated members of a union or intersection type |
| `@typescript-eslint/no-floating-promises` | Detect promises silently abandoned without awaiting or handling rejection |
| `@typescript-eslint/no-for-in-array` | Flag enumeration of array keys when code expects array values |
| `@typescript-eslint/no-misused-promises` | Flag promises supplied where synchronous conditions or callbacks are expected |
| `@typescript-eslint/no-misused-spread` | Detect spreading values whose runtime properties differ from the apparent intent |
| `@typescript-eslint/no-mixed-enums` | Flag enums mixing numeric and string values |
| `@typescript-eslint/no-redundant-type-constituents` | Detect union or intersection members fully absorbed by another member |
| `@typescript-eslint/no-unnecessary-condition` | Detect checked conditions that the inferred type makes constant |
| `@typescript-eslint/no-unnecessary-type-assertion` | Flag casts that leave the inferred expression type unchanged |
| `@typescript-eslint/no-unsafe-argument` | Report any-typed arguments passed into typed parameters |
| `@typescript-eslint/no-unsafe-assignment` | Report any-typed values assigned across a typed boundary |
| `@typescript-eslint/no-unsafe-call` | Report calls whose target has an unchecked any type |
| `@typescript-eslint/no-unsafe-enum-assignment` | Flag values assigned into an enum type outside its valid members |
| `@typescript-eslint/no-unsafe-enum-comparison` | Flag comparison between unrelated enum types or bare primitives |
| `@typescript-eslint/no-unsafe-member-access` | Flag member lookup on unchecked any-typed receivers |
| `@typescript-eslint/no-unsafe-return` | Report unchecked any-typed values escaping through a return |
| `@typescript-eslint/no-unsafe-unary-minus` | Flag unary negation on values that are neither numeric nor bigint |
| `@typescript-eslint/only-throw-error` | Flag throwing values that lack an Error contract |
| `@typescript-eslint/related-getter-setter-pairs` | Check that paired getter and setter declarations have compatible value types |
| `@typescript-eslint/require-array-sort-compare` | Detect sorting non-string arrays without an explicit comparator |
| `@typescript-eslint/restrict-plus-operands` | Detect addition between types that imply unexpected coercion |
| `@typescript-eslint/restrict-template-expressions` | Detect values interpolated without an approved string conversion |
| `@typescript-eslint/switch-exhaustiveness-check` | Detect missing cases in switches over finite typed values |
| `@typescript-eslint/unbound-method` | Detect methods detached from an instance when their receiver is required |
| `@typescript-eslint/use-unknown-in-catch-callback-variable` | Require unknown for unchecked promise rejection reasons |

### Workflow supply-chain security

| Rule | Check |
| --- | --- |
| `zizmor/impostor-commit` | Verify pinned actions use commits belonging to the named repository |
| `zizmor/known-vulnerable-actions` | Compare action references with known vulnerability advisories |
| `zizmor/ref-confusion` | Identify ambiguous references shared by tags and branches |
| `zizmor/stale-action-refs` | Detect hash-pinned actions that do not resolve to a corresponding release tag |

## Optional checks for matching files, conventions or tooling

> **Status:** Planned, lowest priority. Enable per group only when the matching files exist.

### CSS correctness and compatibility

| Rule | Check |
| --- | --- |
| `stylelint/color-named` | Enforce the configured rule for CSS named colors |
| `stylelint/custom-property-pattern` | Enforce the project's naming rules for CSS custom properties |
| `stylelint/declaration-no-important` | Flag declarations that override the cascade with !important |
| `stylelint/font-family-no-missing-generic-family-keyword` | Check that font stacks include a generic fallback |
| `stylelint/function-url-no-scheme-relative` | Flag scheme-relative resource URLs |
| `stylelint/function-url-scheme-disallowed-list` | Reject URL schemes prohibited by the stylesheet policy |
| `stylelint/no-descending-specificity` | Flag selector ordering that can hide lower-specificity rules |
| `stylelint/property-disallowed-list` | Restrict CSS properties that bypass the project's layout or styling conventions |
| `stylelint/selector-attribute-name-disallowed-list` | Flag prohibited attribute names in CSS selectors |
| `stylelint/selector-class-pattern` | Validate published CSS class names against the project pattern |
| `stylelint/selector-combinator-disallowed-list` | Restrict CSS combinators disallowed by the component styling policy |
| `stylelint/selector-max-id` | Check selectors against the configured ID specificity budget |
| `stylelint/selector-max-type` | Limit the count of element selectors in a compound selector |
| `stylelint/selector-max-universal` | Limit use of universal selectors in a selector |
| `stylelint/selector-no-qualifying-type` | Flag selectors unnecessarily coupling classes or attributes to an element type |
| `stylelint/selector-pseudo-class-disallowed-list` | Flag policy-restricted pseudo-classes such as unreviewed :has() selectors |
| `stylelint/time-min-milliseconds` | Check transition and animation durations against a configured minimum |
| `stylelint/unit-allowed-list` | Restrict CSS units to the project's supported unit set |

### JavaScript correctness

| Rule | Check |
| --- | --- |
| `block-scoped-var` | Flag var bindings used beyond their declaration block |
| `consistent-return` | Flag inconsistent return-value conventions across function paths |
| `default-case-last` | Require the default switch clause to follow explicit cases |
| `default-param-last` | Detect positional parameters made ambiguous by earlier defaults |
| `guard-for-in` | Require ownership filtering when iterating inherited enumerable keys |
| `no-await-in-loop` | Review serial awaits inside loops for unintended serialization |
| `no-caller` | Reject reliance on legacy caller and callee introspection |
| `no-console` | Restrict direct console calls in selected production modules |
| `no-implicit-globals` | Prevent script files from silently creating global bindings |
| `no-inner-declarations` | Flag declarations in nested blocks with ambiguous scope |
| `no-label-var` | Detect labels that collide with in-scope variable names |
| `no-multi-assign` | Flag chained assignments that obscure which bindings are updated |
| `no-new` | Flag standalone construction used exclusively for side effects |
| `no-param-reassign` | Flag unexpected mutation or reassignment of input parameters |
| `no-proto` | Reject direct access to legacy prototype mutators |
| `no-restricted-exports` | Block explicitly prohibited public export names |
| `no-restricted-globals` | Reject project-designated unsafe or ambiguous globals |
| `no-restricted-imports` | Reject configured imports that violate package policy |
| `no-restricted-properties` | Reject configured object APIs at prohibited call sites |
| `no-restricted-syntax` | Reject project-specific syntax patterns with a reviewed rule |
| `no-shadow` | Flag declarations that mask a binding in an outer scope |
| `no-use-before-define` | Flag use of bindings before their declarations |
| `no-useless-call` | Detect unnecessary explicit function-context invocation |
| `no-useless-constructor` | Flag a constructor that only replicates default construction |
| `radix` | Require explicit base selection for integer parsing |
| `require-atomic-updates` | Flag read-modify-write races across an await or yield |
| `require-unicode-regexp` | Require Unicode-aware regex matching in applicable source |
| `require-yield` | Flag generator functions that never yield |

### JavaScript module contracts

| Rule | Check |
| --- | --- |
| `import/no-absolute-path` | Reject absolute filesystem paths used as module specifiers |
| `import/no-amd` | Reject obsolete AMD module definitions in ESM source |
| `import/no-commonjs` | Restrict CommonJS syntax in directories committed to ESM |
| `import/no-dynamic-require` | Flag require calls whose dependency target cannot be statically resolved |
| `import/no-internal-modules` | Restrict deep imports into private package internals |
| `import/no-nodejs-modules` | Prevent web-only entry points from importing Node built-in modules |
| `import/no-relative-packages` | Flag relative imports traversing directly into another package |
| `import/no-relative-parent-imports` | Restrict parent-directory imports for designated module boundaries |
| `import/no-restricted-paths` | Enforce directory-specific import boundaries |
| `import/no-unassigned-import` | Restrict imports performed only for side effects |
| `import/no-useless-path-segments` | Detect redundant traversal segments in module specifiers |
| `import/no-webpack-loader-syntax` | Detect bundler-specific inline loader syntax in import paths |

### JavaScript module contracts (tool or project context required)

| Rule | Check |
| --- | --- |
| `import/no-unused-modules` | Detect modules with unused exports or missing exported entry points |

### JSX accessibility

| Rule | Check |
| --- | --- |
| `jsx-a11y/no-access-key` | Flag explicit access keys that can conflict with assistive technology |
| `jsx-a11y/no-autofocus` | Flag unsolicited automatic focus placement |
| `jsx-a11y/no-noninteractive-tabindex` | Flag noninteractive elements added to the tab sequence |
| `jsx-a11y/no-static-element-interactions` | Require appropriate semantics on interactive generic elements |
| `jsx-a11y/prefer-tag-over-role` | Prefer the native element for a supported semantic role |

### Native UI conventions

| Rule | Check |
| --- | --- |
| `react-native/no-inline-styles` | Flag literal inline styles in React Native views |

### Node.js and package runtime

| Rule | Check |
| --- | --- |
| `n/callback-return` | Detect callbacks that can be followed by unintended fall-through work |
| `n/file-extension-in-import` | Validate import extensions under the configured Node resolution strategy |
| `n/no-new-require` | Flag constructor calls applied directly to a require expression |
| `n/no-path-concat` | Flag filesystem paths assembled by concatenating directory globals |
| `n/no-process-env` | Restrict direct environment-variable access to approved configuration code |
| `n/no-process-exit` | Detect abrupt process termination outside approved CLI boundaries |
| `n/no-restricted-require` | Reject configured CommonJS imports across dependency boundaries |
| `n/no-sync` | Detect synchronous filesystem or other blocking Node calls in selected runtime paths |
| `n/no-top-level-await` | Flag top-level awaits in modules expected to load synchronously |
| `n/prefer-import/assert-strict` | Require strict assertions in Node assertion-based tests |

### Playwright test correctness

| Rule | Check |
| --- | --- |
| `playwright/no-action-timeout` | Flag test actions that override the shared action timeout |
| `playwright/no-conditional-in-test` | Flag conditional paths that make a browser test exercise different scenarios |
| `playwright/no-force-option` | Flag forced browser actions that bypass user-actionability checks |
| `playwright/no-get-by-title` | Flag title-based browser locators where the test policy forbids them |
| `playwright/no-magic-timeouts` | Flag hard-coded timeout values in Playwright calls |
| `playwright/no-networkidle` | Flag page readiness based on the absence of network traffic |
| `playwright/no-nth-methods` | Flag fragile positional browser locators |
| `playwright/no-raw-locators` | Flag direct selector strings where resilient locators are required |
| `playwright/no-test-return-statement` | Detect return statements at the top level of a browser test body |
| `playwright/require-annotation-reason` | Require a reason when annotating Playwright tests |
| `playwright/require-to-pass-timeout` | Require an explicit timeout when retrying a whole block of assertions |

### Promise handling

| Rule | Check |
| --- | --- |
| `promise/no-callback-in-promise` | Flag callback-style continuations inside promise chains |
| `promise/no-promise-in-callback` | Flag promise construction or use embedded in callback-style control flow |
| `promise/spec-only` | Restrict Promise APIs to methods in the language specification |

### React and JSX correctness

| Rule | Check |
| --- | --- |
| `react/jsx-no-constructed-context-values` | Flag context provider values recreated on each render |
| `react/jsx-no-target-blank` | Check new-window links for unsafe opener behavior |
| `react/jsx-no-useless-fragment` | Flag fragments that do not provide a useful grouping |
| `react/no-array-index-key` | Flag array indexes used as keys in rendered lists |
| `react/no-children-prop` | Flag children passed as a JSX attribute |
| `react/no-deprecated` | Detect uses of deprecated React APIs |
| `react/no-find-dom-node` | Flag calls to React's legacy DOM-node lookup |
| `react/no-object-type-as-default-prop` | Flag object-valued defaults recreated on every function-component invocation |
| `react/no-string-refs` | Flag legacy string refs |
| `react/no-unescaped-entities` | Detect unescaped characters that can indicate malformed JSX text |
| `react/no-unstable-nested-components` | Flag component definitions recreated inside another component |

### React Hooks and compiler diagnostics (tool or project context required)

| Rule | Check |
| --- | --- |
| `react-hooks/config` | Validate React Compiler configuration options |
| `react-hooks/error-boundaries` | Check that render errors are handled with React error boundaries |
| `react-hooks/gating` | Validate React Compiler gating configuration |
| `react-hooks/globals` | Flag writes to global values during component rendering |
| `react-hooks/incompatible-library` | Flag library calls incompatible with React Compiler memoization |
| `react-hooks/preserve-manual-memoization` | Check that compiler transformations preserve authored memoization |
| `react-hooks/purity` | Detect impure function calls during React rendering |
| `react-hooks/set-state-in-effect` | Flag synchronous state updates in effects that create avoidable render cycles |
| `react-hooks/static-components` | Check that React component identities remain stable across renders |
| `react-hooks/unsupported-syntax` | Flag syntax the React Compiler cannot safely handle |
| `react-hooks/use-memo` | Flag useMemo calls whose result is never returned by the callback |

### Stylesheet architecture

| Rule | Check |
| --- | --- |
| `@cloudscape-design/license-headers` | Check stylesheet headers against the required license notice |
| `@cloudscape-design/no-implicit-descendant` | Reject unreviewed implicit descendant selectors |
| `@cloudscape-design/z-index-value-constraint` | Check stacking order values against the design system's approved choices |
| `csstools/use-logical` | Require supported logical CSS properties and values for direction-aware layout |
| `plugin/no-unsupported-browser-features` | Detect CSS features unsupported by the configured browser targets |

### Test correctness (Jest)

| Rule | Check |
| --- | --- |
| `jest/no-conditional-in-test` | Flag branch-dependent test execution that can conceal missing scenarios |
| `jest/no-large-snapshots` | Flag snapshot fixtures exceeding the reviewed size threshold |
| `jest/no-restricted-jest-methods` | Prevent designated Jest APIs from bypassing test policy |
| `jest/no-restricted-matchers` | Restrict matchers with known project-specific pitfalls |
| `jest/prefer-expect-assertions` | Require assertion-count verification in selected asynchronous tests |
| `jest/prefer-strict-equal` | Detect equality assertions that ignore property presence or object types |
| `jest/require-to-throw-message` | Require an expected exception message or pattern for rejection tests |

### Test correctness (Vitest)

| Rule | Check |
| --- | --- |
| `vitest/prefer-import-in-mock` | Use a type-checkable dynamic module reference when mocking with Vitest |
| `vitest/require-mock-type-parameters` | Require explicit type parameters on Vitest mocks covered by the rule |
| `vitest/require-test-timeout` | Require an explicit timeout for tests matching the Vitest timeout policy |

### Testing Library test correctness

| Rule | Check |
| --- | --- |
| `testing-library/no-container` | Flag queries against the raw test container |
| `testing-library/no-node-access` | Flag direct DOM traversal that bypasses user-facing queries |
| `testing-library/no-render-in-lifecycle` | Flag component rendering hidden inside test setup hooks |
| `testing-library/no-test-id-queries` | Flag test-ID queries where project policy requires semantic queries |
| `testing-library/no-unnecessary-act` | Flag redundant act wrappers around Testing Library interactions |
| `testing-library/no-wait-for-multiple-assertions` | Flag unrelated assertions bundled inside one polling callback |
| `testing-library/prefer-query-by-disappearance` | Use a nonthrowing query for assertions about disappeared elements |
| `testing-library/prefer-user-event` | Prefer realistic user interactions over low-level event dispatch in component tests |
| `testing-library/prefer-user-event-setup` | Require user-event interactions through a configured user session |

### TypeScript correctness

| Rule | Check |
| --- | --- |
| `@typescript-eslint/explicit-module-boundary-types` | Require explicit parameter and return types at exported boundaries |
| `@typescript-eslint/no-dynamic-delete` | Flag dynamic property deletion in typed object code |
| `@typescript-eslint/no-explicit-any` | Flag explicit removal of type checking through any annotations |
| `@typescript-eslint/no-non-null-assertion` | Flag assumptions of non-null values lacking a runtime or type guard |
| `@typescript-eslint/no-require-imports` | Restrict CommonJS require imports in TypeScript modules targeting ESM |
| `@typescript-eslint/no-restricted-types` | Reject explicitly prohibited type names in selected public APIs |
| `@typescript-eslint/no-unnecessary-parameter-property-assignment` | Detect constructor assignments duplicating parameter-property initialization |
| `@typescript-eslint/no-useless-empty-export` | Flag empty exports from files that are already modules |

### TypeScript correctness (tool or project context required)

| Rule | Check |
| --- | --- |
| `@typescript-eslint/no-deprecated` | Flag uses of APIs explicitly marked deprecated by their type declarations |
| `@typescript-eslint/no-generated-empty-object-type` | Detect type operations that resolve unintentionally to the empty object type |
| `@typescript-eslint/no-meaningless-void-operator` | Flag void applied to an expression already yielding void or undefined |
| `@typescript-eslint/no-unnecessary-qualifier` | Flag redundant namespace or enum qualification |
| `@typescript-eslint/no-unnecessary-template-expression` | Detect redundant interpolations in template expressions and types |
| `@typescript-eslint/no-unnecessary-type-arguments` | Detect explicit generic arguments equal to their defaults |
| `@typescript-eslint/no-unnecessary-type-conversion` | Flag conversions that produce the input's existing type and value |
| `@typescript-eslint/no-unnecessary-type-parameters` | Detect generic parameters that do not express a useful type relation |
| `@typescript-eslint/no-unsafe-class-instance-assignment` | Detect non-instance values assigned to a class-instance type |
| `@typescript-eslint/no-unsafe-type-assertion` | Flag narrowing type assertions without supporting evidence |
| `@typescript-eslint/no-useless-default-assignment` | Flag default assignments that cannot change the resulting value |
| `@typescript-eslint/prefer-nullish-coalescing` | Flag fallback expressions that may discard valid falsy values |
| `@typescript-eslint/prefer-readonly` | Identify private members never modified after construction |
| `@typescript-eslint/promise-function-async` | Require async declarations on functions whose returns are promises |
| `@typescript-eslint/return-await` | Enforce awaiting returned promises where local error handling depends on it |
| `@typescript-eslint/strict-boolean-expressions` | Detect ambiguous implicit truthiness checks for configured types |
| `@typescript-eslint/strict-void-return` | Flag value-returning function usage where a void-only contract is required |

### UI focus, events and browser compatibility

| Rule | Check |
| --- | --- |
| `rsp-rules/add-event-non-composing` | Require propagation-aware targets in addEvent registrations for non-composed events |
| `rsp-rules/no-non-composing-event-listener` | Flag direct addEventListener registrations for events that do not cross shadow boundaries |
| `rsp-rules/no-non-shadow-contains` | Require shadow-aware containment checks |
| `rsp-rules/no-package-root-imports` | Flag imports through a prohibited package root |
| `rsp-rules/safe-event-target` | Require the shadow-safe helper when reading an event target |
| `rsp-rules/shadow-safe-active-element` | Require a shadow-aware lookup for the focused element |
| `rsp-rules/shadow-safe-parent-element` | Require shadow-aware traversal when reading an element's parent |
| `rsp-rules/shadow-safe-parent-node` | Require shadow-aware traversal when reading a node's parent |
| `rsp-rules/use-layout-effect-rule` | Require the project's server-compatible layout-effect helper |

### Workflow supply-chain security

| Rule | Check |
| --- | --- |
| `zizmor/anonymous-definition` | Name workflows and action definitions |
| `zizmor/dependabot-cooldown` | Check the configured waiting period for Dependabot updates |
| `zizmor/dependabot-execution` | Identify Dependabot update configurations that execute external code |
| `zizmor/forbidden-uses` | Enforce organization policy on permitted external actions |
| `zizmor/self-hosted-runner` | Review workflow access to self-hosted runners |
| `zizmor/typosquat-uses` | Flag action repository names that resemble known actions |
| `zizmor/undocumented-permissions` | Require rationale for elevated workflow permissions |
| `zizmor/unpinned-images` | Detect container references without a fixed tag or digest |
| `zizmor/use-trusted-publishing` | Detect supported release workflows using credentials in place of trusted publishing |

## Release and scheduled checks

> **Status:** Planned. The inventory calls for weekly repository governance checks and SLSA verification for each published release. Scheduled non-release checks belong to Phase 8. Publication evidence belongs to the release stage.

### Release and repository governance

| Rule | Check |
| --- | --- |
| `scorecard/Binary-Artifacts` | Review binary artifacts committed to the source repository |
| `scorecard/Branch-Protection` | Verify protected release branches enforce their configured controls |
| `scorecard/CI-Tests` | Check proposed changes have automated test evidence before acceptance |
| `scorecard/Code-Review` | Check proposed changes receive independent code review |
| `scorecard/Dependency-Update-Tool` | Verify an automated dependency update process is configured |
| `scorecard/Fuzzing` | Check the project exercises a maintained fuzz-testing integration |
| `scorecard/License` | Verify the source repository declares a license |
| `scorecard/Packaging` | Check releases are published through an automated publishing workflow |
| `scorecard/SAST` | Verify automated static security analysis covers the project |
| `scorecard/SBOM` | Check for a published machine-readable inventory of release components |
| `scorecard/Security-Policy` | Publish a vulnerability reporting channel and supported security policy |
| `scorecard/Signed-Releases` | Verify release artifacts carry verifiable signatures or provenance |
| `scorecard/Vulnerabilities` | Check project versions against published vulnerability data |
| `scorecard/Webhooks` | Verify repository webhook endpoints use authentication tokens |

### Release provenance

| Rule | Check |
| --- | --- |
| `slsa/build-type` | Compare the attested build type with the release policy |
| `slsa/builder-identity` | Check build provenance names an approved builder identity |
| `slsa/external-parameters` | Validate external build inputs against the allowed provenance expectations |
| `slsa/provenance-signature` | Verify the build provenance envelope signature against trusted keys |
| `slsa/subject-digest` | Match the provenance subject digest to the release artifact bytes |

## Appendix: checks for other technology stacks

> Not applicable to a UI library and excluded from the totals above. Kept for reference if the repository ever gains containers, migrations, HTTP or protobuf contracts.

### Container image definitions

| Rule | Check |
| --- | --- |
| `docker-build/CopyIgnoredFile` | Check copy instructions do not reference excluded build inputs |
| `docker-build/DuplicateStageName` | Require each Docker build stage to have a unique name |
| `docker-build/ExposeInvalidFormat` | Reject host-specific port mappings in image metadata |
| `docker-build/FromPlatformFlagConstDisallowed` | Flag constant platform selection that prevents portable builds |
| `docker-build/InvalidDefaultArgInFrom` | Check that default build arguments yield a valid base image |
| `docker-build/JSONArgsRecommended` | Check entrypoint invocation uses the intended signal-handling form |
| `docker-build/MultipleInstructionsDisallowed` | Detect stage directives silently overridden by a later occurrence |
| `docker-build/NoEmptyContinuation` | Reject empty continuation lines in Dockerfiles |
| `docker-build/ReservedStageName` | Reject reserved names for Docker build stages |
| `docker-build/SecretsUsedInArgOrEnv` | Prevent sensitive data being set in image build arguments or environment directives |
| `docker-build/UndefinedArgInFrom` | Reject undeclared build arguments in base image references |
| `docker-build/UndefinedVar` | Detect undefined variables in Dockerfiles |
| `docker-build/WorkdirRelativePath` | Detect relative working directories that depend on the base image |

### Database migrations

| Rule | Check |
| --- | --- |
| `Migration/AddConcurrentIndex` | Define forward and reverse migrations when adding an index concurrently |
| `Migration/BatchedMigrationBaseClass` | Use an approved base class for batched background migrations |
| `Migration/ComplexIndexesRequireName` | Require explicit names for indexes with custom options |
| `Migration/MigrationWithMilestone` | Record the release milestone on supported migration classes |
| `Migration/PreventFeatureFlagsUsage` | Reject direct application feature-flag lookups in database migrations |
| `Migration/UpdateColumnInBatches` | Require a migration test for batched column updates |
| `Migration/WithLockRetriesDisallowedMethod` | Restrict operations placed inside a database lock-retry block |
| `Migration/WithLockRetriesWithChange` | Keep lock retries out of automatically reversible change methods |

### Deployment configuration

| Rule | Check |
| --- | --- |
| `k8s-pod-security/apparmor` | Reject unsupported AppArmor profiles for pod containers |
| `k8s-pod-security/capabilities` | Require restricted Linux containers to drop ALL capabilities before approved additions |
| `k8s-pod-security/host-namespaces` | Disallow host network, PID and IPC namespace sharing under baseline policy |
| `k8s-pod-security/host-ports` | Restrict pod ports mapped directly onto the host |
| `k8s-pod-security/hostpath-volumes` | Disallow hostPath volumes under baseline policy |
| `k8s-pod-security/hostprocess` | Reject Windows pods requesting access to the host process namespace |
| `k8s-pod-security/privilege-escalation` | Disallow privilege escalation for restricted Linux containers |
| `k8s-pod-security/privileged-containers` | Reject privileged container security contexts |
| `k8s-pod-security/proc-mount` | Require the default mask for proc filesystem mounts under baseline policy |
| `k8s-pod-security/running-as-non-root` | Require restricted pods to run under a non-root identity |
| `k8s-pod-security/running-as-non-root-user` | Reject explicitly setting user ID zero in restricted pods |
| `k8s-pod-security/seccomp` | Require an approved seccomp profile for restricted Linux containers |
| `k8s-pod-security/selinux` | Restrict SELinux types and custom users or roles in pod definitions |
| `k8s-pod-security/sysctls` | Check requested kernel settings against permitted safe sysctls |
| `k8s-pod-security/volume-types` | Restrict volume types to the Kubernetes restricted-policy allowlist |

### HTTP API contracts

| Rule | Check |
| --- | --- |
| `spectral-oas/duplicated-entry-in-enum` | Detect duplicate values in schema enumerations |
| `spectral-oas/no-eval-in-markdown` | Check API documentation fields for embedded eval calls |
| `spectral-oas/no-script-tags-in-markdown` | Check API documentation text for script tags |
| `spectral-oas/oas3-callbacks-in-callbacks` | Detect nested OpenAPI callback definitions |
| `spectral-oas/oas3-examples-value-or-externalValue` | Prevent conflicting inline and external examples |
| `spectral-oas/oas3-operation-security-defined` | Check operation security references resolve to defined schemes |
| `spectral-oas/oas3-schema` | Validate an OpenAPI 3 document against its specification |
| `spectral-oas/oas3-server-variables` | Validate all variables in OpenAPI server URL templates |
| `spectral-oas/oas3-unused-component` | Identify unreferenced OpenAPI component definitions |
| `spectral-oas/oas3-valid-schema-example` | Validate sample payloads against API schemas |
| `spectral-oas/operation-operationId-unique` | Check every API operation identifier is unique |
| `spectral-oas/operation-parameters` | Detect duplicate parameter definitions in API operations |
| `spectral-oas/operation-success-response` | Require a successful response on each documented API operation |
| `spectral-oas/operation-tag-defined` | Check operation tags resolve to documented global tags |
| `spectral-oas/path-declarations-must-exist` | Reject empty API path parameter placeholders |
| `spectral-oas/path-keys-no-trailing-slash` | Check declared API paths for trailing slashes |
| `spectral-oas/path-not-include-query` | Keep query strings out of API path definitions |
| `spectral-oas/path-params` | Check path parameters are declared and match their templates |
| `spectral-oas/typed-enum` | Validate enum values against their declared data type |

### Native source and localization

| Rule | Check |
| --- | --- |
| `android-lint/DesignSystem` | Detect Compose Material calls that bypass the approved design-system component |
| `android-lint/TestMethodFormat` | Validate Kotlin scenario names against the declared test naming convention |
| `android-lint/TestMethodPrefix` | Flag redundant test prefixes on Kotlin test method names |
| `swiftlint/discarded_notification_center_observer` | Flag discarded observer tokens when registering for iOS notifications |
| `swiftlint/empty_count` | Flag collection counts compared to zero where isEmpty is appropriate |
| `swiftlint/empty_enum_arguments` | Flag unused empty argument lists in Swift enum cases |
| `swiftlint/full_range_attributed_string_attribute` | Flag manually constructed whole-string ranges when applying attributed text styling |
| `swiftlint/function_body_length` | Check Swift function size against the project limit |
| `swiftlint/inverse_text_alignment` | Check deliberate right-aligned text for right-to-left layout handling |
| `swiftlint/localization_comment` | Require translation context on localized Swift strings |
| `swiftlint/natural_content_alignment` | Flag fixed left or right horizontal alignment in UIKit controls |
| `swiftlint/natural_text_alignment` | Flag left-aligned UIKit text that should follow the reading direction |
| `swiftlint/non_optional_string_data_conversion` | Prefer the nonoptional byte conversion for UTF-8 Swift strings |
| `swiftlint/string_interpolation_in_localized_string` | Prevent runtime values from being interpolated into translation lookup keys |
| `swiftlint/swiftui_localization` | Detect localized-string APIs unsupported by the Swift translation extraction pipeline |
| `swiftlint/weak_delegate` | Require delegate references to use weak ownership where applicable |

### Protocol buffer API contracts

| Rule | Check |
| --- | --- |
| `core::0131::http-body` | Reject request bodies on standard Get operations |
| `core::0131::http-method` | Bind Get operations to HTTP GET |
| `core::0131::http-uri-name` | Bind the resource name to the Get URI template |
| `core::0131::response-message-name` | Return the resource type declared for a Get operation |
| `core::0135::force-field` | Require a boolean force option when deleting resources with child resources |
| `core::0154::no-duplicate-etag` | Reject a second etag when the request already carries a resource with its own etag |
| `core::0155::request-id-format` | Annotate request identifiers with the required UUID4 format |
| `core::0158::request-page-size-field` | Provide a page-size field on paginated requests |
| `core::0158::request-page-token-field` | Provide a continuation-token field on paginated requests |
| `core::0158::response-next-page-token-field` | Provide the next-page token on paginated responses |
| `core::0158::response-unary` | Return a single response per paginated request |

### Stylesheet architecture

| Rule | Check |
| --- | --- |
| `@cloudscape-design/no-motion-outside-of-mixin` | Require motion declarations to use the shared motion abstraction |
| `material/cross-package-import-validation` | Validate stylesheet imports across Angular package boundaries |
| `material/no-import` | Reject Sass imports that bypass the project's module convention |
| `material/no-nested-mixin` | Flag Sass mixin declarations nested inside other constructs |
| `material/no-unused-import` | Detect unused stylesheet dependencies |
| `material/selector-no-deep` | Reject Angular deep selectors that pierce component styling boundaries |
