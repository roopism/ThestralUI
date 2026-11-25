import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@ui-lazy-dev/ui-native';

export function SaveOnce() {
  const [saves, setSaves] = useState(0);
  return <View>
    <Button testID="scenario.button.Save" label="Save" onPress={() => setSaves((count) => count + 1)} />
    {saves > 0 && <Text testID="scenario.text.Saved once">{saves === 1 ? 'Saved once' : 'Saved ' + saves + ' times'}</Text>}
  </View>;
}

export function PendingOnce() {
  const [saves, setSaves] = useState(0);
  return <View>
    <Button testID="scenario.button.Save" label="Save" busy={saves > 0} onPress={() => setSaves((count) => count + 1)} />
    {saves > 0 && <Text testID="scenario.text.Saved once">{saves === 1 ? 'Saved once' : 'Saved ' + saves + ' times'}</Text>}
  </View>;
}

export function DisabledSkip() {
  const [archived, setArchived] = useState(false);
  return <View>
    <Button testID="scenario.button.Archive" label="Archive" disabled onPress={() => setArchived(true)} />
    <Text testID={archived ? 'scenario.text.Archived' : 'scenario.text.Not archived'}>{archived ? 'Archived' : 'Not archived'}</Text>
  </View>;
}

export function ChildOrder() {
  // This checks the adapter until Stack is available from the native package.
  return <View>
    <Text testID="scenario.text.First">First</Text>
    <Text testID="scenario.text.Second">Second</Text>
  </View>;
}
