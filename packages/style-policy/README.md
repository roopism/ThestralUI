# Style policy

Install the version that matches your release candidate as a development dependency. The CLI checks a working tree against the policy and exception ledger shipped inside the package. It writes no changes to the source tree.

```sh
ui-style-policy --profile elevate --root . --prove
node packages/style-policy/cli.mjs --profile library --root . --prove
node --test packages/style-policy/test/*.test.mjs
```

The library profile scans web, native and catalog sources. The Elevate profile scans app, component and public asset sources. Both require their named adoption targets to exist. The canary copies these sources into a temporary project, adds an unapproved radius to the real split-pane workflow or admin screen and requires exactly one actionable diagnostic. The temporary project is then removed.

The policy parses CSS selectors and values, JSX and TypeScript expressions, React Native style objects, and XML SVG attributes. Each selector branch needs a locally owned anchor. A sibling combinator after a scoped root needs a new anchor when its target could fall outside the component. Semantic variable references come from the token manifest and parsed CSS declarations. Literal color, spacing, typography, focus, radius, elevation and motion values in declarations and inline styles generate diagnostics.

Direct imports of the token object support aliases. Identifier-backed styles, object spreads, conditional branches, React Native StyleSheet definitions and inline stylesheets are inspected. Opaque expressions, dynamically measured dimensions and forwarded style objects require a reviewed runtime entry. Safe-area environment variables, inherited or system colors, zero and full-size layout constraints are supported. Complex CSS construction or new renderer syntax needs a contract test when it becomes part of the supported authoring API.

The token validator checks the package's four supported types, alias targets, alias type agreement, cycles and matching light/dark theme role sets. The library's separate generation check covers byte-for-byte CSS, JavaScript and TypeScript outputs. The token source uses the typed group and value notation in the [Design Tokens Format Module](https://www.designtokens.org/tr/2025.10/format/).

## Exceptions

Each record has the owning team, a reason, an expiry date and an exact inventory. Each inventory row stores a SHA-256 identity, rule, permitted count and a human-readable excerpt. The identity includes the relative filename, owning selector or component, property and exact expression. Changes to an expression require a new review. Duplicate occurrences consume separate allowances. Expired, malformed, surplus or removed entries fail the gate. Use `--json` for the diagnostics and their source locations. Remove entries when migrating to semantic tokens. Keep measured runtime geometry exceptions beside their reason and expiry.

Use ordinary code review for a new exemption with the qualifying source change. The documented baselines retire on 18 February 2027. The CLI provides no baseline update mode.

## Changing a family’s existing style exceptions

If new family code needs different allowances, record the exact current findings, reason, owner, count and expiry in the normal profile baseline. A reviewed `baselineTransitions` entry can retain the previous groups for that source file’s exact earlier SHA-256. This lets a gate update land before the product and preserves rollback to the old file. The entry records both audited source digests. Other edits use the current baseline and receive the normal new, duplicate, stale and expired finding checks. Remove the historical entry when support for that source revision ends.


For native component sources, unchanged `StyleProp<ViewStyle>` and `StyleProp<TextStyle>` fields on an exported component are recognized through their lexical declarations. A public per-part record must have a fixed, declared key set. A theme lookup must resolve to the published token import or an actual `ResolvedTokens` field and a known leaf. Local shadowing, mutable aliases, calls receiving mutable style values and arbitrary computed styles still require inspection. Private helpers retain reviewed occurrences when the public origin is unavailable.

A registered standalone stylesheet can use an explicit `:scope` anchor inside its reviewed component root and nested boundary. The scanner still checks each declaration. Literal dimensional fallbacks may repeat the public token’s exact CSS value and unit. Changing a target from 44 pixels to a root-relative length requires separate review.

A protected enrollment ties a new public binding to its previous family manifest. Its exact pre-adoption manifest can omit an absent binding. Once registered, both the source and the canonical entry must exist. The ordinary occurrence, stale-entry and expiry checks apply to every later version.
