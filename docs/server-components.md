# Server rendering and client boundaries

A plain layout or text element can render inside a Next.js App Router server page. Import its public entry directly. A static page can compose Box, Stack, Inline, Grid, Surface, Badge, Icon, Text, Heading, Keyboard, Separator and Divider without sending a client component for those elements.

```tsx
import { Badge, Stack, Text } from '@ui-lazy-dev/ui-web/primitives';

export default function Overview() {
  return <Stack gap="sm">
    <Text>Reading list</Text>
    <Badge>Three books</Badge>
  </Stack>;
}
```

Keep state, event handlers and browser APIs in a client component. An interactive child can receive content rendered on the server. Pass serializable data across that boundary. A stateless module can also be imported from a client caller, where the caller supplies event handlers. Preserve the exported types and host semantics for both paths.

The ownership check reports a client directive on a static leaf or on a barrel that puts a static export behind a client boundary. Splitting the interactive implementation lets a consumer import the static export directly. The fixture renders the real packed packages in a production build and checks the result with JavaScript disabled. It compares the compressed scripts requested by the foundation route to the same application's framework-only route. The interactive route must load additional JavaScript for the comparison to pass. [Foundation route](../tests/packaging/fixture/app/foundations/page.js) · [Production check](../scripts/verify-server-foundations.mjs)

Declare a verified web export as `"rendering": "server-safe"` in its spec. The validator checks that the foundation route uses that exact named import. A local alias is supported. An unused import or a different entry with the same export name does not qualify. Stable specs classify every web export.

Use the standalone Heading, Keyboard and Separator from `/document` in static content. Inside a React Aria dialog title slot or menu, import those bindings from `/navigation` so the dialog receives its accessible name and menu items retain their shortcut descriptions and keyboard order.
