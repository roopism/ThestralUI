const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Android resource prefixes and accessible labels resolve one ordered neutral fixture target', async () => {
  const { inAccessibilityOrder } = await import('../simulator/scenarios.mjs');
  const target = (name) => ({ role: 'text', name });
  const item = (id, name) => ({ attributes: { 'resource-id': id, 'content-desc': name } });
  const first = item('org.uilazydev.qualification:id/scenario.text.First', 'First');
  const second = item('scenario.text.Second', 'Second');
  assert.deepEqual(
    inAccessibilityOrder(
      { children: [second, first] },
      [target('First'), target('Second')],
      'android',
    ),
    [1, 0],
  );
  assert.throws(
    () => inAccessibilityOrder({ children: [first, first] }, [target('First')], 'android'),
    /Expected one/,
  );
  assert.throws(
    () =>
      inAccessibilityOrder(
        { children: [item('scenario.text.First', 'First decoy')] },
        [target('First')],
        'android',
      ),
    /Expected one/,
  );
});

test('Android semantic probes require the native class, name, enabled and focused states on one host', async () => {
  const { accessibilityNodes, target } = await import('../android/tree.mjs');
  const xml =
    '<hierarchy><node resource-id="example:id/save" class="android.widget.Button" content-desc="Save" enabled="false" focused="true" /></hierarchy>';
  const nodes = accessibilityNodes(xml);
  const expected = { role: 'Button', name: 'Save', enabled: false, focused: true };
  assert.equal(target(nodes, 'save', expected).class, 'android.widget.Button');
  for (const mismatch of [
    { name: 'Save draft' },
    { role: 'TextView' },
    { enabled: true },
    { focused: false },
  ])
    assert.throws(() => target(nodes, 'save', { ...expected, ...mismatch }));
  assert.throws(() => target([...nodes, ...nodes], 'save', expected), /unique/);
  const { verifyAndroidBusyButton } = await import('../simulator/scenarios.mjs');
  const busy = { ...nodes[0], 'resource-id': 'scenario.button.Save', 'content-desc': 'Save, busy', focusable: 'true' };
  verifyAndroidBusyButton([busy], 'Save');
  for (const override of [
    { 'content-desc': 'Save' }, { 'content-desc': 'Save later, busy' }, { enabled: 'true' },
    { focusable: 'false' }, { class: 'android.widget.TextView' }, { 'resource-id': 'impostor' },
  ]) assert.throws(() => verifyAndroidBusyButton([{ ...busy, ...override }], 'Save'));
});

test('Android Back requires an observed hidden keyboard across both input method dump formats', async () => {
  const { keyboardVisible } = await import('../android/interaction.mjs');
  for (const field of ['mInputShown', 'isInputViewShown()']) {
    assert.equal(keyboardVisible(field + '=true'), true);
    assert.equal(keyboardVisible(field + '=false'), false);
  }
  assert.equal(keyboardVisible('mInputShown=false\nisInputViewShown()=true'), true);
  assert.throws(() => keyboardVisible('Input method service unavailable'), /Missing Android/);
});

test('Android low-end budgets reject missing input samples, flagged frames, and a single over-limit metric', async () => {
  const { summarize, enforceBudget } = await import('../android/frame-budget.mjs');
  const header = 'Flags,IntendedVsync,FrameDeadline,FrameCompleted';
  const frame = (i, flag) => [flag, 1 + i * 1e8, 1 + i * 1e8 + 17e6, 1 + i * 1e8 + 20e6].join(',');
  const section = (rows) =>
    '---PROFILEDATA---\n' + header + '\n' + rows.join('\n') + '\n---PROFILEDATA---';
  const rows = Array.from({ length: 22 }, (_, i) => frame(i, i < 20 ? 0 : 1));
  const events = 'inputToFrameCommitNs=15000000\n'.repeat(10);
  const result = summarize(section(rows), events);
  assert.equal(result.frames, 20);
  assert.equal(result.p95FrameMs, 20);
  assert.equal(result.p95InputToCommitMs, 15);
  assert.equal(result.deadlineMissFraction, 1);
  assert.throws(() => summarize(section(rows), ''), /Insufficient input/);
  assert.throws(() => summarize(section(rows.slice(-2)), events), /Insufficient rendered/);
  for (const field of ['p95FrameMs', 'p95InputToCommitMs', 'deadlineMissFraction'])
    assert.throws(
      () => enforceBudget(result, { ...result, [field]: result[field] - 0.01 }),
      /exceeds/,
    );
});

test('Android qualification rejects missing or duplicate profiles, unexecuted journeys and missing low-end measurements', async () => {
  const { requireBothProfiles, requireCompletedProfiles } =
    await import('../android/qualification.mjs');
  const flows = ['appearance.yaml', 'workspace.yaml'];
  const names = ['appearance-dark', 'workspace-light', 'appearance-light'];
  const scenarios = ['button.save-once', 'stack.child-order'];
  const sample = {
    frames: 50,
    inputs: 15,
    p95FrameMs: 20,
    deadlineMissFraction: 0.05,
    p95InputToCommitMs: 28,
  };
  const measured = {
    ...sample,
    inputs: sample.inputs * 3,
    frames: sample.frames * 3,
    trials: [sample, sample, sample],
  };
  const limits = { press: sample, scroll: sample };
  const standard = {
    id: 'standard',
    passed: names,
    scenarioIds: scenarios,
    interaction: { heldPixels: 300 },
  };
  const lowEnd = { ...standard, id: 'low-end', frameBudget: { press: measured, scroll: measured } };
  for (const profiles of [
    [],
    [standard],
    [lowEnd],
    [standard, standard],
    [lowEnd, lowEnd],
    [standard, lowEnd, lowEnd],
  ]) {
    assert.throws(() => requireBothProfiles(profiles), /exactly one/);
  }
  const verify = (profiles) => requireCompletedProfiles(profiles, flows, scenarios, limits);
  verify([lowEnd, standard]);
  for (const journey of ['press', 'scroll']) {
    for (const metric of ['p95FrameMs', 'deadlineMissFraction', 'p95InputToCommitMs']) {
      for (const index of [0, 1, 2]) {
        const trials = measured.trials.map((trial, i) => i === index ? { ...trial, [metric]: limits[journey][metric] + 0.001 } : trial);
        const bad = { ...lowEnd, frameBudget: { ...lowEnd.frameBudget, [journey]: { ...measured, trials } } };
        assert.throws(() => verify([standard, bad]), {
          code: 'android/frame-budget',
          message: new RegExp(journey + ' trial ' + (index + 1) + ' ' + metric),
        });
      }
      const wrongMedian = { ...lowEnd, frameBudget: { ...lowEnd.frameBudget,
        [journey]: { ...measured, [metric]: measured[metric] / 2 } } };
      assert.throws(() => verify([standard, wrongMedian]), new RegExp('measured median for ' + metric));
    }
  }
  assert.throws(
    () => verify([lowEnd, { ...standard, passed: names.slice(1) }]),
    /every Android journey/,
  );
  assert.throws(() => verify([standard, { ...lowEnd, scenarioIds: [] }]), /registered scenario/);
  assert.throws(
    () => verify([standard, { ...lowEnd, frameBudget: { press: measured } }]),
    /Missing low-end/,
  );
  assert.throws(
    () =>
      verify([
        standard,
        { ...lowEnd, frameBudget: { press: measured, scroll: { ...measured, p95FrameMs: 21 } } },
      ]),
    /exceeds/,
  );
});

test('native checkbox semantic probes reject impostors, ambiguous names, disabled activation and incorrect state on both platforms', async () => {
  const { verifyNativeCheckbox } = await import('../simulator/scenarios.mjs');
  const name = 'Select audit', id = 'scenario.checkbox.' + name;
  const a = { 'resource-id': id, 'content-desc': name, class: 'android.widget.CheckBox', checkable: 'true', checked: 'false', enabled: 'true' };
  const i = { 'resource-id': id, accessibilityText: name, value: 'checkbox, unchecked', enabled: 'true' };
  const ios = (...nodes) => ({children:nodes.map(attributes => ({attributes}))});
  for (const [state, android] of [['unchecked',a], ['checked',{...a, checked:'true'}], ['mixed',{...a, 'content-desc': name + ', mixed', checkable:'false'}]]) {
    assert.equal(verifyNativeCheckbox([android], 'android', name, {state, enabled:true}), state);
    assert.equal(verifyNativeCheckbox(ios({...i,value:'checkbox, ' + state}), 'ios', name, {state, enabled:true}), state);
  }
  for (const override of [{class:'android.widget.Button'},{checkable:'false'},{enabled:'false'},{'content-desc':name + ' 2'},{'resource-id':'another'}])
    assert.throws(() => verifyNativeCheckbox([{...a,...override}], 'android', name, {enabled:true}));
  for (const override of [{value:'button, unchecked'},{value:'unchecked'},{value:'checkbox'},{enabled:'false'},{accessibilityText:name + ' 2'},{'resource-id':'another'}])
    assert.throws(() => verifyNativeCheckbox(ios({...i,...override}), 'ios', name, {enabled:true}));
  assert.throws(() => verifyNativeCheckbox([a,a], 'android', name));
  assert.throws(() => verifyNativeCheckbox(ios(i,i), 'ios', name));
  assert.throws(() => verifyNativeCheckbox([a], 'android', name, {state:'checked'}));
  assert.throws(() => verifyNativeCheckbox(ios(i), 'ios', name, {state:'mixed'}));
});
