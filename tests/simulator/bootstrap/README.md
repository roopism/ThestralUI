# Simulator bootstrap

The first policy commits needed an iPhone workflow before the staged tree included its own simulator runner. The bootstrap driver builds the staged native and token packages, verifies their archive digests, then installs those archives into the frozen test gallery. It selects five actions by their accessible labels so it can exercise older Button implementations.

Use Node 22.23.2 in the library checkout. To build and inspect the candidate without starting a simulator, run:

```sh
node scripts/bootstrap-ios.mjs prepare
```

Use `node scripts/bootstrap-ios.mjs qualify` to run the three iPhone journeys. The checked-in manifest pins the harness files. The driver writes the archives, execution record and any simulator results below `release/bootstrap-ios/` and prints the run directory. Current release candidates use the regular simulator verification script. [Current simulator runner](../../../scripts/verify-ios-simulator.mjs)

The four archived records retain their original run identifiers and contents. One run prepared archives, one failed before collecting its simulator report, and two passed all three journeys. The archive digest in each record identifies the package bytes checked in that run. [Frozen harness manifest](harness/manifest.json) · [Historical run records](records/)
