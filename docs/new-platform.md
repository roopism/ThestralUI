# Implementing a platform binding

1. Read the family contract and identify its slots, states, input behavior, tokens and scenarios. Choose native controls that expose the specified actions. Record platform differences under the binding in the spec. [Role mapping](role-mapping.md)
2. Consume the platform's resolved semantic tokens from the matching release. Preserve the selected mode and platform unit conversions. In the absence of a verified token artifact, record that dependency in the binding.
3. Implement the same initial fixture and consume the checked-in scenario file. Run each step against a fresh fixture through the platform's accessibility and user interaction APIs. A fixture-only pass tests the adapter. Component coverage requires the actual public binding. [Scenario format](scenarios.md)
4. Exercise the binding in the intended runtime and verify keyboard or touch behavior, reading order, localized names, motion preferences and optional slot geometry. Record the runtime and any outstanding device and assistive-technology checks in the family spec.
5. Declare the platform and the actual measured coverage when integrating the implementation. Keep any exclusion reason next to the family contract.
