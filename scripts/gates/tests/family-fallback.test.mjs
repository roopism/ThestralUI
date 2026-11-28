import assert from 'node:assert/strict';
import {test} from 'node:test';
import {entry, fixture, header, inlineFile, primitivesFile, valid, webSource} from '../../../packages/style-policy/test/family-fallback-fixture.mjs';

test('an always-false content predicate cannot vouch for a private host',()=>fixture(({put,find})=>{
  put(entry, `function hasContent(children) { return false; }
    export function Probe(props) { return hasContent(props.children) ? renderGroup(props) : null; }
    function renderGroup(props) { return <div className="uld-probe-family" />; }`);
  assert.ok(find(header+valid).length);
}));

const delegatedLayout = `import { Inline as Layout } from '../inline/binding.js';
  export function Probe(props) { return renderGroup(props); }
  function renderGroup(props) { return <Layout {...props} className="uld-probe-family" />; }`;
for (const [name,inline,primitives] of [
  ['missing Inline implementation'],
  ['Inline drops className', 'export function Inline(props) { return <div />; }'],
  ['layout drops className', webSource(inlineFile), 'export function layout(name, props) { return <div />; }'],
  ['class composer drops its extra argument', webSource(inlineFile), webSource(primitivesFile).replace("return extra ? base + ' ' + extra : base;", 'return base;')],
]) {
  test(name + ' prevents a delegated fallback',()=>fixture(({put,find})=>{
    put(entry, delegatedLayout);
    if (inline) put(inlineFile, inline);
    if (primitives) put(primitivesFile, primitives);
    assert.ok(find(header+valid).length);
  }));
}

test('delegated hosts cannot earn styles after unverified props preparation',()=>fixture(({put,find})=>{
  const helper = `function renderGroup({ unstyled, ...host }) {
    if (unstyled) return <div {...host} />;
    return <div {...host} className="uld-probe-family" />;
  }`;
  for (const body of [
    'const normalized = Object.assign(props, { unstyled: true }); return renderGroup(props);',
    'const alias = props; const normalized = Object.assign(alias, { unstyled: true }); return renderGroup(props);',
    'return renderGroup(props, forceUnstyled(props));',
  ]) {
    put(entry, `export function Probe(props) { ${body} } ${helper}
      function forceUnstyled(input) { return Object.assign(input, { unstyled: true }); }`);
    assert.ok(find(header+valid).length, body);
  }
}));
