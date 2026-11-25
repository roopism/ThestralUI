# Enterprise qualification

Read the [standing delivery rules](../AGENTS.md), [check inventory](enterprise-check-inventory.md) and [family specifications](components/). Record evidence for the exact commit and Git tree.

1. Verify source ownership, dependency layers, styles, generated outputs, test registration and the strengthen-only comparison with integration. Build the packages, type-check the full project and inspect the registered unit, browser and visual cases.
2. Install the packed archives and validate each published specification, including compatibility aliases. Exercise the minimum and maximum supported consumers. Record all affected named root imports, subpaths, styles and the default application size.
3. Run the portable scenarios, browser behavior, accessibility and visual comparisons in all registered Mac engines. Run Linux browser behavior on the local Ubuntu guest. Match discovered and executed cases to the checked-in rosters.
4. Run native journeys on the iPhone and both Android profiles. The iPhone omission requires proof that every changed input is web-only. For shared inputs, unknown paths, harness changes and release qualification, use the full native roster. Shut down the guest and isolate each timing trial. Keep failures, environment versions and measurements. Low-end Android may reuse all passing timing trials from the integration base when every app entry name and content hash matches under the documented signature exclusions. Record both signed APK file hashes, the entry-manifest hash and the source receipt. Run all selected functional scenarios on this tree.
5. Verify the receipt, land the pull request, and compare GitHub's merged tree with the qualified tree. Update the ledger with the commit, timings and deferred release evidence.

Use `npm run qualify -- --release` for the full committed-tree run. A local qualification receipt covers the automated suites it lists. Physical-device testing, assistive-technology walkthroughs, native performance comparisons and production evidence retain their separate status in the [ledger](ui-lazy-dev-state.md).

For the current exported and experimental family counts, run `npm run build:packages` and `node scripts/inventory.mjs`. The packed specification audit reports its own denominator and violations. The broader inventory also includes planned and excluded entries.
