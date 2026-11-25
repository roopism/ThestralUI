# @ui-lazy-dev

Mobile-first UI for web, iOS and Android. Elevate adoption is paused while the library is qualified. See the [frozen library goal](docs/frozen-goal.md), the [enterprise completion checklist](docs/enterprise-checklist.md) for current progress, the [roadmap](docs/system-roadmap.md) for delivery order and the [catalog](https://ui.lazy-dev.site) for working examples.

## Packages

- **@ui-lazy-dev/tokens** ships the versioned token source, generated CSS variables and typed JavaScript values. Colors resolve to sRGB hex and sizes are unitless numbers in JavaScript and pixels in CSS. A scoped theme can override the defaults with `data-uld-theme="dark"`.
- **@ui-lazy-dev/ui-web** exports Button, FormField and AdaptiveGrid from its root. AdaptiveGrid uses the available container width. Pass `motion="press"` to opt into reduced-motion-aware button feedback. Import Dialog from `@ui-lazy-dev/ui-web/dialog` for its dedicated client boundary. Components forward native form behavior. Default submit buttons must declare `type="submit"`. An app can import `@ui-lazy-dev/ui-web/styles.css` for the default skin or use its own brand styles.
- **@ui-lazy-dev/ui-native** exports experimental Button, IconButton, FormField and Dialog controls for React Native 0.88. The packed gallery exercises all four controls on an iPhone Simulator. Physical-device and screen-reader qualification remain open.
- **@ui-lazy-dev/policy** checks ownership of interactive controls and dependencies between layers. **@ui-lazy-dev/style-policy** checks semantic tokens and selector scope. Both can be installed as development dependencies.

FormField accepts one native input, select or textarea. It owns label, hint and error IDs, preserves caller-provided descriptions, and announces field errors. Dialog is mounted by its owner. Give its heading a unique ID, pass that ID as `labelledBy`, and dismiss from `onDismiss`. Its owner supplies actions, localized text and its initial focus target.

## Enterprise candidate

The `feat/enterprise-ui` branch builds the candidate locally. The web package provides opt-in subpaths for form controls, navigation, collections, expressive motion, document workflows, color controls and avatars. [Component inventory](docs/component-inventory.md) · [Automated checks and simulator qualification](docs/enterprise-acceptance.md)

## Develop and verify

Run `nvm install` and `nvm use` in the repository root to select Node 22.23.2. The tested npm version is 10.9.8. Install dependencies with `npm ci`. Run `npm run catalog` for the local workbench. For release verification run `npm run build`, `npm run typecheck`, `npm test`, `npm run test:native`, `npx playwright install chromium firefox webkit`, `npm run test:browser` and `npm run pack:release`. CI exercises the built catalog in all three engines.

MAIN integrates on `feat/enterprise-ui`. Workers use independent worktrees, assigned port blocks and gated commits. The contribution guide covers worktree setup, file ownership, the simulator and integration. [Contribution guide](CONTRIBUTING.md)

## Install a release

The GitHub repo is private. Release tarballs and SHA-256 checksums are built by `npm run pack:release` in `release/`. Download the archives and checksum manifest from the tagged GitHub release. Verify with `shasum -a 256 -c SHA256SUMS`. Install the tokens tarball and the renderer tarball together. Set `@ui-lazy-dev:registry=` in the consuming project’s `.npmrc` to its private registry before installing. For tarball-only installs, use an unreachable registry for this scope so a missing archive fails. The Elevate integration commits its pinned tarballs and lockfile so builds need neither registry credentials nor a connection to the catalog. Web consumers provide React and React DOM. Native consumers provide React and React Native. [Consumer installation example](docs/compatibility-web.md#install-from-tarballs)

Elevate’s first pushed pilot pins v0.1.0. Its local integration at `3fb2cc0` pins v0.2.0. This release adds an adaptive grid, opt-in press motion, an editorial shortlist example and the first experimental native renderer. private archive release v0.2.0 · [Shortlist example](https://ui.lazy-dev.site/?path=/story/patterns-opportunityshortlist--adaptive)
