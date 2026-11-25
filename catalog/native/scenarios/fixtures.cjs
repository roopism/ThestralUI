// Node reads the descriptors without loading React Native. Metro resolves the literal
// template imports when the gallery renders the selected fixture.
module.exports = {
  'button.save-once': {
    label: 'Save once example',
    render: () => require('react').createElement(require('./Templates.tsx').SaveOnce),
  },
  'button.pending-once': {
    label: 'Pending once example',
    render: () => require('react').createElement(require('./Templates.tsx').PendingOnce),
  },
  'button.disabled-skip': {
    label: 'Disabled skip example',
    render: () => require('react').createElement(require('./Templates.tsx').DisabledSkip),
  },
  'modal-dialog.minimal': {
    label: 'Minimal dialog example',
    render: () => require('react').createElement(require('./ModalDialog.tsx').MinimalDialog),
  },
  'modal-dialog.workspace': {
    label: 'Workspace review dialog example',
    render: () => require('react').createElement(require('./ModalDialog.tsx').WorkspaceDialog),
  },
  'data-table.queue': {
    label: 'Queue selection and sort',
    render: () => require('react').createElement(require('./DataTable.tsx').Queue),
  },
  'data-table.empty-queue': {
    label: 'Unassigned audit queue',
    render: () => require('react').createElement(require('./DataTable.tsx').EmptyQueue),
  },
  'data-table.edit-queue': {
    label: 'Offline audit editor',
    render: () => require('react').createElement(require('./DataTable.tsx').EditQueue),
  },
  'data-table.work-queue': {
    label: 'Paged audit work queue',
    render: () => require('react').createElement(require('./DataTable.tsx').WorkQueue),
  },
  'stack.child-order': {
    label: 'Child order example',
    render: () => require('react').createElement(require('./Templates.tsx').ChildOrder),
  },
};
