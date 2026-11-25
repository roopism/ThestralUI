import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  AppState,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Button, Dialog, FormField, IconButton } from '@ui-lazy-dev/ui-native';
import { tokens } from '@ui-lazy-dev/tokens';
import { ScenarioGallery } from './ScenarioGallery';

export default function Gallery() {
  const [showScenarios, setShowScenarios] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [resumed, setResumed] = useState(false);
  const inFlight = useRef(false);
  const { fontScale } = useWindowDimensions();
  const dark = useColorScheme() === 'dark';
  const statusStyle = { color: dark ? tokens.dark.text : tokens.light.text };
  useEffect(() => {
    let backgrounded = false;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgrounded = true;
      if (state === 'active' && backgrounded) setResumed(true);
    });
    return () => subscription.remove();
  }, []);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const colors = dark ? tokens.dark : tokens.light;
  function review() {
    if (!name.trim()) {
      setError('Enter a workspace name');
      input.current?.focus();
      return;
    }
    setError('');
    input.current?.blur();
    setConfirming(true);
  }
  function beginSave() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setAttempts((previous) => previous + 1);
  }
  function finishSave(success: boolean) {
    if (!inFlight.current) return;
    inFlight.current = false;
    if (success) setSaved(name.trim());
    else setError('Save failed. Your draft is still editable.');
    setSaving(false);
    setConfirming(false);
  }
  if (showScenarios) return <ScenarioGallery close={() => setShowScenarios(false)} />;
  return (
    <ScrollView
      testID="workspace-screen"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <Button testID="open-scenarios" label="Component scenarios" onPress={() => setShowScenarios(true)} />
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28 }}>
        Workspace settings
      </Text>
      <FormField
        ref={input}
        testID="workspace-name"
        label="Workspace name"
        hint="Shown in your workspace"
        error={error}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError('');
        }}
        returnKeyType="done"
        onSubmitEditing={review}
      />
      <Button testID="workspace-review" label="Review changes" motion="press" onPress={review} />
      {saved ? (
        <Text
          testID="workspace-saved"
          accessibilityLiveRegion="polite"
          style={{ color: colors.text }}
        >
          Saved {saved}
        </Text>
      ) : null}
      <Text testID="workspace-appearance" style={statusStyle}>
        {dark ? 'Dark appearance' : 'Light appearance'}
      </Text>
      <Text testID="workspace-scale" style={statusStyle}>
        {fontScale > 1.3 ? 'Enlarged text' : 'Standard text'}
      </Text>
      <IconButton
        testID="workspace-help"
        label="Workspace name help"
        size="sm"
        tone="secondary"
        icon={<Text style={statusStyle}>?</Text>}
        onPress={() => setHelpOpen((open) => !open)}
      />
      {helpOpen && <Text style={statusStyle}>Choose a name your team will recognize.</Text>}
      {resumed && (
        <Text testID="workspace-resumed" style={statusStyle}>
          Resumed workspace
        </Text>
      )}
      {confirming ? (
        <Dialog
          testID="workspace-confirmation"
          title="Save workspace?"
          onDismiss={() => {
            if (!inFlight.current) setConfirming(false);
          }}
        >
          <Text testID="workspace-draft" style={{ color: colors.text }}>
            {name}
          </Text>
          <View style={{ gap: tokens.size.gap }}>
            <Button
              testID="workspace-cancel"
              label="Keep editing"
              tone="secondary"
              disabled={saving}
              onPress={() => setConfirming(false)}
            />
            <Button
              testID="workspace-save"
              label="Save changes"
              busy={saving}
              onPress={beginSave}
            />
            <Text testID="workspace-pending" accessibilityLiveRegion="polite" style={statusStyle}>
              {saving ? 'Saving request ' + attempts : 'Ready to save'}
            </Text>
            <Button
              testID="workspace-finish"
              label="Finish save"
              disabled={!saving}
              onPress={() => finishSave(true)}
            />
            <Button
              testID="workspace-fail"
              label="Fail save"
              disabled={!saving}
              tone="secondary"
              onPress={() => finishSave(false)}
            />
          </View>
        </Dialog>
      ) : null}
    </ScrollView>
  );
}
