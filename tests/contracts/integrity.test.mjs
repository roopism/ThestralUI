import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSource, checkMatrix} from '../../packages/policy/quality/integrity.mjs';
test('required matrix rejects zero, skipped, ignored failures and missing engines',()=>{
 const rows=['chromium','firefox','webkit'].map(engine=>({engine,passed:1,skipped:0,failed:0,flaky:0}));
 assert.doesNotThrow(()=>checkMatrix(rows,['chromium','firefox','webkit']));
 assert.throws(()=>checkMatrix([{...rows[0],failed:1}, ...rows.slice(1)], ['chromium','firefox','webkit']), /matrix/i);
 for(const changed of [[...rows.slice(1)], [{...rows[0],passed:0},...rows.slice(1)], [{...rows[0],skipped:1},...rows.slice(1)], [{...rows[0],flaky:1},...rows.slice(1)]]) assert.throws(()=>checkMatrix(changed,['chromium','firefox','webkit']),/matrix/i);
});
test('production renderers reject credential logging, network access and HTML injection',()=>{
 const file='packages/web/src/dialog.tsx';
 assert.deepEqual(checkSource(file,'export const C = ({label}) => <span>{label}</span>;'),[]);
 for(const code of ['console.log(secret)','window.fetch(url)','const body=<div dangerouslySetInnerHTML={data}/>','navigator.sendBeacon(url,data)','const ws = new WebSocket(url)']) assert.ok(checkSource(file,code).length>0,code);
 // Parse these fragments as data. No API is invoked and no module is loaded.
 for (const fragment of [
   'interface Host { "sendBeacon": never }',
   'declare const unused: typeof eval;',
   'declare const unused: typeof Function;',
   'function inspect(name: never) { return import(name); }',
 ]) assert.ok(checkSource(file, fragment).length > 0, fragment);
 assert.deepEqual(checkSource(file, 'export const label = "console";'), []);
});

test('neutral browser reports require every contract ID per engine and reject skipped examples', async () => {
  const { validateScenarioReport } = await import('../../packages/policy/quality/browser-matrix.mjs');
  const projects = ['chromium', 'firefox', 'webkit'];
  const ids = ['button.save-once', 'stack.child-order'];
  const report = { errors: [], suites: [{ title: 'scenarios.spec.ts', specs: ids.map(title => ({
    title, tests: projects.map(projectName => ({
      projectName, expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed' }],
    })),
  })) }] };
  validateScenarioReport(report, ids, projects);
  const skipped = structuredClone(report);
  skipped.suites[0].specs[1].tests[2].status = 'skipped';
  assert.throws(() => validateScenarioReport(skipped, ids, projects), /matrix/);
  report.suites[0].specs[0].tests.pop();
  assert.throws(() => validateScenarioReport(report, ids, projects), /Every selected neutral scenario/);
});
