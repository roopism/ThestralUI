// Generated from manifests/families by scripts/manifests/generate.mjs.
export const revision = "2026-11-20.2";
export const references = {
  "APG": "https://www.w3.org/WAI/ARIA/apg/patterns/",
  "RAC": "https://react-aria.adobe.com/",
  "Material": "https://m3.material.io/components",
  "Apple": "https://developer.apple.com/design/human-interface-guidelines/components",
  "Roadmap": "system-roadmap.md"
};
export const behaviorAnchors = {
  "Adaptive grid": "shortlist adapts to the available space",
  "Separator": "getByRole('separator')",
  "Modal dialog": "getByRole('dialog'",
  "Toggle and segmented control": "name: 'Compact'",
  "Listbox": "getByRole('option'",
  "Select": "name: /Language/",
  "Slider": "getByRole('slider'",
  "Breadcrumb": "name: 'Location'",
  "Toolbar": "returns to the toolbar",
  "Menu and submenu": "getByRole('menuitem'",
  "Tooltip": "getByRole('tooltip')",
  "Popover": "getByRole('menu'",
  "Disclosure and accordion": "name: 'Review policy'",
  "Heading": "name: 'Review settings'",
  "Keyboard shortcut label": "locator('kbd')",
  "Virtual data grid": "grid recycles rows",
  "Virtual treegrid": "tree expands, selects"
};
export const families = [
  {
    "id": "Box",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Box"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Stack",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Stack"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/StackInline.stories.tsx",
    "test": "tests/browser/stack-inline.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Inline",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Inline"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/StackInline.stories.tsx",
    "test": "tests/browser/stack-inline.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Surface",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Surface"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Primitives.stories.tsx",
    "test": "tests/primitives.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Scroll area",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:ScrollArea"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Text",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Text"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Adaptive grid",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      ".:AdaptiveGrid",
      "primitives:Grid"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Shortlist.stories.tsx",
    "test": "tests/browser/adaptive.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Separator",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Divider",
      "navigation:Separator",
      "document:Separator"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Icon",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Icon"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Badge",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Badge"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Primitives.stories.tsx",
    "test": "tests/primitives.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Avatar",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "avatar:Avatar"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Primitives.stories.tsx",
    "test": "tests/primitives.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Skeleton",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Skeleton"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Spinner",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Spinner"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Progress",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Progress"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Primitives.stories.tsx",
    "test": "tests/primitives.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Live status and inline alert",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:Status"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Primitives.stories.tsx",
    "test": "tests/primitives.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Button",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Material",
      "Apple"
    ],
    "api": [
      ".:Button",
      ".:useButton",
      "navigation:Trigger"
    ],
    "web": "supported",
    "native": "experimental",
    "story": "catalog/ButtonSizes.stories.tsx",
    "test": "tests/browser/button-depth.spec.ts",
    "nativeApi": [
      "native:Button",
      "native:useButton",
      "native/button:Button",
      "native/button:useButton"
    ],
    "nativeStory": "catalog/native/Gallery.tsx",
    "nativeTest": "tests/button/native.test.cjs",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "experimental",
      "Android": "experimental"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Icon button",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:IconButton"
    ],
    "web": "supported",
    "native": "experimental",
    "story": "catalog/ButtonSizes.stories.tsx",
    "test": "tests/browser/button-depth.spec.ts",
    "nativeApi": [
      "native:IconButton"
    ],
    "nativeStory": "catalog/native/Gallery.tsx",
    "nativeTest": "tests/icon-button/native.test.cjs",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "experimental",
      "Android": "experimental"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Button group",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "primitives:ButtonGroup"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Primitives.stories.tsx",
    "test": "tests/family-contracts.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Labeled field",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap",
      "RAC"
    ],
    "api": [
      ".:FormField"
    ],
    "web": "supported",
    "native": "experimental",
    "story": "catalog/labeled-field.stories.tsx",
    "test": "tests/labeled-field/controls.test.tsx",
    "nativeApi": [
      "native:FormField"
    ],
    "nativeStory": "catalog/native/Gallery.tsx",
    "nativeTest": "tests/labeled-field/native.test.cjs",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "experimental",
      "Android": "experimental"
    },
    "ownership": "browser control and owner"
  },
  {
    "id": "Modal dialog",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Material",
      "Apple"
    ],
    "api": [
      "dialog:Dialog",
      "navigation:DialogTrigger",
      "navigation:Modal",
      "navigation:ModalOverlay",
      "navigation:OverlayDialog",
      "modal-dialog:Dialog",
      "modal-dialog:useDialog",
      "modal-dialog:DialogHeading",
      "modal-dialog:DialogBody",
      "modal-dialog:DialogActions"
    ],
    "web": "supported",
    "native": "experimental",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "nativeApi": [
      "native:Dialog",
      "native:useDialog",
      "native/modal-dialog:Dialog",
      "native/modal-dialog:useDialog"
    ],
    "nativeStory": "catalog/native/Gallery.tsx",
    "nativeTest": "tests/modal-dialog/native.test.cjs",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "experimental",
      "Android": "experimental"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Text field",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:TextField",
      "forms:Input",
      "forms:TextArea",
      "forms:Label",
      "forms:FieldError",
      "forms:Text"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Form and field group",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:Form",
      "forms:Group"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Search",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:SearchField"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Controls.stories.tsx",
    "test": "tests/advanced.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Checkbox",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:Checkbox",
      "forms:CheckboxGroup"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Controls.stories.tsx",
    "test": "tests/advanced.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Radio group",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:RadioGroup",
      "forms:Radio"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Controls.stories.tsx",
    "test": "tests/advanced.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Switch",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:Switch"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Controls.stories.tsx",
    "test": "tests/advanced.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Toggle and segmented control",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:ToggleButton",
      "forms:ToggleButtonGroup"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Listbox",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:ListBox",
      "forms:ListBoxItem"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Select",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:Select",
      "forms:SelectValue"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Combobox",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:ComboBox"
    ],
    "web": "exported",
    "native": "planned",
    "story": "catalog/Authoring.stories.tsx",
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Autocomplete",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:Autocomplete"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Slider",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:Slider",
      "forms:SliderTrack",
      "forms:SliderThumb",
      "forms:SliderFill",
      "forms:SliderOutput"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Number field",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:NumberField"
    ],
    "web": "exported",
    "native": "planned",
    "story": "catalog/Authoring.stories.tsx",
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Date field",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:DateField",
      "forms:DateInput",
      "forms:DateSegment"
    ],
    "web": "exported",
    "native": "planned",
    "story": "catalog/Authoring.stories.tsx",
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Time field",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:TimeField"
    ],
    "web": "exported",
    "native": "planned",
    "story": "catalog/Authoring.stories.tsx",
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Calendar",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:Calendar",
      "forms:CalendarCell",
      "forms:CalendarGrid",
      "forms:CalendarGridHeader",
      "forms:CalendarHeaderCell",
      "forms:CalendarGridBody"
    ],
    "web": "exported",
    "native": "planned",
    "story": "catalog/Authoring.stories.tsx",
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Date picker",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:DatePicker"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Date range picker",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:DateRangePicker",
      "forms:RangeCalendar"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Tag and removable chip",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "forms:TagGroup",
      "forms:Tag",
      "forms:TagList"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Authoring.stories.tsx",
    "test": "tests/tag-and-removable-chip/authoring.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Color text field",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "color:ColorField",
      "color:ColorSwatch"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Authoring.stories.tsx",
    "test": "tests/color-text-field/authoring.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Color picker",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "color:ColorPicker",
      "color:ColorArea",
      "color:ColorThumb",
      "color:ColorSlider",
      "color:ColorWheel",
      "color:ColorWheelTrack"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Color swatch selection",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "color:ColorSwatchPicker",
      "color:ColorSwatchPickerItem"
    ],
    "web": "exported",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "maturity": "experimental",
    "platforms": {
      "web": "exported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "File upload",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC",
      "Roadmap"
    ],
    "api": [
      "entry-fields:FileUpload",
      "forms:DropZone",
      "forms:FileTrigger"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EntryFields.stories.tsx",
    "test": "tests/file-upload/entry-fields.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "browser control and owner"
  },
  {
    "id": "PasswordField",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "entry-fields:PasswordField"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EntryFields.stories.tsx",
    "test": "tests/passwordfield/entry-fields.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "internal with owner callbacks"
  },
  {
    "id": "CodeField",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "entry-fields:CodeField"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EntryFields.stories.tsx",
    "test": "tests/codefield/entry-fields.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "ValidationSummary",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "entry-fields:ValidationSummary"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EntryFields.stories.tsx",
    "test": "tests/validationsummary/entry-fields.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Breadcrumb",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Breadcrumbs",
      "navigation:Breadcrumb",
      "navigation:Link"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Toolbar",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Toolbar"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Menu and submenu",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Menu",
      "navigation:MenuItem",
      "navigation:MenuTrigger",
      "navigation:SubmenuTrigger"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Tooltip",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Tooltip",
      "navigation:TooltipTrigger"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Popover",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Popover"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Tabs",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Tabs",
      "navigation:Tab",
      "navigation:TabList",
      "navigation:TabPanel"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Controls.stories.tsx",
    "test": "tests/tabs/advanced.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Disclosure and accordion",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Disclosure",
      "navigation:DisclosureGroup",
      "navigation:DisclosurePanel"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Heading",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Heading",
      "document:Heading"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseNavigation.stories.tsx",
    "test": "tests/browser/enterprise-navigation.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "see declared value/defaultValue or selected/defaultSelected props"
  },
  {
    "id": "Keyboard shortcut label",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "RAC"
    ],
    "api": [
      "navigation:Keyboard",
      "document:Keyboard",
      "keyboard-shortcut-label:KeyboardShortcutLabel",
      "keyboard-shortcut-label:useKeyboardShortcutLabel",
      "keyboard-shortcut-label:getKeyboardShortcutLabelProps"
    ],
    "web": "supported",
    "native": "excluded",
    "story": "catalog/keyboard-shortcut-label.stories.tsx",
    "test": "tests/keyboard-shortcut-label/shortcut-label.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "excluded",
      "Android": "excluded"
    },
    "ownership": "stateless display; the containing command owns activation and platform shortcuts"
  },
  {
    "id": "Locale provider",
    "layer": "infrastructure",
    "owner": "@thetechgeeek",
    "refs": [
      "RAC"
    ],
    "api": [
      "navigation:I18nProvider"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/Controls.stories.tsx",
    "test": "tests/runtime-isolation.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Data table",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Roadmap"
    ],
    "api": [
      "collections:DataTable",
      "data-table:DataTable",
      "data-table:useDataTable",
      "data-table:getDataTableRow"
    ],
    "web": "supported",
    "native": "experimental",
    "story": "catalog/data-table.stories.tsx",
    "test": "tests/data-table/collections.test.tsx",
    "nativeApi": [
      "native/data-table:DataTable",
      "native/data-table:useDataTable"
    ],
    "nativeStory": "catalog/native/scenarios/DataTable.tsx",
    "nativeTest": "tests/data-table/native.test.cjs",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "experimental",
      "Android": "experimental"
    },
    "ownership": "internal with owner callbacks"
  },
  {
    "id": "Virtual data grid",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Roadmap"
    ],
    "api": [
      "collections:VirtualDataGrid"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseCollections.stories.tsx",
    "test": "tests/virtual-data-grid/enterprise-collections.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Virtual treegrid",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Roadmap"
    ],
    "api": [
      "collections:VirtualTree"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseCollections.stories.tsx",
    "test": "tests/virtual-treegrid/enterprise-collections.spec.ts",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Application shell",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:AppShell"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/application-shell/workflow-shell.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Navigation bar and rail",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:AppNavigation"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/workflow-shell.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Page composition",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:WorkspacePage"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/workflow-shell.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Record selection",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:RecordList"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/workflow-shell.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Resizable list and detail",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:SplitView"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/resizable-list-and-detail/workflow-shell.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "internal with owner callbacks"
  },
  {
    "id": "Form wizard",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:Wizard"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/form-wizard/workflow-commands.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Command palette",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:CommandPalette"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/command-palette/workflow-commands.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "internal with owner callbacks"
  },
  {
    "id": "Notification center",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:NotificationCenter"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/notification-center/workflow-status.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Settings",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:SettingsPanel"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/workflow-status.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Batch progress",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "workflows:BatchProgress"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/EnterpriseWorkspace.stories.tsx",
    "test": "tests/batch-progress/workflow-status.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Drawer",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Material",
      "Roadmap"
    ],
    "api": [
      "motion:Drawer"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionGallery.stories.tsx",
    "test": "tests/drawer/motion-overlays.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Gesture sheet",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Apple",
      "Material",
      "Roadmap"
    ],
    "api": [
      "motion:GestureSheet"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionGallery.stories.tsx",
    "test": "tests/motion-overlays.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Alert dialog",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Apple"
    ],
    "api": [
      "motion:AlertDialog"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionGallery.stories.tsx",
    "test": "tests/alert-dialog/motion-overlays.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Toast and snackbar",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Material",
      "Roadmap"
    ],
    "api": [
      "motion:ToastRegion",
      "motion:createToastQueue"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionGallery.stories.tsx",
    "test": "tests/toast-and-snackbar/motion-overlays.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "Snap carousel",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Roadmap"
    ],
    "api": [
      "motion:Carousel"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionGallery.stories.tsx",
    "test": "tests/snap-carousel/motion-media.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "internal with owner callbacks"
  },
  {
    "id": "Expanding media card",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "motion:ExpandableMediaCard"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionGallery.stories.tsx",
    "test": "tests/expanding-media-card/motion-media.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "internal with owner callbacks"
  },
  {
    "id": "Motion sequence",
    "layer": "infrastructure",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "motion:playMotionSequence"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionSequences.stories.tsx",
    "test": "tests/motion-sequence/motion-choreography.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Shared element transition",
    "layer": "infrastructure",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "motion:animateSharedElement",
      "motion:captureSharedElement"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/MotionSequences.stories.tsx",
    "test": "tests/shared-element-transition/motion-choreography.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "EmptyState",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "patterns:EmptyState"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/DocumentReview.stories.tsx",
    "test": "tests/emptystate/patterns.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "PanelHeader",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "patterns:PanelHeader"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/DocumentReview.stories.tsx",
    "test": "tests/documentpreview/patterns.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "ResourceCard",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "patterns:ResourceCard"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/DocumentReview.stories.tsx",
    "test": "tests/resourcecard/patterns.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "owner supplied state"
  },
  {
    "id": "DocumentPreview",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "patterns:DocumentPreview"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/DocumentReview.stories.tsx",
    "test": "tests/documentpreview/patterns.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Meter",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Roadmap"
    ],
    "api": [],
    "web": "planned",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "A bounded measurement needs a separate contract from task progress.",
    "maturity": "planned",
    "platforms": {
      "web": "planned",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Rating",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "planned",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "No dedicated rating input is published.",
    "maturity": "planned",
    "platforms": {
      "web": "planned",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Image",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap",
      "Apple"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Use a native HTML image with alt, size and loading policy.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Standalone link",
    "layer": "atom",
    "owner": "@thetechgeeek",
    "refs": [
      "APG",
      "Apple"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Navigation Link is part of the breadcrumb family and supports independent links.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Pagination",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "DataTable owns local page controls. A server-driven pager is planned.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Editable row and bulk actions",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "DataTable owns page selection, editing, saving and recovery.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Stepper",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Wizard provides a labeled current step and navigation.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Account recovery",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Compose app-owned identity flow with CodeField, PasswordField and ValidationSummary.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Editorial collection",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Shortlist and media stories compose ResourceCard, Carousel and AdaptiveGrid.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Filter builder",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "planned",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "DataTable currently provides text search rather than a nested predicate builder.",
    "maturity": "planned",
    "platforms": {
      "web": "planned",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Infinite feed",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "APG"
    ],
    "api": [],
    "web": "planned",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Windowed data and announcements for incremental feed loading need a dedicated contract.",
    "maturity": "planned",
    "platforms": {
      "web": "planned",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Swipe actions",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [],
    "web": "planned",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Gesture sheet provides a dismiss gesture. Row action gestures require separate conflict and alternate-action coverage.",
    "maturity": "planned",
    "platforms": {
      "web": "planned",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Media playback",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap",
      "Apple"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Use HTML audio and video with browser playback controls and captions.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Menu bar",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG"
    ],
    "api": [],
    "web": "planned",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "A horizontal menubar needs its own keyboard contract.",
    "maturity": "planned",
    "platforms": {
      "web": "planned",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Multiple-thumb slider",
    "layer": "molecule",
    "owner": "@thetechgeeek",
    "refs": [
      "APG"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Slider and SliderThumb compose multiple values using the upstream slots.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Hierarchical tree view",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "APG"
    ],
    "api": [],
    "web": "equivalent",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "VirtualTree uses treegrid semantics and supports hierarchical navigation.",
    "maturity": "equivalent",
    "platforms": {
      "web": "equivalent",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "System permission dialogs",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Apple"
    ],
    "api": [],
    "web": "excluded",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "The operating system controls consent UI and timing. Product code requests access.",
    "maturity": "excluded",
    "platforms": {
      "web": "excluded",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "System notifications",
    "layer": "organism",
    "owner": "@thetechgeeek",
    "refs": [
      "Apple"
    ],
    "api": [],
    "web": "excluded",
    "native": "planned",
    "story": undefined,
    "test": undefined,
    "note": "Use the OS notification service for delivery. NotificationCenter implements the in-app inbox.",
    "maturity": "excluded",
    "platforms": {
      "web": "excluded",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "stateless or host-managed"
  },
  {
    "id": "Mode provider",
    "layer": "infrastructure",
    "owner": "@thetechgeeek",
    "refs": [
      "Roadmap"
    ],
    "api": [
      "modes:ModeProvider"
    ],
    "web": "supported",
    "native": "planned",
    "story": "catalog/mode-provider.stories.tsx",
    "test": "tests/runtime-streams.test.tsx",
    "maturity": "candidate",
    "platforms": {
      "web": "supported",
      "iOS": "planned",
      "Android": "planned"
    },
    "ownership": "caller-owned scoped configuration"
  }
];
