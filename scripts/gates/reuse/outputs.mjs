import assert from 'node:assert/strict';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sha256 } from './store.mjs';
import { readArtifact, storeArtifact } from '../../build-cache/artifact-cache.mjs';

function roots(group) {
  if (group === 'Typed and unit rosters') return ['packages/tokens/dist','packages/web/dist','packages/native/dist','release/evidence'];
  if (group === 'Catalog build') return ['dist/catalog'];
  if (group === 'Native package consumer') return ['release/evidence/native-consumers.json'];
  if (group === 'Packed consumers min' || group === 'Packed consumers max') {
    const range = group.endsWith('max') ? 'max' : 'min';
    const paths = ['sbom','licenses','compatibility'].map(name=>'release/evidence/'+range+'-'+name+'.json');
    if (range==='max') paths.push('release/evidence/bundles.json','release/evidence/default-transfer.json');
    return paths;
  }
  return [];
}

export function captureOutputs(directory,snapshot,group) {
  const outputs = [];
  function collect(path) {
    const file = join(snapshot,path);
    const stat = lstatSync(file);
    if (stat.isDirectory()) {
      for (const child of readdirSync(file).sort()) collect(path+'/'+child);
      return;
    }
    assert.ok(stat.isFile() && !stat.isSymbolicLink());
    const bytes = readFileSync(file), sha = sha256(bytes);
    const common = dirname(directory);
    if (!readArtifact(common,sha)) assert.equal(storeArtifact(common,bytes),sha);
    outputs.push({path,mode:stat.mode & 0o777,sha});
  }
  for (const prefix of roots(group)) collect(prefix);
  return outputs;
}

// Materialize and authenticate every file off to the side before exposing a producer to a consumer.
export function restoreOutputs(directory,snapshot,group,outputs) {
  const prefixes = roots(group);
  const seen = new Set();
  const scratch = mkdtempSync(join(snapshot,'.git','reuse-outputs-'));
  try {
    for (const item of outputs) {
      assert.deepEqual(Object.keys(item).sort(),['mode','path','sha']);
      assert.ok(item.path.split('/').every(part=>part && part!=='.' && part!=='..'));
      assert.ok(prefixes.some(prefix=>item.path===prefix || item.path.startsWith(prefix+'/')));
      assert.ok(!seen.has(item.path));
      seen.add(item.path);
      assert.ok(Number.isInteger(item.mode) && item.mode>=0 && item.mode<=0o777);
      const bytes = readArtifact(dirname(directory),item.sha);
      assert.ok(bytes,'Missing or corrupt producer output');
      const out = join(scratch,item.path);
      mkdirSync(dirname(out),{recursive:true});
      writeFileSync(out,bytes,{flag:'wx',mode:item.mode});
      chmodSync(out,item.mode);
    }
    for (const prefix of prefixes) {
      const src = join(scratch,prefix), dest = join(snapshot,prefix);
      assert.ok(existsSync(src),'Incomplete producer outputs for '+prefix);
      mkdirSync(dirname(dest),{recursive:true});
      assert.equal(realpathSync(dirname(dest)),join(realpathSync(snapshot),dirname(prefix)));
      assert.ok(!existsSync(dest),'Producer destination already populated: '+prefix);
    }
    const restored = [];
    try {
      for (const prefix of prefixes) {
        renameSync(join(scratch,prefix),join(snapshot,prefix));
        restored.push(prefix);
      }
    } catch (error) {
      for (const prefix of restored) renameSync(join(snapshot,prefix),join(scratch,prefix));
      throw error;
    }
  } finally { rmSync(scratch,{force:true,recursive:true}); }
}
