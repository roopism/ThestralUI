import { useRef, useState, type ComponentRef } from 'react';
import type { Pressable } from 'react-native';
import { Button, Dialog, FormField } from '@ui-lazy-dev/ui-native';
import { ScenarioSurface, ScenarioText } from './presentation';

export function MinimalDialog() {
  const [open, setOpen] = useState(false);
  const opener = useRef<ComponentRef<typeof Pressable>>(null);
  return <ScenarioSurface>
    <Button ref={opener} testID="scenario.button.Open dialog" label="Open dialog" onPress={() => setOpen(true)} />
    {open ? <Dialog title="Change review" testID="minimal-dialog" dismissOnBackdrop returnFocusRef={opener}
      onDismiss={() => setOpen(false)}
      actions={<Button testID="scenario.button.Close dialog" label="Close dialog" onPress={() => setOpen(false)} />}>
      <ScenarioText testID="scenario.text.Review changes">Review changes</ScenarioText>
    </Dialog> : <ScenarioText testID="scenario.text.Dialog closed">Dialog closed</ScenarioText>}
  </ScenarioSurface>;
}

export function WorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [review, setReview] = useState('Quarterly plan');
  const [resumed, setResumed] = useState(false);
  const [archived, setArchived] = useState(false);
  const [archiveNote, setArchiveNote] = useState('');
  const opener = useRef<ComponentRef<typeof Pressable>>(null);
  const detailOpener = useRef<ComponentRef<typeof Pressable>>(null);

  function closeWorkspace() {
    setDetails(false);
    setOpen(false);
    setResumed(true);
  }

  return <ScenarioSurface>
    {archived ? <>
      <FormField autoFocus label="Archive note" testID="archive-note-input"
        value={archiveNote} onChangeText={setArchiveNote} />
      <ScenarioText testID="archive-note-result">{archiveNote}</ScenarioText>
    </> : <Button ref={opener} testID="scenario.button.Review changes" label="Review changes" onPress={() => setOpen(true)} />}
    {resumed && <ScenarioText testID="scenario.text.Workspace resumed">Workspace resumed</ScenarioText>}
    <ScenarioText testID="workspace-review-note">{review}</ScenarioText>
    {open && <Dialog title="Workspace review" testID="workspace-review-dialog" onDismiss={closeWorkspace}
      returnFocusRef={opener} actions={<>
        <Button ref={detailOpener} testID="scenario.button.Review details" label="Review details" onPress={() => setDetails(true)} />
        <Button testID="archive-review-link" label="Archive review link" onPress={() => {
          setArchived(true);
          closeWorkspace();
        }} />
        <Button testID="scenario.button.Back to workspace" label="Back to workspace" onPress={closeWorkspace} />
      </>}>
      <ScenarioText testID="scenario.text.Review draft">Review draft</ScenarioText>
      <FormField testID="review-draft-input" label="Draft note" value={review} onChangeText={setReview} />
      {details && <Dialog title="Confirm discard" testID="review-details-dialog" onDismiss={() => setDetails(false)}
        returnFocusRef={detailOpener} actions={<Button testID="scenario.button.Keep editing"
          label="Keep editing" onPress={() => setDetails(false)} />}>
        <ScenarioText testID="scenario.text.Discard draft?">Discard draft?</ScenarioText>
      </Dialog>}
    </Dialog>}
  </ScenarioSurface>;
}
