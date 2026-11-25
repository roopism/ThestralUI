import { SequentialDialogs } from './legacy-fixtures';
import { KeyboardReview, MinimalDialog, WorkspaceDialog } from '../../catalog/modal-dialog/Review';
export { MinimalDialog, WorkspaceDialog };
// The accept-any-editor slot must also contain a browser-native editing host that has no tabIndex.
function ContentEditableReview() {
  return <KeyboardReview editor={<div contentEditable role="textbox" aria-label="Reviewer notes" />} />;
}
export const fixtures = { minimal: MinimalDialog, workspace: WorkspaceDialog, 'keyboard-contenteditable': ContentEditableReview, 'sequential-dialogs': SequentialDialogs };
