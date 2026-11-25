# Accessibility role and state mapping

Contract authors describe what a person can discover, operate and hear. Bindings translate each concept into their platform's accessibility tree. Prefer built-in controls for their semantics, actions and reading order. The examples below guide implementations. Evidence of platform support belongs in each family spec.

| Contract role | Web | iOS | Android | Flutter binding |
| --- | --- | --- | --- | --- |
| text | Readable static text | Static text | TextView text | Text semantics or label |
| heading | Heading with level | Header trait | Accessibility heading | Heading level |
| image | Named image | Image trait and label | Named ImageView | Image flag and label |
| layout | Preserve child order | Expose children separately | Preserve children and traversal order | Preserve child semantics |
| group, region | Named group or region when useful | Named container with accessible children | Pane title or logical grouping | Named container with explicit children |
| button | Button | Button trait with activation | Clickable Button | Button with tap action |
| link | Link with destination | Link trait | Accessible link span or link action | Link with destination |
| text field, search field | Named textbox or searchbox | Text field or search field | Editable text or search field | Text field with editable value |
| checkbox, option, radio | Named checkbox, option or radio with its group | Checkable action or selected choice with an announced value | CheckBox, selected item or RadioButton | Checked, selected or mutually exclusive options |
| switch | Switch with checked state | Switch with on/off value | Switch with checked state | Toggled property |
| slider, stepper | Slider or spinbutton with range and current value | Adjustable control with increment/decrement | RangeInfo and progress actions or step controls | Slider or spinButton, increase/decrease actions |
| progress | Progress bar with current value when determinate | Progress indicator with accessible value | ProgressBar with range when determinate | Progress bar or loading spinner |
| status, alert | Polite status or urgent alert | Updated message with appropriate announcement priority | Live region with polite or assertive priority | Status or alert with live updates |
| dialog, alert dialog | Named modal dialog or alertdialog | Modal presentation and initial focus | Dialog window with title | Dialog or alertDialog, scoped route |
| menu, menu item | Menu and menuitem for command menus | Action menu with named commands | Named popup menu items | Menu and menuItem |
| tab group, tab, tab panel | Tablist, tab and associated tabpanel | Tab bar, selected tab and its content | Selected tab and associated content | Tab bar, tab and tab panel |
| list, list item | List, listitem | Ordered accessible items | Collection and items | List and listItem |
| table, row, header, cell | Table or interactive grid with named headers | Data table container with associated cells | CollectionInfo and CollectionItemInfo | Table, row, columnHeader and cell |
| list of choices | Listbox with selectable options | Picker or collection of named selectable items | Single- or multiple-choice list with item state | Named options with selection and collection semantics |
| editable choice | Named combobox linked to its popup | Search or editable field with a list of suggestions | Editable text with a suggestion list | Combo box with editable text and suggestions |
| tree, hierarchical grid | Tree/treeitem or treegrid/row, with level and expansion state | Outline collection with disclosure controls and named child items | Hierarchical collection and expand/collapse actions | Expandable labeled rows and nested collection semantics |
| toolbar | Named toolbar and its operable children | Toolbar with individually accessible controls | Toolbar with separately named actions | Named container with distinct actions |
| tooltip | Tooltip associated with the described control | Supplementary accessibility hint on the control | Tooltip text or supplemental description | Tooltip role or tooltip semantics on the control |
| form | Named form when it acts as a landmark | Group of labeled editors and submit action | Group of labeled editable controls and submit action | Form role with individually named fields |
| separator | Separator for meaningful boundaries | Group boundary, adjustable action if interactive | Group boundary, adjustment when interactive | Grouping or adjustable control |
| navigation | Named navigation landmark | Named navigation region or tab bar | Named navigation pane | Navigation role |

Decorative parts stay out of the accessible name and reading order. A layout keeps its children reachable individually. For a composite widget, identify the selection, group and action used by its native equivalent in the family binding. Add a mapping when a family introduces a new generic role.

| Contract state | Web | iOS | Android | Flutter binding |
| --- | --- | --- | --- | --- |
| default | Native role, name and actions | Default traits | Default node state | Baseline widget semantics |
| hover, pressed (momentary) | Pointer and active feedback | Highlight while pressed | Press or ripple feedback | Hover and pressed feedback |
| focus-visible | Keyboard focus indicator | Keyboard focus or accessibility cursor as applicable | Input focus or accessibility focus as applicable | Focus highlight and separate accessibility focus |
| disabled | Disabled control | Disabled control, notEnabled trait | Disabled node and blocked action | Disabled semantics and blocked action |
| pending | Busy state, activation guarded, polite update | Busy value and status update, preserve focus | Busy state description and polite update, preserve focus | Busy value and live status, guard activation |
| checked, mixed | Checked or mixed | Control value describing state | Checked state or partial-state description | Checked or mixed state |
| selected, toggled | Selection or pressed state according to role | Selected trait or toggle value | Selected or checkable state | Selected or toggled |
| open, closed | Expanded state on the opener | Expanded/collapsed state or accessible value | Expand/collapse actions and state description | Expanded property and expand/collapse actions |
| invalid, required | Invalid or required state with associated hint or error | Localized error or requirement associated with the field | Content-invalid flag, error text and requirement | Validation result, required property and error text |
| read-only | Read-only input or supported readonly state, still inspectable | Readable value with editing actions unavailable | Readable field value with editing actions unavailable | Read-only property |
| current | Current item, page or step indicated on the active item | Selected or current value with contextual description | Current description on the active navigation or step item | Current item identified in its semantic description |
| hidden, decorative | Remove the decorative subtree from accessibility; preserve meaningful siblings | Hide only decorative elements | Exclude decorative nodes from accessibility | Exclude decorative semantics |
| value | Named value, with range where relevant | Accessibility value | Text, state description or range | Value and range properties |

The platform documentation defines role availability and OS-specific behavior. [Web roles and states](https://www.w3.org/TR/wai-aria-1.2/) · [UIKit traits](https://developer.apple.com/documentation/uikit/uiaccessibilitytraits) · [Android accessibility nodes](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo) · [Flutter semantics](https://api.flutter.dev/flutter/semantics/SemanticsProperties-class.html) · [Flutter roles](https://api.flutter.dev/flutter/dart-ui/SemanticsRole.html)
