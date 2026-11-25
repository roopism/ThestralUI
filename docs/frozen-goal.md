# ui-lazy-dev — the goal

**Status:** frozen on 2026-11-23. Nothing is added to this file. If something must change, the owner edits a line here and dates it; agents never do.

The owner authorized the amendment in section 11.1 on 2026-11-23 after Button was promoted.

**What this file is:** the complete description of the finished library. It says what must exist and how we know it is good. It does not say how to build it, in what order, or with what process.

---

## 1. The goal in one sentence

`@ui-lazy-dev` is one design system for React on the web and React Native on iOS and Android that is at least as good as the best existing library on every measurable dimension in section 11, and is the only one that is good at all of them at once.

## 2. Product principles

1. **Mobile-first in the code.** Layout, touch targets and performance are designed for phones first. On a desktop browser nobody should be able to tell.
2. **Senior-staff, FAANG-grade engineering.** Suitable as the UI foundation of a product with 100 million daily users.
3. **Plain and expressive.** A restrained enterprise look and a consumer look with Zomato/District-level motion and Dribbble-level polish, from the same components.
4. **A superset.** Every general-purpose atom, molecule and organism offered by the leading web and mobile libraries, and everything Elevate uses.
5. **Built to be maintained by AI and understood by a human.** Every family follows the same structure, so any agent can extend any part.

## 3. Platforms

| Platform | Support |
| --- | --- |
| Web | React 19, including Next.js App Router with server components. Chromium, Firefox and WebKit. |
| iOS | React Native 0.88, new architecture. |
| Android | React Native 0.88, new architecture, including low-end phones (about 2 GB RAM, 2 cores, 720p). |
| Other platforms | Tokens only: Swift, Kotlin, Dart and resolved JSON. No component libraries. |

One written contract per component covers all three platforms. Web and native share the contract and the tokens, not the rendering code.

## 4. What ships

| Package | Contents |
| --- | --- |
| `@ui-lazy-dev/ui-web` | All web components, hooks and styles. Heavy families on opt-in subpaths. |
| `@ui-lazy-dev/ui-native` | All native components and hooks, one subpath per family. |
| `@ui-lazy-dev/tokens` | Design tokens as CSS variables, TypeScript, JSON, Swift, Kotlin and Dart. |
| `@ui-lazy-dev/icons` | About 150 Lucide icons for web and native, imported one at a time. |
| `@ui-lazy-dev/messages` | The library's own strings in every supported locale. |
| `@ui-lazy-dev/codemods` | Automatic migrations for every breaking change. |
| Test helpers | `ui-web/test-utils` and a native equivalent, for apps that test screens built with the library. |
| Catalog | A browsable catalog of every component, variant and state at `ui.lazy-dev.site`. |

## 5. Component families (88)

Native applies to every family except the three marked *(web only)*, so 85 families need native parity.

**Foundations (12)**
Text · Heading · Locale provider · Separator · Visually hidden · Box · Surface · Stack · Inline · Adaptive grid · Scroll area · Icon

**Actions and feedback (16)**
Button · Icon button · Button group · Toggle and segmented control · Link · Badge · Tag and removable chip · Avatar · Keyboard shortcut label *(web only)* · Empty state · Error state, offline banner and permission notice · Spinner · Progress · Skeleton · Live status and inline alert · Banner

**Forms (25)**
Labeled field · Form and field group · Text field · Search · Password field · Code field · Number field · Validation summary · File upload · Checkbox · Radio group · Switch · Slider · Listbox · Select · Combobox · Autocomplete · Date field · Time field · Calendar · Date picker · Date range picker · Color text field · Color swatch selection · Color picker

**Overlays and navigation (15)**
Modal dialog · Alert dialog · Drawer · Gesture sheet · Toast and snackbar · Popover · Tooltip *(web only)* · Menu and submenu · Toolbar · Panel header · Tabs · Breadcrumb *(web only)* · Disclosure and accordion · Navigation bar and rail · Pagination

**Collections (9)**
Data table (sort, filter, pagination, selection, bulk actions, editable cells) · Record selection · Virtual data grid · Virtual treegrid · Snap carousel · Expanding media card · Resource card · List · Native image feed (recycling list, image loading and caching, placeholders, pull-to-refresh, infinite loading)

**Organisms (9)**
Application shell · Page composition · Resizable list and detail · Command palette · Form wizard · Settings · Notification center · Batch progress · Document preview

**Expressive motion (2)**
Motion sequence · Shared element transition

## 6. What every family must have

A family is finished only when all of these are true.

**Contract and API**
- A written spec with purpose, anatomy, variants, a states matrix, keyboard and touch behaviour, accessibility, localization, tokens and composition rules. Nothing marked pending.
- API depth equal to the deepest reference library: sizes, tones, states, controlled and uncontrolled use, ref forwarding and slots, wherever they apply.
- Full TypeScript types with no `any` in the public surface.

**Behaviour and flexibility**
- A public headless hook that holds the behaviour with no styling. The styled component is built on that hook.
- An unstyled mode: behaviour and accessibility only, no library CSS.
- A stable class name and `data-part` attribute on every part on web, and a matching part id on native.
- Consumer styles always win, without specificity tricks.
- Every optional slot disappears completely when it is empty: no wrapper, no leftover gap.
- Works as a server component when it has no state or handlers; otherwise only the interactive part is client code.

**Modes and content**
- Correct in every combination of scheme, brand, density and motion mode.
- No hard-coded strings. Correct in right-to-left, in CJK and with long text.
- Loading, empty, error, offline and permission-denied states wherever they apply. Loading never shifts layout.

**Native parity**
- The same contract and tokens as web.
- Platform-appropriate behaviour on each OS: Back, pickers, sheets versus menus, ripple versus highlight, haptics, safe areas, keyboard avoidance.
- Correct role, label and state for VoiceOver and TalkBack.
- No dropped-frame or input-delay regression on the low-end Android profile for anything that animates or scrolls.

**Proof**
- Unit, browser, visual and accessibility tests pass in all three browser engines, in light and dark, at phone and desktop sizes.
- The same behaviour scenarios pass on web, on the iPhone Simulator and on both Android profiles.
- A catalog story shows every variant and state.
- Its size is inside its band (section 9).
- A test helper is exported for complex families such as tables and comboboxes.

## 7. System-wide capabilities

1. **Modes.** Four axes that can be set on any part of the screen and nested:
   - scheme: light, dark, high-contrast;
   - brand: `enterprise`, `expressive`, plus any brand an app registers;
   - density: compact, comfortable, spacious;
   - motion: full, reduced, following the OS by default.
   Switching a mode never remounts a component and never loses focus, input or scroll position. Server rendering shows the right mode with no flash.
2. **Theming.** Brands are created through typed tokens, checked at build time. Brand changes go through tokens, never through style props. Adding brands does not grow the default CSS.
3. **One provider.** A single `<UIProvider>` sets locale, mode, brand and layers with working defaults. A new app installs the library, wraps itself in the provider and renders a page in five minutes.
4. **Localization.** English complete, plus ar, he, ja, zh-Hans, hi, de, fr, es and pt-BR. Each locale is a separate import. Apps can override any message. Dates, times, numbers, currency, lists and plurals always go through locale-aware formatting.
5. **Layering.** Named layers from base to tooltip, and one overlay manager. Nested overlays stack correctly, Escape or Back closes only the top one, and focus returns down the stack. No raw `z-index` anywhere.
6. **Icons.** Lucide behind the library's own package, so the source can be swapped. Only the icons an app imports reach its bundle. Icons that must mirror in right-to-left do.
7. **Typography.** Semantic text styles (display, headline, title, body, label, code). No layout shift when a web font loads. Nothing clipped at the largest OS text size on iOS or Android.
8. **Server components.** A page made only of static components ships close to zero client JavaScript.
9. **Standard states.** Shared building blocks and one rule set for loading, empty, error, offline, permission-denied and partial failure.
10. **Chart colours.** Categorical, sequential and diverging palettes as tokens, distinguishable under the three common forms of colour blindness. Tokens only.
11. **Platform tokens.** Every token, in every mode, generated for Swift, Kotlin and Dart, and proven identical to the source.
12. **Migrations.** Every breaking change ships with a codemod or a written note that none is possible.

## 8. Expressive motion

- **One motion vocabulary as tokens:** enter, exit, emphasis, spring, stagger and shared element, with rules for interruption and reversal and a reduced-motion equivalent for each.
- **Native motion and gestures run on the UI thread** (Reanimated and Gesture Handler).
- **A gesture sheet** with snap points, velocity handling and interruption.
- **One complete expressive flow** in the `expressive` brand on web and on native: a shared-element transition, a gesture sheet and a staggered list.
- **Recordings** of that flow at phone and desktop sizes, in both brands, with reduced-motion versions.
- **The default install does not grow** because motion exists; the motion engine is opt-in.

## 9. Size and performance targets

**Size (gzip, per family, script plus styles)**

| Band | Limit |
| --- | --- |
| Primitives | 1 KB |
| Simple components | 2.5 KB |
| Inputs | 5 KB |
| Overlays | 7 KB |
| Heavy components | 15 KB |
| Date and time (opt-in) | 80 KB |

- The default install for an app is at most 60 KB gzip in total.
- Icons, the motion engine, date and time, and any other heavy dependency are opt-in and never count toward the default.
- An app pays only for the families it imports.

**Speed on web**
- Equal to or faster than the fastest reference library on first paint, theme switch, form mount, click response, style recalculation and layout, measured on the same machine with the same screens.
- No runtime style generation. All styling is static CSS.

**Speed on native**
- Equal to or faster than the fastest cross-platform library on mount, list scrolling and interaction response on both Android profiles and the iPhone.
- A replica of the Zomato and District home, listing and detail screens, with a large dataset, image feeds, translucent navigation, draggable sheets and shared-element transitions, matches or beats the real apps on dropped frames and response time on the same device.

## 10. Accessibility

- WCAG 2.2 AA in every brand and scheme, and AAA contrast in high-contrast mode.
- Zero automated accessibility violations in any family.
- Every interactive family follows the established keyboard pattern for its role.
- Minimum touch-target size is kept in every density on touch devices.
- Forced-colours mode and reduced motion are respected everywhere.

## 11. The scorecard: how "better than the giants" is decided

Reference set: Material UI, Ant Design, Chakra, Mantine, Radix and shadcn/ui, React Aria and Spectrum, Fluent 2, Carbon, Polaris, Atlassian, Primer, Base Web, Tamagui, Gluestack and React Native Paper.

The library is finished when every row passes. A row passes only with a measurement or a checklist that anyone can rerun.

| Dimension | Pass rule |
| --- | --- |
| Breadth | Every general-purpose component in any reference library has an equivalent here. Charts are excluded. |
| API depth | For each family, every size, tone, state and composition option offered by the deepest reference library is available. |
| Platforms | Every applicable family works on web, iOS and Android from one contract. |
| Accessibility | Section 10 holds for every family. No reference library scores better on the same automated and keyboard checks. |
| Size | Each family is inside its band and no larger than the lightest reference equivalent with the same features. |
| Web speed | Section 9 web targets hold against the fastest reference library, on every metric including the sub-metrics. |
| Native speed | Section 9 native targets hold against Tamagui and Gluestack, and against the real Zomato and District apps. |
| Server rendering | Static components ship near-zero client JavaScript. No reference library ships less for the same page. |
| Theming | Four mode axes, nested scopes, typed brands, no remount on change. |
| Styling freedom | Unstyled mode, headless hooks, stable part names and consumer-wins layering on every family. |
| Localization | Ten locales, right-to-left and locale-aware formatting on every family. |
| Motion | The expressive flow of section 8 runs on web and native with no dropped frames on the standard profiles. |
| Setup | The five-minute quickstart of section 7 works from a clean machine. |
| Test strength | Every family is tested on three browser engines, an iPhone and two Android profiles, with visual baselines. |
| Maintainability | Every family has the same file layout, a spec and a generator, so a new family is added without touching shared files. |

### 11.1. Additional acceptance criteria approved on 2026-11-23

The following criteria apply to the first family or release fixture that exercises them. Record the tested revision, platform, fixture, and result. Apply family checks to the affected families and the shared checks to the release candidate. Retain the physical-device walkthroughs on the schedule in section 14.

| Area | Proof required for 1.0 |
| --- | --- |
| Adaptive workflows | Demonstrate the same user task on a desktop and a phone for a table, a list/detail view, and a bulk action. Each example must let the user find an item, act on it, and see the outcome. |
| Advanced grids | Demonstrate multi-column sorting, column pinning, row grouping, and opt-in Excel export on representative data. Document which features the library licence includes. Export must stay out of the default bundle. |
| Large collections | Edit and select one row in a large virtual grid. Record the dataset and viewport sizes, the number of rows rerendered, the number mounted, and the interaction time. Calibrate and approve limits on repeatable reference runs, then enforce them on the same profiles. |
| Accessible virtualization | With virtualization enabled, navigate to an initially unmounted option, hear its name and state with a screen reader, select it, and verify the selection. Automate keyboard and focus checks and record a real screen-reader walkthrough on a supported platform. Physical iPhone and Android walkthroughs remain in section 14. |
| Browser conventions | On representative controls, verify selection, copy, native scrolling, zoom and reflow, and standard link actions including opening in a new tab. Exercise Chromium, Firefox and WebKit. Assign each behavior to the relevant family and identify any manual browser checks explicitly. |
| Initial HTML | In a production server-rendered app with JavaScript disabled, meaningful text and headings, genuine navigable links, and applicable named controls must be available in the initial document. Interactive controls retain their server-renderable semantics before hydration. |
| Startup and memory | Compare an empty app with an otherwise identical app using the library. Record native cold start and peak memory on the standard profiles, and time to first readable text on web with slow-loading fonts. Calibrate limits on the library's added cost before enforcing them. |
| New native APIs | Document and exercise a supported way to use a native UI capability before the framework exposes it. Publish who reviews relevant iOS and Android changes, the review interval, and how an adoption decision is recorded. |
| Performance diagnostics | Provide a reproducible slow interaction and instructions to capture a trace. Show how a developer can identify the contributing rerender, layout work, or style calculation and verify the effect of a fix. |
| Clean integration | In fresh consumer apps, install the packed library and use its documented provider to run a Select inside a sheet and a virtual grid on their supported platforms. Follow only the published setup steps. |
| Customized upgrades | Upgrade a sample app that uses custom tokens, slots, part selectors, and headless hooks. Verify its public behavior and appearance after applying the documented migration. |
| Contributor upkeep | Have a contributor unfamiliar with the family follow the guide to add a family and diagnose a failing check. Record elapsed time, steps that needed help, and shared-tooling maintenance effort over a stated period. |

## 12. Quality guards

The checks that prove sections 6 to 11 run automatically, and these four things are always true:

1. Nothing joins the main branch unless every check that applies to it passes.
2. A size, speed, accessibility or test limit is never loosened by an agent. Only the owner can loosen one.
3. No test is skipped, weakened or quarantined to make something pass.
4. Every reported pass names the exact commit it was measured on.

## 13. Version 1.0

1.0 is released when:

- all 88 families are finished on web under section 6, and all 85 applicable families have native parity;
- every capability in section 7 and everything in section 8 exists;
- every row of the scorecard in section 11 passes, with evidence for the applicable criteria in section 11.1;
- the release is packed and installs cleanly into a fresh Next.js app and a fresh React Native app on iOS and Android;
- the public API is reviewed for consistency and frozen, with a changelog;
- a licence and security audit of every dependency is clean.

## 14. After 1.0

These cannot be proven by building the library. They come from using it, and none is claimed before it is measured.

- Real phones: a physical iPhone and a low-end Android phone, with VoiceOver and TalkBack walkthroughs.
- An external WCAG 2.2 AA audit, including NVDA and JAWS.
- Real-user web vitals (LCP, INP, CLS) from a deployed app.
- A real app built on the library, starting with Elevate, and the fixes its usage finds.
- A designer's review of every family.
- 40 or more locales.
- A documentation site with a live playground, a starter template and publishing to a package registry.
- A support policy: supported versions, long-term support and deprecation rules, signed releases.
- Evidence at 100M-DAU scale, which can only come from a product of that size.

## 15. Out of scope

- Component libraries for Vue, Svelte, web components, Flutter, SwiftUI or Jetpack Compose.
- Server-driven UI.
- Chart components.
- Design-tool integration, including Figma.
- PrepTracker.
