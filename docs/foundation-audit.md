# Foundation source audit

The P1.3 family layout at `e056648` contains 33 library-owned English defaults, two numeric z-index declarations and 85 web modules with a client directive. These counts locate the source sites for P2.4 localization, P2.5 layering and P2.8 Server Component qualification. A client directive becomes a policy exception when it conflicts with a binding's declared server-safe contract.

## Rendering boundaries

Under Node 22.23.2 with the `react-server` condition, all 19 public root and primitives bindings import successfully. Direct invocation with static props returns a React element for 18. FormField calls `useId` and requires a renderer. All 19 emit HTML through React DOM's server renderer. FormField emits a label and input with matching association IDs. Grid aliases AdaptiveGrid and accounts for one of the 19 public names.

| Public entry | Bindings | Qualification detail |
| --- | --- | --- |
| Root | AdaptiveGrid, Button, FormField | Button renders a native button. Event callbacks belong to its client caller. FormField generates IDs and clones its supplied input. |
| /primitives | Badge, Box, ButtonGroup, Divider, Grid, Icon, IconButton, Inline, Progress, ScrollArea, Skeleton, Spinner, Stack, Status, Surface, Text | The layout and decoration bindings consume props. IconButton renders Button. Spinner and Status expose semantic markup. |

Six additional family implementations return React elements on direct invocation with static props. All six retain a client directive. The App Router qualification in P2.8 must render each binding through its public entry and measure the client assets it brings into the page.

| Public entry | Candidates | Dependency to check |
| --- | --- | --- |
| /patterns | DocumentPreview, EmptyState, PanelHeader | All three import the shared `classNames` helper, which has a client directive. |
| /entry-fields | CodeField, FileUpload | Both render FormField, whose ID generation needs a renderer. |
| /workflows | AppNavigation | The default links render with static data. A custom renderLink callback must execute alongside its caller. AppShell and WorkspacePage also require a dispatcher for `useId`. |
| /avatar | Avatar fallback | The initial placeholder displays initials and a label. Image failure recovery uses state and an error handler. |
| /navigation | Heading, Keyboard, Separator | These React Aria bindings retain client boundaries. Their provider and context contracts need review. |

## Foundation policy inputs

| Rule | Source count and ownership | Foundation and expiry |
| --- | --- | --- |
| Library-owned messages | 33 English defaults on 31 lines in eight enclosing TypeScript statements. Data table 12, Form wizard 3, Command palette 3, Record selection 1, Notification center 5, Batch progress 8, Settings 1. Native hosts supply the labels. | W1 owns P2.4. Each family resolves its findings before wave exit. [Message keys and source sites](library-strings.md) |
| Raw z-index | Two declarations. Application shell's skip link uses 1. Toast and snackbar's notification region uses 110. | W2 owns the layering foundation. Toast and snackbar ends Wave 4, Application shell ends Wave 6. [Skip link](../packages/web/src/application-shell/styles.css#L5) · [Toast region](../packages/web/src/toast-and-snackbar/styles.css#L7) |
| Client boundaries | 85 of 114 web source modules and zero of seven native source modules carry a client directive. | MAIN owns P2.8. Each binding declared server-safe needs App Router evidence before promotion. |

| Web TS/TSX source group | Modules | With a client directive |
| --- | ---: | ---: |
| Root and compatibility barrels | 20 | 16 |
| Shared helpers | 9 | 4 |
| Family-owned React Aria re-exports | 36 | 36 |
| Family implementation modules | 49 | 29 |
| **Total** | **114** | **85** |

At `e11f3e5`, before the split, the same 33 English defaults occupied four shared web files and the same two layer values appeared in motion.css and workflows.css. The earlier layout had client directives in 16 of 20 web modules. Splitting the modules copied their existing client boundaries into the corresponding family files.
