import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button } from '@ui-lazy-dev/ui-native';
import fixtures from './scenarios/fixtures.cjs';

type FixtureRegistry = typeof fixtures;

export function NativeScenario({ fixture, registry = fixtures }: { fixture: string; registry?: FixtureRegistry }) {
  if (!Object.hasOwn(registry, fixture)) throw new Error('Unknown native scenario fixture ' + fixture);
  return registry[fixture].render();
}

export function ScenarioGallery({ close }: { close: () => void }) {
  const [fixture, setFixture] = useState<string>();
  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
    {fixture ? <NativeScenario fixture={fixture} /> : Object.entries(fixtures).map(([id, entry]) =>
      <Button key={id} testID={'fixture.' + id} label={entry.label} onPress={() => setFixture(id)} />
    )}
    <Button label="Return to workspace" onPress={close} />
  </ScrollView>;
}
