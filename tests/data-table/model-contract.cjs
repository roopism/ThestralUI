const assert = require('node:assert/strict');

/** Run the same behavioral assertions against the independently consumable web and native hooks. */
exports.assertDataTableContract = async function assertDataTableContract(useDataTable, renderHook, act) {
  const rows = [{ id: 't17', title: 'Zeta' }, { id: 't35', title: 'Alpha' }];
  const columns = [{ id: 'title', label: 'Title', value: row => row.title }];
  const pages = [], selections = [], proposals = [];
  const options = { rows, columns, label: 'Records', getRowLabel: row => row.title, pageSize: 1,
    onPageChange: page => pages.push(page), onSelectionChange: ids => selections.push(ids) };
  const handle = await renderHook(props => useDataTable(props), { initialProps: options });
  const model = () => handle.result.current;
  try {
    await act(() => {
      model().select(['t17'], true);
      model().select(['t35'], true);
    });
    assert.deepEqual(model().selectedIds, ['t17', 't35']);
    assert.deepEqual(selections, [['t17'], ['t17', 't35']]);
    await act(() => { model().goToPage(NaN); model().goToPage(Infinity); model().goToPage(0); });
    assert.deepEqual(pages, []);
    await act(() => model().sortBy('title'));
    assert.deepEqual(pages, []);
    assert.deepEqual(model().visible.map(row => row.id), ['t35']);
    await act(() => model().goToPage(1));
    await act(() => model().search('Zeta'));
    assert.deepEqual(pages, [1, 0]);
    assert.equal(model().state.page, 0);
    const state = { query: 'server index match', sort: null, page: 2 };
    const server = { state, totalRows: 7, onStateChange: value => proposals.push(value) };
    await handle.rerender({ ...options, rows: [rows[0]], server, selectedIds: ['elsewhere'] });
    await act(() => { model().select(['t17'], true); model().goToPage(3); model().sortBy('title'); });
    assert.deepEqual(model().state, state);
    assert.deepEqual(model().selectedIds, ['elsewhere']);
    assert.deepEqual(model().visible.map(row => row.id), ['t17']);
    assert.equal(model().pages, 7);
    assert.deepEqual(selections.at(-1), ['elsewhere', 't17']);
    assert.deepEqual(proposals, [{ ...state, page: 3 }, { ...state, sort: { column: 'title', ascending: true }, page: 0 }]);
    // A stale remote page after deletion must still be able to request the new last page.
    await handle.rerender({ ...options, rows: [], server: { ...server, totalRows: 1 }, selectedIds: [] });
    await act(() => model().goToPage(0));
    assert.deepEqual(proposals.at(-1), { ...state, page: 0 });
    const scores = [{ id: 'missing', score: NaN }, { id: 'nine', score: 9 }, { id: 'two', score: 2 }, { id: 'absent', score: NaN }];
    await handle.rerender({ ...options, pageSize: scores.length, rows: scores,
      columns: [{ id: 'score', label: 'Score', value: row => row.score }] });
    await act(() => { model().search(''); model().sortBy('score'); });
    assert.deepEqual(model().visible.map(row => row.id), ['two', 'nine', 'missing', 'absent']);
    await act(() => model().sortBy('score'));
    assert.deepEqual(model().visible.map(row => row.id), ['nine', 'two', 'missing', 'absent']);
  } finally { await handle.unmount(); }
};
