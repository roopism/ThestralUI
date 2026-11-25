# UI ownership and dependency policy

Install the versioned package as a development dependency alongside TypeScript 6. Run the executable from the consumer root.

```sh
ui-lazy-policy check --config ui-policy.json --report ownership-report.json
ui-lazy-policy inspect --config ui-policy.json --report findings-for-review.json
```

The check uses the TypeScript resolver and AST for source roots, JSX hosts, aliased imports and re-exports, component bindings, native controls and runtime dependency edges. A grant identifies one file, component implementation and interaction family. A raw host in any other component is a separate finding. The layer check covers foundations, renderer primitives, compositions and application code. Public package subpaths are explicit. Production code may not import catalog or test code.

The report counts eligible static source sites by source file and family. A direct shared component is adopted. A local flag-aware renderer adapter is bridged. An unmanaged host is raw. A local replacement is a substitute. These counts describe source adoption, not rendered component instances or cohort exposure. Type-only imports are excluded from runtime cycle checks.

A migration exception matches an exact syntax fingerprint including source path, owning symbol, rule, normalized syntax and duplicate occurrence. Its owner, reason and UTC expiry date are mandatory. Changed sites, stale fingerprints and expired exceptions fail the check. Inspect generates findings for review and does not write the baseline. Reviewers should reject scope reductions, bare host wrappers and new owner grants without implementation evidence. Source generated dynamically at runtime requires integration testing.

`ui-policy.json` describes the application scope and the checked-in exception file. The optional inventory path gates changes to eligible usages. Policy configuration, exception edits and inventory changes should receive code-owner review together with the associated behavioral tests.

A reviewed library owner can move between two exact symbols in its family directory. The transition retains the former owner and its exact findings only for the original source digest. The installed checker scans subsequent edits against the new ownership. A retired exception must belong to the named source. Missing replacement files, unrelated raw controls, expired active findings and extra findings fail the ordinary review.
