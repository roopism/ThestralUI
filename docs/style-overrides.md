# Styling a library control

Use the host props and slots listed in each component's published API table. A component that accepts `className` puts that class on its documented host. A declared `style` prop overrides that host only. For example, Button accepts both through its button attributes. Icon's public inputs are its label and children. Give it a styled child or a containing element when you need to change its appearance.

## Cascade order

The public stylesheet order is `uld.reset`, `uld.tokens`, `uld.components`, then `uld.utilities`. Normal unlayered author declarations win over these layers, even when the application uses a zero-specificity selector. Put a broad reset in an earlier layer to keep its defaults below the component rules.

```css
@layer host, uld.reset, uld.tokens, uld.components, uld.utilities;
@import "./app-reset.css" layer(host);
@import "@ui-lazy-dev/ui-web/styles.css";

:where(.save-draft) {
  padding-inline: 1.5rem;
}
```

```tsx
<Button className="save-draft" type="submit">Save draft</Button>
```

An unlayered global rule also wins when it targets every button. A widget embedded in a page whose CSS you cannot control can install the sheets inside its shadow root. Set a theme on a containing element in that root. The outer page keeps its own styling and the embed can add local overrides. [Host and embed tests](../tests/browser/cascade-layers.spec.ts)

## Stable inputs

- Set the five appearance attributes on the provider or a containing element. The public names are `data-uld-brand`, `data-uld-scheme`, `data-uld-density`, `data-uld-motion` and `data-uld-mode`. The legacy `data-uld-theme` supports light and dark.
- Supply content through the named slots in the family's spec. The component owns each slot wrapper and its spacing. Use the slot's documented input to omit or replace it.
- Read semantic variables such as `--uld-text` or `--uld-surface`. Set a brand or contextual mode when the same change must apply across multiple components and platforms.
- Use the public role, name and state to find a control. Additional state attributes are stable only where the family documents them. Internal classes, wrapper depth, generated IDs and private token-selection variables can change in a compatible release.
