const React = require('react');
const RN = require('react-native');
const { act, fireEvent, render, renderHook } = require('@testing-library/react-native');
const { DataTable, useDataTable } = require('@ui-lazy-dev/ui-native/data-table');
const { Queue, WorkQueue } = require('../../catalog/native/scenarios/DataTable.tsx');

const records = [{ id: 'g', title: 'Gamma', score: 9 }, { id: 'b', title: 'Beta', score: 11 }, { id: 'a', title: 'Alpha', score: 2 }];
const columns = [{ id: 'title', label: 'Name', value: r => r.title }, { id: 'score', label: 'Score', value: r => r.score }];
const options = { label: 'Cases', getRowLabel: r => r.title, rows: records, columns, pageSize: 2 };
const h = React.createElement;
const press = async (s, role, name) => fireEvent.press(s.getByRole(role, { name }));
const checkbox = (s, name) => s.getByRole('checkbox', { name });
afterEach(() => jest.restoreAllMocks());

test('native queue sorts real cells; the accessible checkbox and mixed page state track selection', async () => {
  const s = await render(h(Queue));
  const order = () => s.getAllByRole('text').map(n => n.props.children).filter(x => ['Gamma','Beta','Alpha'].includes(x));
  expect(order()).toEqual(['Gamma','Beta','Alpha']);
  await press(s, 'button', 'Name');
  expect(order()).toEqual(['Alpha','Beta','Gamma']);
  await press(s, 'checkbox', 'Select Beta');
  expect(checkbox(s, 'Select Beta')).toBeChecked();
  expect(checkbox(s, 'Select page').props.accessibilityState.checked).toBe('mixed');
  expect(s.getByText('1 selected')).toBeVisible();
  await press(s, 'checkbox', 'Select page');
  expect(checkbox(s, 'Select page')).toBeChecked();
  await press(s, 'checkbox', 'Select page');
  expect(checkbox(s, 'Select page')).not.toBeChecked();
  expect(s.getByRole('button', { name: 'Archive selected' })).toBeDisabled();
});

test('archives the exact off-page and current records from the phone work queue', async () => {
  const s = await render(h(WorkQueue));
  await press(s, 'checkbox', 'Select Atlas audit');
  await press(s, 'button', 'Next page');
  expect(s.queryByLabelText('Select Atlas audit')).toBeNull();
  await press(s, 'checkbox', 'Select Cedar audit');
  expect(s.getByText('2 selected')).toBeVisible();
  await press(s, 'button', 'Archive selected');
  expect(s.getByText('Archived 2 records')).toBeVisible();
  expect(s.queryByLabelText('Select Atlas audit')).toBeNull();
  expect(s.queryByLabelText('Select Cedar audit')).toBeNull();
  expect(checkbox(s, 'Select Birch audit')).not.toBeChecked();
  expect(s.getByText('Page 1 of 1')).toBeVisible();
});

test('a server page is authoritative even if its rows do not match the local query or sort', async () => {
  const onStateChange = jest.fn(), onSelectionChange = jest.fn();
  const state = { query: 'other', sort: { column:'title', ascending: true }, page: 2 };
  const s = await render(h(DataTable, { ...options, rows: [records[1]], server: { state, totalRows: 25, onStateChange },
    selectedIds: ['off-page'], onSelectionChange, bulkAction:{ label:'Archive', onApply(){} } }));
  expect(checkbox(s, 'Select Beta')).toBeVisible();
  expect(s.getByText('Page 3 of 13')).toBeVisible();
  await press(s, 'checkbox', 'Select Beta');
  expect(onSelectionChange).toHaveBeenLastCalledWith(['off-page','b']);
  expect(checkbox(s, 'Select Beta')).not.toBeChecked();
  await press(s, 'button', 'Score');
  expect(onStateChange).toHaveBeenLastCalledWith({ ...state, sort: { column: 'score', ascending: true }, page: 0 });
  await fireEvent.changeText(s.getByLabelText('Search records'), '日本');
  expect(onStateChange).toHaveBeenLastCalledWith({ ...state, query:'日本', page:0 });
});

test('headless local sorting, search and page bounds respect numbers and permanently removed IDs', async () => {
  const { result, rerender } = await renderHook(props => useDataTable(props), { initialProps: options });
  await act(() => result.current.sortBy('score'));
  expect(result.current.visible.map(x => x.id)).toEqual(['a','g']);
  await act(() => result.current.select(['b','invented'], true));
  expect(result.current.selectedIds).toEqual(['b']);
  await act(() => result.current.goToPage(9));
  expect(result.current.state.page).toBe(1);
  await rerender({ ...options, rows: [records[0]] });
  expect(result.current.state.page).toBe(0);
  await rerender(options);
  expect(result.current.selectedIds).toEqual([]);
  await act(() => result.current.search('BETA'));
  expect(result.current.visible.map(x => x.id)).toEqual(['b']);
});

test('failed edits retain the draft, block duplicate and pending actions, and permit a successful retry or cancel', async () => {
  let reject, resolve;
  const onEdit = jest.fn()
    .mockImplementationOnce(() => new Promise((_r, fail) => { reject = fail; }))
    .mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const editName = 'Edit Name, Gamma';
  const s = await render(h(DataTable, { ...options, rows:[records[0]], columns:[{ ...columns[0], onEdit }] }));
  await press(s, 'button', editName);
  const input = () => s.getByDisplayValue('Gamma!');
  await fireEvent.changeText(s.getByDisplayValue('Gamma'), 'Gamma!');
  const save = s.getByRole('button', { name:'Save' });
  await fireEvent.press(save);
  await fireEvent(input(), 'submitEditing');
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onEdit).toHaveBeenLastCalledWith(records[0], 'Gamma!');
  expect(input().props.editable).toBe(false);
  expect(s.getByRole('button', { name:'Cancel' })).toBeDisabled();
  await act(async () => reject(Error('offline')));
  expect(s.getByRole('alert')).toHaveTextContent('Could not save changes. Try again.');
  expect(input().props.editable).toBe(true);
  await press(s, 'button', 'Save');
  await act(async () => resolve());
  expect(s.getByRole('button', { name: editName })).toBeVisible();
  await press(s, 'button', editName);
  await fireEvent.changeText(s.getByDisplayValue('Gamma'), 'abandoned');
  await press(s, 'button', 'Cancel');
  expect(s.queryByDisplayValue('abandoned')).toBeNull();
  expect(onEdit).toHaveBeenCalledTimes(2);
});

test('a narrow screen summarizes the record and discloses all named fields, wide screens show them directly', async () => {
  const dimensions = jest.spyOn(RN, 'useWindowDimensions');
  dimensions.mockReturnValue({ width:390, height:840, scale:2, fontScale:1 });
  const s = await render(h(DataTable, { ...options, rows:[records[0]], unstyled:true,
    labels:{ details: name => 'تفاصيل ' + name }, style:{margin:7} }));
  expect(s.queryByText('9')).toBeNull();
  await press(s, 'button', 'تفاصيل Gamma');
  expect(s.getByText('9')).toBeVisible();
  expect(RN.StyleSheet.flatten(s.getByTestId('data-table.root').props.style)).toEqual({ margin:7 });
  dimensions.mockReturnValue({ width:1000, height:1280, scale:2, fontScale:1 });
  await s.rerender(h(DataTable, { ...options, rows:[records[0]], testID:'wide' }));
  expect(s.queryByRole('button', { name:'Details, Gamma' })).toBeNull();
  expect(s.getByTestId('wide.cell.g.score')).toHaveTextContent('9');
});

test('the native public hook obeys the shared paging, batched selection and controlled veto contract', async () => {
  const { assertDataTableContract } = require('./model-contract.cjs');
  await assertDataTableContract(useDataTable, renderHook, act);
});

test('paging keeps a native cell locked until its previous save settles', async () => {
  let reject;
  const onEdit = jest.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const editScore = jest.fn();
  const s = await render(h(DataTable, { ...options, layout: 'table', pageSize: 1,
    columns: [{ ...columns[0], onEdit }, { ...columns[1], onEdit: editScore }] }));
  const click = name => press(s, 'button', name);
  await click('Edit Name, Gamma');
  await click('Save');
  await click('Next page');
  await click('Edit Name, Beta');
  await click('Cancel');
  await click('Previous page');
  await click('Edit Score, Gamma');
  await click('Save');
  expect(editScore).toHaveBeenCalledTimes(1);
  await click('Edit Name, Gamma');
  const duplicate = s.queryByRole('button', { name: 'Save' });
  if (duplicate) await fireEvent.press(duplicate);
  expect(onEdit).toHaveBeenCalledTimes(1);
  await act(async () => reject(Error('offline')));
  await click('Edit Name, Gamma');
  await click('Save');
  expect(onEdit).toHaveBeenCalledTimes(2);
});

test('bulk rejection keeps the selection, prevents duplicate submissions and reports the caller’s retry error', async () => {
  let reject;
  const onApply = jest.fn().mockImplementationOnce(() => new Promise((_, r) => { reject = r; })).mockResolvedValueOnce();
  const optionsWithBulk = { ...options, rows:[records[0]], columns:[columns[0]], bulkAction:{label:'Apply',onApply},
    error:h(React.Fragment, null, []), labels:{bulkFailed:'Retry sync'} };
  const s = await render(h(DataTable, optionsWithBulk));
  expect(s.queryByRole('alert')).toBeNull();
  await press(s,'checkbox','Select Gamma');
  await press(s,'button','Apply');
  expect(s.getByRole('button',{name:'Apply'})).toBeDisabled();
  expect(checkbox(s,'Select Gamma')).toBeDisabled();
  await press(s,'button','Apply');
  expect(onApply).toHaveBeenCalledTimes(1);
  await act(async () => reject(Error('network')));
  expect(s.getByRole('alert')).toHaveTextContent('Retry sync');
  expect(checkbox(s,'Select Gamma')).toBeChecked();
  await press(s,'button','Apply');
  expect(onApply.mock.calls).toEqual([[['g']],[['g']]]);
  await s.rerender(h(DataTable, {...optionsWithBulk, disabled:true}));
  expect(s.getByLabelText('Search records')).toBeDisabled();
  expect(s.getByRole('button',{name:'Name'})).toBeDisabled();
});

test('every gallery scroll view containing the active editor forwards the first keyboard-open action', async () => {
  const { ScenarioGallery } = require('../../catalog/native/ScenarioGallery.tsx');
  const fixtures = require('../../catalog/native/scenarios/fixtures.cjs');
  const screen = await render(h(ScenarioGallery, { close: jest.fn() }));
  await press(screen, 'button', fixtures['data-table.edit-queue'].label);
  await press(screen, 'button', 'Edit Title, Atlas audit');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  const policies = [];
  for (let node = screen.getByRole('button', { name: 'Save' }); node; node = node.parent) {
    if (typeof node.type === 'string' && /ScrollView/.test(node.type)) policies.push(node.props.keyboardShouldPersistTaps);
  }
  expect(policies.length).toBeGreaterThanOrEqual(2);
  expect(policies).toEqual(policies.map(() => 'handled'));
});

test('removing the focused native cell returns focus to the stable table viewport', async () => {
  const send = jest.spyOn(RN.AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {});
  const props = { ...options, columns: [{ ...columns[0], onEdit() {} }], testID: 'queue' };
  for (const editing of [false, true]) {
    for (const focused of [true, false]) {
      const s = await render(h(DataTable, props));
      const trigger = s.getByRole('button', { name: 'Edit Name, Gamma' });
      if (editing) await fireEvent.press(trigger);
      const control = editing ? s.getByLabelText('Edit Name, Gamma') : trigger;
      await fireEvent(control, 'focus');
      if (!focused) await fireEvent(control, 'blur');
      send.mockClear();
      await s.rerender(h(DataTable, { ...props, rows: records.slice(1) }));
      expect(s.queryByLabelText('Edit Name, Gamma')).toBeNull();
      if (focused) expect(send).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ testID: 'queue.viewport' }) }), 'focus');
      else expect(send).not.toHaveBeenCalled();
      await s.unmount();
    }
  }
});

test('Assigned work shows only matching tickets before switching to unassigned work', async () => {
  const { EmptyQueue } = require('../../catalog/native/scenarios/DataTable.tsx');
  const screen = await render(h(EmptyQueue));
  for (const title of ['Atlas audit', 'Birch audit', 'Cedar audit']) {
    expect(screen.getByText(title)).toBeVisible();
  }
  await fireEvent.changeText(screen.getByLabelText('Search records'), 'Cedar');
  expect(screen.getByText('Cedar audit')).toBeVisible();
  expect(screen.queryByText('Atlas audit')).toBeNull();
  expect(screen.queryByText('Birch audit')).toBeNull();
  await press(screen, 'button', 'Show unassigned');
  expect(screen.getByText('No matching records')).toBeVisible();
  expect(screen.queryByText('Cedar audit')).toBeNull();
});
