import React, { useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { Dialog, FormField } from '@ui-lazy-dev/ui-native';
import { Button } from '@ui-lazy-dev/ui-native/button';

function NativeReleaseProbe() {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <View>
      <FormField label="Project title" value={value} onChangeText={setValue} />
      <Button label="Review project" onPress={() => setOpen(true)} motion="press" />
      {open && (
        <Dialog title="Review project" onDismiss={() => setOpen(false)}>
          <Text>{value}</Text>
        </Dialog>
      )}
    </View>
  );
}
AppRegistry.registerComponent('NativeReleaseProbe', () => NativeReleaseProbe);
