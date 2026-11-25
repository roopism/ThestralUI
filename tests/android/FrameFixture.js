import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@ui-lazy-dev/ui-native';

export default function FrameFixture() {
  const [count, setCount] = useState(0);
  return (
    <View style={styles.screen}>
      <Button
        label="Review item"
        testID="frame-review"
        motion="press"
        onPress={() => setCount((c) => c + 1)}
      />
      <Text testID="frame-count">Reviewed {count}</Text>
      <ScrollView testID="frame-scroll">
        {Array.from({ length: 120 }, (_, index) => (
          <Text key={index} testID={'frame-row-' + index} style={styles.row}>
            Inventory item {index + 1}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 48, paddingHorizontal: 12, paddingBottom: 32 },
  row: { paddingVertical: 10, fontSize: 16 },
});
