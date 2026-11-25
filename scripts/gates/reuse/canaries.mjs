import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { appFingerprint, gitInputs, treeFingerprint } from './fingerprint.mjs';
import { reuseDecision } from './policy.mjs';
import { decideRow, rowIdentity } from './runner.mjs';
import { selectAudit } from './audit.mjs';
import { macCommand } from './sandbox-mac.mjs';
import { linuxCommand } from './sandbox-linux.mjs';

export function reuseCanaries() {
  // Linux grants system tools access to /tmp. Put its input fixture in a separate home subdirectory.
  const root = realpathSync(mkdtempSync(join(process.platform === 'linux' ? homedir() : tmpdir(),'uld-reuse-check-')));
  try {
    const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git('init','--quiet','--template=');
    mkdirSync(join(root,'docs'));
    mkdirSync(join(root,'scripts/gates'),{recursive:true});
    const excluded = join(root,'docs','note.md');
    writeFileSync(excluded,'first');
    writeFileSync(join(root,'scripts/gates/fixture.mjs'),'export const setting = 1;\n');
    writeFileSync(join(root,'component.txt'),'first');
    git('add','--all');
    const base = git('write-tree'), groupId = 'Catalog build';
    const envFacts = {node:process.version};
    const treeKey = (tree,facts = envFacts) => treeFingerprint({root,tree,base,groupId,envFacts:facts,exclude:['docs/**']});
    const appKey = tree => appFingerprint({root,tree,base,groupId:'iPhone Simulator',appManifests:{
      ios:{fileSha256:'01'.repeat(32),manifestSha256:'02'.repeat(32)}},deviceImage:{runtime:'test'},
      scope:{families:null,iphone:true},envFacts});
    const unchanged = treeKey(base), app = appKey(base);
    mkdirSync(join(root,'tests/acceptance'),{recursive:true});
    writeFileSync(join(root,'tests/acceptance/suite-inputs.json'),JSON.stringify({contractVersion:1,groups:{}}));
    git('add','tests/acceptance/suite-inputs.json');
    const noGroup=git('write-tree');
    assert.throws(()=>rowIdentity({root,snapshot:root,tree:noGroup,base},'Unregistered check'));
    assert.equal(decideRow({},'Unregistered check',null).reuse,false);
    git('read-tree',base);
    writeFileSync(excluded,'second');git('add','docs/note.md');
    const docsTree = git('write-tree');
    assert.equal(treeKey(docsTree),unchanged);
    writeFileSync(join(root,'component.txt'),'second');git('add','component.txt');
    assert.notEqual(treeKey(git('write-tree')),unchanged);
    assert.notEqual(treeKey(base,{node:'different version'}),unchanged);
    git('read-tree',base);
    writeFileSync(join(root,'scripts/gates/fixture.mjs'),'export const setting = 2;\n');git('add','scripts/gates/fixture.mjs');
    const pipeline = git('write-tree');
    assert.ok(gitInputs(root,pipeline,base).pipelineChanged);
    assert.notEqual(treeKey(pipeline),treeKey(docsTree));
    assert.notEqual(appKey(pipeline),app);
    const now = Date.now(), record = {result:'passed',groupId,createdAt:new Date(now).toISOString(),retries:0};
    const candidate = {mode:'qualification',groupId,reusable:true,record,freshHistory:['passed'],audit:false,now};
    assert.ok(reuseDecision(candidate).reuse);
    for (const name of ['Fast','No weakening','Mac browser performance'])
      assert.equal(reuseDecision({...candidate,groupId:name,record:{...record,groupId:name}}).reuse,false);
    assert.equal(reuseDecision({...candidate,mode:'release'}).reuse,false);
    assert.equal(reuseDecision({...candidate,reusable:undefined}).reuse,false);
    assert.equal(reuseDecision({...candidate,record:{...record,retries:1}}).reuse,false);
    assert.equal(reuseDecision({...candidate,now:now+72*60*60*1000}).reuse,false);
    const chosen = selectAudit([groupId],'a1'.repeat(32));
    assert.equal(chosen,groupId);
    assert.equal(reuseDecision({...candidate,audit:chosen===groupId}).reuse,false);
    const command = process.platform === 'linux' ? linuxCommand : macCommand;
    const check = file => {
      const wrapped = command({root,exclude:['docs/**'],command:process.execPath,args:['-e',
        "process.stdout.write(require('node:fs').readFileSync(process.argv[1]))",file]});
      return spawnSync(wrapped.command,wrapped.args,{cwd:root,encoding:'utf8'});
    };
    const allowed = check(join(root,'component.txt'));
    assert.equal(allowed.status,0,allowed.stderr);assert.equal(allowed.stdout,readFileSync(join(root,'component.txt'),'utf8'));
    const forbidden = check(excluded);
    assert.notEqual(forbidden.status,0);
    assert.match(forbidden.stderr,/EPERM|EACCES/);
    assert.ok(forbidden.stderr.includes(excluded),'Sandbox denial must name the excluded input');
  } finally { rmSync(root,{recursive:true,force:true}); }
}

if (import.meta.main) { reuseCanaries(); console.log('Result reuse canaries passed.'); }
