# Packed web release qualification

## Install from tarballs

Verify the release checksums. Install the matching tokens and renderer archives in one command. Commit the archives and the resulting lockfile with the consuming application.

For an application that uses only local archives, put this line in its project `.npmrc`. A missing scoped archive will fail the install.

```ini
@ui-lazy-dev:registry=https://registry.invalid/
```

```sh
npm install --save-exact ./vendor/ui-lazy-dev-tokens-0.3.0-rc.1.tgz ./vendor/ui-lazy-dev-ui-web-0.3.0-rc.1.tgz
```

Use the native renderer archive in place of the web archive for a React Native app. A team that hosts the packages in a private registry should set the scope URL to that registry.

## Supported and exercised versions

| Consumer | Lower tested endpoint | Upper tested endpoint |
| --- | --- | --- |
| React and React DOM, installed as a matching pair | 19.0.0 | 19.3.1 |
| Next.js App Router production build, server response and browser hydration | 16.4.5 with React 19.0.0 | 16.4.6 with React 19.3.1 |
| Release tooling | Node 22.23.2, npm 10.9.8 | Same |
| Real browser in packed consumer | Chromium supplied by Playwright 1.64.1 | Same |

The package declares React 19 peers. Repeat endpoint builds when versions move. The separate catalog browser suite exercises Chromium, Firefox and WebKit. Physical iOS/Android devices, their assistive technologies and arbitrary React/Next version combinations require separate qualification.

## Local release check

```sh
npm ci
npx playwright install chromium
node --test tests/packaging/*.test.mjs
node scripts/verify-artifacts.mjs
node scripts/verify-consumers.mjs
```

The first script uses two independent clean build output trees and the installed locked toolchain. It checks exported paths and executable entry points in all six packed archives and requires byte-identical SHA-256 digests. Its provenance record includes revision, tree, dirty status, lockfile digest and tool versions. Use a clean revision for a release. For each endpoint, the second script creates a consumer outside the workspace and installs the official 0.2.0 pair, the candidate, then 0.2.0 again. Each phase updates the lock, executes a clean install, checks actual module resolution, server-renders a real form and exercises Chromium hydration, an input edit and modal focus restoration. Both candidate endpoints also build and start Next.js. The upper endpoint measures each public web import.

The release workflow uploads `release/evidence/` with archive digests, the endpoint reports, bundle measurements and a CycloneDX SBOM with an associated license inventory per endpoint. This inventory covers the web consumer's production dependency graph including React peers. The gate requires package identity, source archive digest and reviewed license identifiers. Current third-party identifiers are MIT, Apache-2.0 and 0BSD. The two private library packages are classified as private first-party. Native, build-tool and host-framework dependency inventories are outside this web runtime inventory.

## Transfer budgets

The checked-in byte baselines measure browser ESM and CSS with esbuild, ES2022, production conditions, minification, tree shaking, gzip level 9 and Brotli quality 9. React and React DOM are host peers, so the bundle measurements exclude them. Transitive widget code is included. Sizes for an entire imported family and a single named component are separate rows. Full CSS includes any imported styles. The suite fails when a public subpath lacks a measured scenario, the core pulls optional widgets, or gzip growth exceeds 10% or 48 bytes, whichever allowance is larger. Baseline updates require reviewing the measured delta and its effect on consumer journeys.

The first candidate measured 514 B gzip for the full default web entry, 263 B for Button, 1,929 B for DataTable and 305 B for AppShell. Importing every form control together costs substantially more than using a named widget import. The complete per-entry reference is versioned in [the bundle baseline](../tests/packaging/bundle-baseline.json). Elevate maintains a separate compressed route-transfer and repeat-preview gate. Actual LCP, INP and CLS require field observations by release and device.

## Migrating 0.2.0 to 0.3.0-rc.1

Install matching token and renderer archives together. The default Button, FormField, AdaptiveGrid and Dialog retain their previous imports. Import new families by documented public subpath, including the associated optional CSS when the host needs its styles. Keep existing form submission, request deduplication, focus return and local draft persistence under the consumer's control. Verify both flag states, then restore the previous web and token tarball pair and lockfile for a package rollback. Existing 0.2.0 classes and token types are checked against its archive. Changes to CSS treatment still require visual review.

The five-archive release now includes two developer-policy packages. Run `node scripts/verify-version.mjs`, `node scripts/verify-inventory.mjs` and `node scripts/verify-native-consumer.mjs` after producing candidate archives. The combined inventory covers runtime and policy packages plus their required peers. The native fixture bundles both iOS and Android against the lower declared React 19.3.0/RN 0.88.0 and upper tested React 19.3.1/RN 0.88.1 pair. Metro source maps confirm all three native components and token modules came from installed packages. Device behavior requires physical-device reports.

The combined native, web and policy consumer resolves third-party data and tool licenses in addition to the web-only inventory. The validator records scoped identifiers for caniuse-lite (CC-BY-4.0), mdn-data (CC0-1.0), graceful-fs (BlueOak-1.0.0), fb-dotslash (MIT or Apache-2.0) and type-fest (MIT or CC0-1.0). Retain upstream notices, including caniuse-lite's attribution, when redistributing the affected datasets. The gate rejects these identifiers on an unreviewed package.

Color controls ship through a new opt-in subpath. The first measured reference is 78,181 B gzip for the family and 15,779 B for ColorPicker. These are new candidate ceilings for independent review. The opt-in Avatar import measures 472 B gzip, while the entire layout primitives entry shrank to 712 B. Existing import ceilings are preserved.
