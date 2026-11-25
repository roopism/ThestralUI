# Native scenario fixtures

Create a component in this directory and register its fixture ID, menu label and render function in `fixtures.cjs`. The ID combines the neutral family slug and the scenario's `fixture` field. Use a literal `require` inside the render function so Metro can bundle the component and Node can read the registry without loading React Native.

The gallery lists every registered fixture. The native renderer and iPhone adapter load the neutral documents for registered families and run every scenario in them. A missing fixture, unused registration, unknown step or unsupported role fails the run. The Stack example exercises an adapter fixture until the native package exports Stack.

Run renderer scenarios with `npm run test:native -- --runTestsByPath tests/native/scenarios.test.cjs`. The staged simulator gate installs the packed gallery and executes the same scenarios with Maestro. Its `ios-simulator.json` records the completed scenario IDs alongside the three profile journeys.
