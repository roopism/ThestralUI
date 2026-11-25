# Behavior scenarios

A scenario describes one thing a person can do or observe. Keep it in `docs/components/<family-slug>.scenarios.yaml` next to the family spec. Each file uses the JSON-compatible subset of YAML 1.2 so every adapter can read the same file with its standard JSON parser. Use quoted keys and strings, arrays for ordered steps, and unique object keys.

| Field | Meaning |
| --- | --- |
| `family` | Exact family name from the spec frontmatter. |
| `scenarios` | Nonempty list. Each scenario has an `id`, a `fixture` and nonempty `steps`. |
| `id` | Stable, globally unique `<family-slug>.<behavior-slug>`. Specs reference this ID beside the relevant state. |
| `fixture` | Local fixture name within this family. Each platform constructs the same initial example before each scenario. |
| `webKeyboardFocus` | Optional named button at the first keyboard stop. Before the shared steps, the web adapter presses Tab and verifies focus and a visible outline. Every native adapter still runs the shared steps. |
| `steps` | Execute in listed order. A step has either `act` or `expect`, plus a `target`. Only `before` also has `other`. |
| `target`, `other` | Each has a neutral `role` and exact `name`. For static text the name means its readable text. A missing or ambiguous target fails the step. |

### Initial vocabulary

| Step | Observation or action |
| --- | --- |
| `act: activate` | Activate the single named control once using a supported user interaction. |
| `expect: visible` | The target is presented to the user and exposed to accessibility. A hidden duplicate cannot satisfy the expectation. |
| `expect: busy` | The named button is present, busy and unavailable. The English Android fixture exposes the exact label followed by the platform’s busy-state description. |
| `expect: before` | Both targets are present. The first precedes the second in accessible reading order, including any platform traversal overrides. |

An adapter fails on unrecognized fields, operations, roles or fixtures and includes the scenario ID and step in the diagnostic. Keep platform selectors, key bindings, setup and automation details inside that adapter. Add a verb when a family needs an observable behavior and its platform adapters can implement it. Test exact speech, focus movement and frame timing separately when a tool exposes only a proxy.

### Example fixture contracts

- **Save once.** Start with one enabled button named “Save” and zero saves. Each activation increments the save count. The fixture shows “Saved once” only when the count is one. This makes a dropped or duplicated action observable. [Button scenario](components/button.scenarios.yaml)
- **Child order.** Place text “First” and “Second” as separate accessible children in a vertical Stack. Preserve their reading order. A native adapter can exercise this contract against a fixture layout while the public native Stack awaits implementation. Record that run as adapter coverage. [Stack scenario](components/stack.scenarios.yaml)

Use a scenario ID and a relative file link together in the states matrix, for example `[button.save-once](button.scenarios.yaml)`. Readable names in fixture data stay fixed across adapters. Localized fixtures can define their own names explicitly. Use the platform mappings when interpreting each role. [Role mapping](role-mapping.md)

### Running the adapters

For web, add `tests/<family-slug>/web-fixtures.tsx` and export a `fixtures` object. Each key is the scenario's `fixture` name. Each value is a React component that renders the initial example with the family's public binding. The runner discovers these modules automatically. [Button fixture](../tests/button/web-fixtures.tsx)

From the repository root, build the packages and run all scenarios and adapter regressions in Chromium, Firefox and WebKit.

```sh
npm run build:packages
npx playwright test -c tests/scenarios/web/playwright.config.ts
```

Set `ULD_SCENARIOS` to comma-separated family slugs for a focused run.

```sh
ULD_SCENARIOS=button,stack npx playwright test -c tests/scenarios/web/playwright.config.ts
```

The native renderer and iPhone simulator share the same scenario files and a native fixture registry. [Native fixture setup and commands](../catalog/native/scenarios/README.md)
