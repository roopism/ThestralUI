# Component API-depth audit

The 20 November 2026 baseline covers 81 published families with 135 web exports and four React Native exports. For each family, the reviewed contract identifies the public bindings, the consumer capability to exercise, and an observable outcome. [Family contracts](../packages/policy/quality/api-depth/families.json) · [Original audit](component-depth.md)

## Check a packed candidate

Use Node 22.23.2. In a separate consumer, install the candidate token, web and native archives together. Install compatible versions of React, React DOM, React Native, TypeScript, the React and React DOM declarations, and jsdom in that consumer. Pass its directory as `CONSUMER`. Run these commands from the library root.

```sh
node --test tests/contracts/api-depth.test.mjs
node packages/policy/quality/api-depth/run-types.mjs "$CONSUMER" docs/component-inventory.mjs
node packages/policy/quality/api-depth/runtime-probes.mjs "$CONSUMER"
```

The type runner compiles positive and negative consumer examples through public imports. A missing binding, rejected valid use, or accepted invalid use fails the check. The staged gate runs those examples against the packed archives. Button, IconButton, Stack and Inline now include their size, icon or spacing requirements in the enforced minimum. A native IconButton brings the candidate to 139 public bindings. The baseline below records the original five gaps. [Button](components/button.md) · [IconButton](components/icon-button.md) · [Stack](components/stack.md) · [Inline](components/inline.md)

| Public export | Missing at the audit baseline |
| --- | --- |
| Web Button | Tokenized action sizes and leading and trailing icon slots |
| Native Button | Matching sizes and icon slots |
| Web IconButton | A shared action size API and square sizing across those sizes |
| Stack | Tokenized spacing, container-responsive gaps and alignment controls |
| Inline | Tokenized spacing, alignment and configurable wrapping |

The standalone runtime command exercises 14 packed behaviors and reruns each probe with its target replaced by an empty implementation. Three additional browser probes accept a browser page and the published styles to inspect Button, Stack and Inline. These observations use rendered accessibility attributes, computed geometry and focus state. The unit regressions deliberately remove, narrow and erase declarations and replace tested implementations. [Consumer examples](../packages/policy/quality/api-depth/consumer-cases.mjs) · [Runtime probes](../packages/policy/quality/api-depth/runtime-probes.mjs) · [Gate regressions](../tests/contracts/api-depth.test.mjs)

## Full family audit

Run the current packed family audit with the installed consumer and the local inventory.

```sh
node packages/policy/quality/api-depth/run-depth.mjs "$CONSUMER" docs/component-inventory.mjs
```

The audit checks public declarations, story examples and observable behavior from the packed JavaScript and CSS. Every high-priority input must change its designated observation. Browser, renderer and unit routes also require the named case to run with its reviewed assertion. The component specs record each family's maturity.
