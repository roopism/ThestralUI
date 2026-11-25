import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createMutationControls } from './mutation-controls.mjs';

const source = dirname(fileURLToPath(import.meta.url));
const operators = new Map([['===','!=='],['!==','==='],['==','!='],['!=','=='],
  ['<','>='],['>=','<'],['>','<='],['<=','>']]);
const assertions = new Map([['equal','notEqual'],['notEqual','equal'],['deepEqual','notDeepEqual'],
  ['match','doesNotMatch'],['notDeepEqual','deepEqual'],['doesNotMatch','match']]);
const digest = text => createHash('sha256').update(text).digest('hex');

// The report declares the complete, deterministic fault model. Mutants are never sampled
// or removed because they survive. Environment and dependency implementation are outside scope.
const faults = {
  'comparison complement':'All equality and order comparisons.',
  'boundary shift':'Each ordered comparison, inclusive versus exclusive.',
  'logical connective':'Every && and || binary expression.',
  'logical negation':'Every prefix ! expression.',
  'timing arithmetic':'All binary age, TTL and history-order arithmetic.',
  'assertion complement':'Every supported assert method, reversing its predicate.',
  'verdict inversion':'Every literal reuse verdict.',
  'missing return':'Every non-null value returned by a named exported function.',
  'missing validation':'Every validate or validateFacts call.',
  'missing evidence check':'Every assertion that authenticates file bytes, a Git receipt seal or a producer object.',
  'missing publication':'Every store writeFileSync or renameSync invocation.',
  'direct publication':'Every store temporary lookup write redirected to its final name.',
  'uninterrupted direct write':'Every consecutive store write-and-rename replaced by a single ordinary write to the final lookup name.',
};
const outside = [
  'Dependency implementations, Git and filesystem process failures outside the named store operations',
  'Regex, literal string, number, object key, diagnostic message, namespace and option rewriting',
  'Boolean literals outside reuse verdicts, ternary swaps, optional chaining, nullish fallback, collection method and loop transformations',
  'Unary operations except !, arithmetic outside the named sites, bitwise, assignment and update operators',
  'Arbitrary block/statement deletion outside the validation and publication model',
  'General arithmetic outside age, TTL and history sorting, including memory buffer sizing',
  'Equivalent survivors remain in the denominator; these are bounded mutation scores, not stock Stryker scores.',
];
function mutations(file, text) {
  const program = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  assert.equal(program.parseDiagnostics.length,0);
  const changes = [];
  function add(node, replacement, type) {
    const start = node.getStart(program);
    changes.push({type,line:program.getLineAndCharacterOfPosition(start).line+1,start,end:node.end,
      original:text.slice(start,node.end),replacement});
  }
  function visit(node) {
    if (ts.isBlock(node) && basename(file)==='store.mjs') {
      for (const [i,statement] of node.statements.entries()) {
        const next=node.statements[i+1];
        if (!ts.isExpressionStatement(statement) || !next || !ts.isExpressionStatement(next)) continue;
        const write=statement.expression, rename=next.expression;
        if (ts.isCallExpression(write) && ts.isCallExpression(rename) &&
            write.expression.getText(program)==='writeFileSync' && rename.expression.getText(program)==='renameSync' &&
            write.arguments[0].getText(program)===rename.arguments[0].getText(program)) {
          const start=statement.getStart(program);
          changes.push({type:'uninterrupted direct write',line:program.getLineAndCharacterOfPosition(start).line+1,
            start,end:next.end,original:text.slice(start,next.end),replacement:
              'writeFileSync('+rename.arguments[1].getText(program)+','+write.arguments[1].getText(program)+');'});
        }
      }
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.getText(program);
      if (operators.has(op)) add(node.operatorToken,operators.get(op),'comparison complement');
      const edges = {'<':'<=','<=':'<','>':'>=','>=':'>'};
      if (op in edges) add(node.operatorToken,edges[op],'boundary shift');
      if (op === '&&' || op === '||') add(node.operatorToken,op==='&&'?'||':'&&','logical connective');
      if ((basename(file)==='policy.mjs' && ['-','*'].includes(op)) ||
          (basename(file)==='store.mjs' && op==='-' && node.left.getText(program)==='b.started'))
        add(node.operatorToken,op==='-'?'+':'/','timing arithmetic');
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator===ts.SyntaxKind.ExclamationToken)
      add(node,node.operand.getText(program),'logical negation');
    if (ts.isReturnStatement(node) && node.expression && node.expression.kind!==ts.SyntaxKind.NullKeyword) {
      let parent = node.parent;
      while (parent && !ts.isFunctionLike(parent)) parent=parent.parent;
      if (parent && ts.isFunctionDeclaration(parent) && parent.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))
        add(node.expression,'null','missing return');
    }
    if (ts.isCallExpression(node)) {
      const name=node.expression.getText(program);
      if (['validate','validateFacts'].includes(name)) add(node,'void 0','missing validation');
      if (basename(file)==='store.mjs' && ['writeFileSync','renameSync'].includes(name))
        add(node,'void 0','missing publication');
      if (basename(file)==='store.mjs' && name==='writeFileSync' && node.arguments[0].getText(program)==='temp')
        add(node.arguments[0],'target','direct publication');
      if (basename(file)==='store.mjs' && name.startsWith('assert.') &&
          /(?:sha256\(|retained\.equals\(|readArtifact\()/.test(node.arguments[0]?.getText(program) ?? ''))
        add(node,'void 0','missing evidence check');
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(program) === 'assert') {
      const name = node.expression.name.text;
      if (assertions.has(name)) add(node.expression.name,assertions.get(name),'assertion complement');
      if (name === 'ok') add(node.arguments[0],'!(' + node.arguments[0].getText(program) + ')','assertion complement');
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(program) === 'reuse' &&
        [ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword].includes(node.initializer.kind))
      add(node.initializer,node.initializer.kind === ts.SyntaxKind.TrueKeyword ? 'false' : 'true','verdict inversion');
    ts.forEachChild(node,visit);
  }
  visit(program);
  assert.ok(changes.length,'No mutation sites in ' + file);
  return changes;
}

// Tests can use normal imports, including import.meta.url-relative configuration. Only the selected
// module's source bytes change inside this single test process. The checkout and receipts stay intact.
const loader = `import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
registerHooks({load(url,context,next){
  if(url!==process.env.ULD_MUTATION_URL)return next(url,context);
  writeFileSync(process.env.ULD_MUTATION_HIT,'loaded');
  return {format:'module',source:readFileSync(process.env.ULD_MUTATION_SOURCE,'utf8'),shortCircuit:true};
}});`;

export async function runMutations(output) {
  const root = dirname(dirname(dirname(source)));
  const folder = mkdtempSync(join(tmpdir(),'uld-reuse-mutants-'));
  const hook = join(folder,'hook.mjs'), changed = join(folder,'mutant.mjs'), hit = join(folder,'hit');
  const testFile = join(root,'scripts/gates/tests/reuse-store.test.mjs');
  const suite = ['--test','--test-reporter=tap',testFile];
  const report = {schema:2,status:'running',operators:faults,outsideModel:outside,
    runnerSha256:digest(readFileSync(fileURLToPath(import.meta.url))),
    testSha256:digest(readFileSync(testFile)),directedControlsSha256:digest(readFileSync(join(source,'mutation-controls.mjs'))),modules:{}};
  const save = () => writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  try {
    writeFileSync(hook,loader);
    const quick = createMutationControls(folder,await import('./store.mjs'),await import('./outputs.mjs'));
    let generation = 0;
    for (const name of ['policy','store','fingerprint']) {
      const file=join(source,name+'.mjs'), raw=readFileSync(file,'utf8');
      const probes=mutations(file,raw);
      const data = {sha256:digest(raw),total:probes.length,passedControls:false,killed:0,survived:0,mutants:[]};
      report.modules[name]=data;
      function registeredTests(content) {
        writeFileSync(changed,content);
        rmSync(hit,{force:true});
        const env={...process.env,ULD_MUTATION_URL:pathToFileURL(realpathSync(file)).href,
          ULD_MUTATION_SOURCE:changed,ULD_MUTATION_HIT:hit};
        const run=spawnSync(process.execPath,['--import',hook,...suite],{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024});
        if (run.error) throw run.error;
        assert.ok(!run.signal && existsSync(hit),'Mutation module never exercised: '+name+' '+(run.signal??run.stderr));
        const count=Number(/^# tests (\d+)$/m.exec(run.stdout)?.[1]);
        assert.ok(count>0,'No completed tests: '+run.stderr+' '+run.stdout.slice(-500));
        const failures=[...run.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(match=>match[1]);
        assert.equal(run.status===0,failures.length===0,'Mutation test harness failed');
        return {count,killed:run.status!==0,failures};
      }
      async function quickTest(content) {
        const url = pathToFileURL(file).href+'?reuse-mutation='+generation++;
        const hook = registerHooks({ load(request, context, next) {
          return request === url ? {format:'module',source:content,shortCircuit:true} : next(request,context);
        }});
        let api;
        try { api=await import(url); } finally { hook.deregister(); }
        try { quick[name](api); return null; }
        catch (error) { return 'Directed '+name+' control: '+error.message.slice(0,250); }
      }
      assert.equal(await quickTest(raw),null,'Unmodified module failed directed controls');
      const control=registeredTests(raw);
      assert.ok(!control.killed,'Unmodified '+name+' failed: '+control.failures.join(', '));
      data.passedControls=true;data.registeredCount=control.count;save();
      for (const probe of probes) {
        const content=raw.slice(0,probe.start)+probe.replacement+raw.slice(probe.end);
        const failure=await quickTest(content);
        const result=failure ? {killed:true,failures:[failure]} : registeredTests(content);
        if (!failure) assert.equal(result.count,control.count,'Mutant changed test discovery');
        data[result.killed?'killed':'survived']++;
        data.mutants.push({...probe,killed:result.killed,failures:result.failures,
          ...(result.killed ? {} : {reason:'The directed controls and every registered test accepted this mutation.'})});
        save();
      }
      assert.equal(await quickTest(raw),null,'Mutants changed shared fixture state');
      data.score=100*data.killed/data.total;
      save();
    }
    report.status=Object.entries(report.modules).every(([name,data])=>data.score>=(name==='fingerprint'?95:100))?'passed':'failed';
    save();
    for (const [name,data] of Object.entries(report.modules))
      assert.ok(data.score >= (name==='fingerprint'?95:100), name+' mutation score '+data.score+'%');
  } finally { rmSync(folder,{recursive:true,force:true}); }
  return report;
}

if (import.meta.main) {
  const output=process.argv[2];
  assert.ok(output,'Expected the path for the mutation report');
  const summary=await runMutations(resolve(output));
  for(const [name,row] of Object.entries(summary.modules)) console.log(name,row.killed+'/'+row.total,row.score+'%');
}
