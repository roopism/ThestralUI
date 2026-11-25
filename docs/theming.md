# Scoped appearance

A page can mix brands, color schemes and densities. The nearest explicit setting for each axis wins. Changing one axis keeps the other preferences, the focused element and the contents of an edited field.

| Axis | Default | Available settings |
| --- | --- | --- |
| Brand | enterprise | enterprise, expressive and registered consumer brands |
| Scheme | light | light, dark, high-contrast |
| Density | comfortable | compact, comfortable, spacious |
| Motion | operating system preference | full, reduced |
| Contextual mode | default | consumer registrations |

## Render a web scope

Load the common variables and a stylesheet for each brand used on the page. Including an optional brand adds its own asset. A server can send the scope attributes and styles in the first response.

```tsx
import '@ui-lazy-dev/ui-web/styles.css';
import '@ui-lazy-dev/tokens/modes.css';
import '@ui-lazy-dev/tokens/brands/enterprise.css';
import '@ui-lazy-dev/tokens/brands/expressive.css';
import { ModeProvider } from '@ui-lazy-dev/ui-web/modes';

export function Article({ children }: { children: React.ReactNode }) {
  return <ModeProvider brand="expressive" scheme="dark">{children}</ModeProvider>;
}
```

An existing element can own the same scope using `data-uld-brand`, `data-uld-scheme`, `data-uld-density`, `data-uld-motion` and `data-uld-mode`. Omit an attribute to inherit that axis. Set `data-uld-mode="default"` to leave a nested contextual mode. The existing `data-uld-theme` light and dark values remain supported. An explicit scheme on the same element wins.

The resolver applies the base, brand, scheme, density, motion and contextual sets in that order. It resolves semantic aliases against the final values. The build emits one JavaScript payload and one stylesheet per brand. High-contrast is a selectable scheme. Forced colors follows the browser and uses system colors. [Resolver source](../packages/tokens/modes/system.resolver.json) · [Design Tokens Resolver Module](https://www.designtokens.org/tr/2025.10/resolver/)

## Register a brand or contextual mode

Declare consumer names in a TypeScript module augmentation. Applications can use the same definitions in a stylesheet build and in a native theme. Keep registrations local to a theme instance so separate server requests and sibling scopes can select independent settings.

```ts
import { createTheme, registerBrand, type ContextDefinition } from '@ui-lazy-dev/tokens/modes';
import { createBrandCSS, createContextCSS } from '@ui-lazy-dev/tokens/theme-css';

declare module '@ui-lazy-dev/tokens/modes' {
  interface ConsumerBrands { partner: true }
  interface ConsumerModes { article: true }
}

const partner = registerBrand('partner', {
  scheme: { dark: { 'color.accent': '#b8ceff' } },
});
const article = {
  name: 'article',
  overrides: ['type.bodySize', 'color.surface'],
  tokens: { 'type.bodySize': 18, 'color.surface': '{color.canvas}' },
} satisfies ContextDefinition;

export const theme = createTheme({ brands: [partner], modes: [article] });
export const stylesheet = createBrandCSS(partner) + createContextCSS(article);
```

Emit the stylesheet at build time and include it before the scoped content is painted. Select `brand="partner"` or `mode="article"` on the provider. Use `theme.resolve({ brand: 'partner', scheme: 'dark', mode: 'article' })` for a platform that consumes resolved values. Registration checks semantic paths and value types. It rejects undeclared contextual overrides and alias cycles. Keep application text, visibility and actions in component props. [Catalog registration](../catalog/modes/reading.json) · [Nested scopes and coarse targets](../tests/browser/mode-scopes.spec.ts)
