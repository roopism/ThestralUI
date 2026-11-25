import React from 'react';
import { AppRegistry } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import Gallery from './catalog/native/Gallery';
import FrameFixture from './FrameFixture';

function AndroidGallery() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={{ flex: 1 }}>
        <Gallery />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent('HelloWorld', () => AndroidGallery);
AppRegistry.registerComponent('AndroidFrameFixture', () => FrameFixture);
