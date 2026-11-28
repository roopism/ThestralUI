# Library-owned messages

The following inventory covers visible and accessibility copy in the web and native component sources at `e11f3e5`. Each key identifies one complete translatable message. Command Palette uses the catalog matching its locale. Explicit component labels take precedence. Data Table and Batch Progress accept caller-supplied labels.

| Message key | English message | Binding source |
| --- | --- | --- |
| `dataTable.search` | Search records | [data-table/binding.tsx:11](../packages/web/src/data-table/binding.tsx#L11) |
| `dataTable.viewport` | Table contents | [Data Table web binding](../packages/web/src/data-table/binding.tsx) |
| `dataTable.selectPage` | Select page | [data-table/binding.tsx:12](../packages/web/src/data-table/binding.tsx#L12) |
| `dataTable.previousPage` | Previous page | [data-table/binding.tsx:13](../packages/web/src/data-table/binding.tsx#L13) |
| `dataTable.nextPage` | Next page | [data-table/binding.tsx:14](../packages/web/src/data-table/binding.tsx#L14) |
| `dataTable.empty` | No matching records | [data-table/binding.tsx:15](../packages/web/src/data-table/binding.tsx#L15) |
| `dataTable.cancel` | Cancel | [data-table/binding.tsx:16](../packages/web/src/data-table/binding.tsx#L16) |
| `dataTable.save` | Save | [data-table/binding.tsx:17](../packages/web/src/data-table/binding.tsx#L17) |
| `dataTable.saveFailed` | Could not save changes. Try again. | [data-table/binding.tsx:18](../packages/web/src/data-table/binding.tsx#L18) |
| `dataTable.select` | Select {name} | [data-table/binding.tsx:19](../packages/web/src/data-table/binding.tsx#L19) |
| `dataTable.edit` | Edit {column}, {name} | [data-table/binding.tsx:20](../packages/web/src/data-table/binding.tsx#L20) |
| `dataTable.page` | Page {current} of {total} | [data-table/binding.tsx:21](../packages/web/src/data-table/binding.tsx#L21) |
| `dataTable.selected` | {count} selected | [data-table/binding.tsx:22](../packages/web/src/data-table/binding.tsx#L22) |
| `dataTable.loading` | Loading records | [Data Table web binding](../packages/web/src/data-table/binding.tsx) |
| `dataTable.bulkFailed` | Could not apply changes. Try again. | [Data Table web binding](../packages/web/src/data-table/binding.tsx) |
| `dataTable.details` | Details, {name} | [Data Table native binding](../packages/native/src/data-table/binding.tsx) |
| `dataTable.ascending` | Ascending | [Data Table native binding](../packages/native/src/data-table/binding.tsx) |
| `dataTable.descending` | Descending | [Data Table native binding](../packages/native/src/data-table/binding.tsx) |
| `wizard.back` | Back | [form-wizard/binding.tsx:77](../packages/web/src/form-wizard/binding.tsx#L77) |
| `wizard.finish` | Finish | [form-wizard/binding.tsx:81](../packages/web/src/form-wizard/binding.tsx#L81) |
| `wizard.next` | Next | [form-wizard/binding.tsx:81](../packages/web/src/form-wizard/binding.tsx#L81) |
| `commandPalette.search` | Search commands | [command-palette/binding.tsx:65](../packages/web/src/command-palette/binding.tsx#L65) |
| `commandPalette.empty` | No matching commands | [command-palette/binding.tsx:110](../packages/web/src/command-palette/binding.tsx#L110) |
| `commandPalette.close` | Close | [command-palette/binding.tsx:112](../packages/web/src/command-palette/binding.tsx#L112) |
| `recordList.empty` | No records | [record-selection/binding.tsx:22](../packages/web/src/record-selection/binding.tsx#L22) |
| `notificationCenter.empty` | No notifications | [notification-center/binding.tsx:39](../packages/web/src/notification-center/binding.tsx#L39) |
| `notificationCenter.readAll` | Mark all as read | [notification-center/binding.tsx:44](../packages/web/src/notification-center/binding.tsx#L44) |
| `notificationCenter.read` | Read | [notification-center/binding.tsx:53](../packages/web/src/notification-center/binding.tsx#L53) |
| `notificationCenter.unread` | Unread | [notification-center/binding.tsx:53](../packages/web/src/notification-center/binding.tsx#L53) |
| `notificationCenter.markRead` | Mark {title} as read | [notification-center/binding.tsx:59](../packages/web/src/notification-center/binding.tsx#L59) |
| `batch.queued` | Queued | [batch-progress/binding.tsx:24](../packages/web/src/batch-progress/binding.tsx#L24) |
| `batch.running` | In progress | [batch-progress/binding.tsx:25](../packages/web/src/batch-progress/binding.tsx#L25) |
| `batch.complete` | Completed | [batch-progress/binding.tsx:26](../packages/web/src/batch-progress/binding.tsx#L26) |
| `batch.failed` | Failed | [batch-progress/binding.tsx:27](../packages/web/src/batch-progress/binding.tsx#L27) |
| `batch.denied` | Permission denied | [batch-progress/binding.tsx:28](../packages/web/src/batch-progress/binding.tsx#L28) |
| `batch.empty` | No operations | [batch-progress/binding.tsx:41](../packages/web/src/batch-progress/binding.tsx#L41) |
| `batch.summary` | {terminal} of {total} finished | [batch-progress/binding.tsx:47](../packages/web/src/batch-progress/binding.tsx#L47) |
| `batch.retry` | Retry {name} | [batch-progress/binding.tsx:61](../packages/web/src/batch-progress/binding.tsx#L61) |
| `settings.empty` | No settings available | [settings/binding.tsx:53](../packages/web/src/settings/binding.tsx#L53) |

The table’s page-selection checkbox selects every visible record on the current page. The batch summary counts each terminal outcome, including failed and denied operations. Translations preserve those distinctions.

Native Data Table accepts caller overrides for built-in English labels. Other native bindings take their labels, hints and errors from the caller. The web bindings also accept caller-owned titles, field labels, dismiss actions and formatted values. Decorative sort arrows, the tree chevron and the checkbox check mark carry their meaning through state semantics. The CodeField argument error is a developer diagnostic. None of these supply a translatable default message.

### Catalogs

Each JSON file contains only messages keyed by their stable IDs. The locale index records the direction, key completeness and review status. [Locale index](../packages/messages/locales.json) Named placeholders can move within the translation. Format `current`, `total`, `terminal` and `count` with the active locale’s number formatter. Keep caller text such as `name`, `title` and `column` intact and isolate it bidirectionally when interpolating mixed-direction content.

| Locale | Key coverage | Translation status |
| --- | --- | --- |
| [en](../packages/messages/locales/en.json) | 38 / 38 (100%) | English source |
| [ar](../packages/messages/locales/ar.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [he](../packages/messages/locales/he.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [ja](../packages/messages/locales/ja.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [zh-Hans](../packages/messages/locales/zh-Hans.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [hi](../packages/messages/locales/hi.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [de](../packages/messages/locales/de.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [fr](../packages/messages/locales/fr.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [es](../packages/messages/locales/es.json) | 38 / 38 (100%) | Draft translation, awaiting language review |
| [pt-BR](../packages/messages/locales/pt-BR.json) | 38 / 38 (100%) | Draft translation, awaiting language review |

Coverage measures keys and required placeholders against the English source. Command Palette renders the selected catalog synchronously on Node. In a browser ESM build with code splitting, English is available immediately and each other language loads on first use. If its chunk cannot load, the palette uses caller labels or English for the rest of that page session. A single-file browser build embeds the catalogs. After editing a catalog, run `node packages/messages/renderer.mjs --write`. The catalog coverage test checks both renderers against the generated source. Data Table uses its locale for searching and sorting on web and native. It accepts translated labels through its `labels` prop. Batch Progress also accepts explicit label and formatting callbacks. A missing or malformed locale falls back to English.
