# UI library migrations

Preview a migration from the consumer's project directory. List the JSX or TSX files you want to migrate.

```sh
ui-lazy-migrate button-icon-slots src/Save.tsx src/Toolbar.jsx
ui-lazy-migrate button-icon-slots --write src/Save.tsx src/Toolbar.jsx
```

## Button since 0.2.0

Existing `Button` props and ordinary children continue to work. The new web API adds size and icon slots. The migration recognizes a named or namespace import from `@ui-lazy-dev/ui-web` and moves an edge decoration into `startIcon` or `endIcon`. An eligible decoration is a `span` carrying only `inert` and `aria-hidden`, containing one self-closing element beside a static text label. The component supplies the same inert wrapper at runtime. Custom styling, spreads, ambiguous children, existing slots, local bindings and native controls retain their original source.

Run the before/after and repeat-application checks with `npm test -w @ui-lazy-dev/codemods`. Add future transforms to `migrations.mjs` with a matching fixture folder. For each breaking declaration, record its baseline and target versions, package entry and exact diagnostic. Supply either the transform or a `manual` string starting with “No automatic migration:” and the required consumer edit. The existing release compatibility check also reports the breaking declaration itself.
