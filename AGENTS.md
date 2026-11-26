# Delivering the library

Read the [frozen library goal](docs/frozen-goal.md) and the [delivery ledger](docs/ui-lazy-dev-state.md) before changing a family. The ledger records the integration commit, measurements, failed attempts and next family.

## Standing rules

1. Run qualification on this Mac and its local Linux guest. Use existing credentials. Creating accounts, installing service identities, changing billing and using hosted CI are outside this process.
2. Reserve `main` for the maintainer's release work. The delivery pipeline must never push to it, create a tag or publish a release.
3. Keep the frozen goal, every registered test, scenario, rule and roster entry, and all numeric ceilings. Style exceptions require an expiry. When a family would require weaker acceptance, enter the evidence under **Owner decisions** and advance to the next family.
4. Record permission denials and continue independent work. A denial stands across credentials, applications and sign-ins.
5. Keep every ref under `refs/uld-archive/`. Before removing a checkout or branch, prove its commits and working changes are reachable from a pushed branch or verified archive ref.
6. Reserve each device separately; the iPhone, Android and Mac functional lanes may run at the same time. Run the two timed stages alone, after every other lane has finished. Shut down the Linux VM and finish all builds and other browser tests before measuring timing.
7. Keep every trial. Repeat an expensive suite only after a specific fix or to answer a recorded diagnostic question. After 15 minutes without clear ownership, write down what passed, what failed and why, then move on.
8. Only new failures block a change. When the same check fails on unchanged `feat/enterprise-ui`, record the test, base commit and evidence path in the ledger. Unrelated changes may proceed. Every change must avoid new or worse failures.
9. When a timing probe, sampling method or count changes, remeasure the reference and its limit in the same commit, on the same device and with the same protocol. Record the old and new values in the ledger.
10. When integration is red, fix its oldest failure before starting features or tooling.
11. After 15 minutes stuck on one blocker, record what passed, what failed and why. Move to the next numbered item in the ledger. Leave side tooling for a separate proposal.
12. Work only from the numbered plan in the ledger. Give each item a clear completion check and propose extra work in the ledger.
13. Record anything that needs the owner under **Owner decisions**. Send one short message listing those decisions and continue with the next unblocked item.

Every standing rule preserves the strength of each test, limit and check.

## Family cycle

Start a short `family/<slug>`, `gates/<topic>` or `docs/<topic>` branch from the latest `feat/enterprise-ui`. Copy only the active family's draft from the archive at `4ce91bcdadd92ff56a791c396e7c03b31b1723e9` or its verified worktree archive. Keep the original variants.

Define a minimal interaction and a realistic combined screen before implementation. Compare the candidate and its parent on the same device, including first use. Preserve packed compatibility aliases, accessibility checks, platform-specific scenarios and the registered performance limits. If both versions fail, identify the owning fixture and retain both results.

Commit the exact change, open a pull request against integration, qualify its merge result and use the landing command. Record the merged commit, tree, timings and pending release evidence. Independent workers may prepare the next two families while the supervisor qualifies the frozen one. Collect shared rule changes in one gate proposal per day.

[Local commands and device reservations](CONTRIBUTING.md) · [Release evidence](docs/enterprise-checklist.md)
