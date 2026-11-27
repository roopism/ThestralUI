import { buildImportGraph } from '../../selection/import-graph.mjs';
import { moduleInputs } from '../reuse/suite-closure.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { appIdentity } from '../reuse/app-identity.mjs';
import { environmentFacts } from '../reuse/environment.mjs';
import { linuxCommand } from '../reuse/sandbox-linux.mjs';
import { macCommand } from '../reuse/sandbox-mac.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const project = fileURLToPath(new URL('../../../', import.meta.url));
const matrix = JSON.parse(readFileSync(join(project, 'tests/acceptance/suite-inputs.json')));

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'uld-reuse-input-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function put(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

test('reuse inputs enroll all groups and preserve documentation consumed by scenarios and specifications', () => {
  assert.equal(matrix.contractVersion, 1);
  assert.equal(Object.keys(matrix.groups).length, 18);
  assert.deepEqual(Object.keys(matrix.groups).filter(name => !matrix.groups[name].reusable),
    ['No weakening', 'Fast', 'Mac browser performance']);
  for (const [name, value] of Object.entries(matrix.groups)) {
    assert.equal(value.reusable, value.mode !== 'never', name);
    assert.ok(value.exclude.every(pattern => ['docs/**', '*.md'].includes(pattern)), name);
    if (['Typed and unit rosters', 'Packed component specifications', 'Portable web scenarios', 'Linux browser behavior'].includes(name))
      assert.ok(!value.exclude.includes('docs/**'), name);
    if (value.mode === 'app') assert.deepEqual(value.exclude, []);
  }
  for (const fact of ['macos-build', 'hardware-model', 'gpu', 'display-scale', 'fonts'])
    assert.ok(matrix.groups['Mac visual comparisons'].envFacts.includes(fact));
});

test('environment identities are deterministic and unavailable facts cannot stand in for measurements', t => {
  const root = fixture(t);
  put(join(root, 'package-lock.json'), '{}');
  const values = {
    'xcodebuild -version': 'Xcode 26\nBuild version 17A',
    '/usr/bin/sw_vers -buildVersion': '25A123',
    '/usr/sbin/sysctl -n hw.model': 'Model20,1',
    '/usr/sbin/system_profiler SPDisplaysDataType -json': JSON.stringify({SPDisplaysDataType:[{sppci_model:'GPU'}]}),
    '/usr/sbin/system_profiler SPFontsDataType -json': JSON.stringify({SPFontsDataType:[{_name:'Foo',typefaces:[{_name:'Foo',version:'2'}]}]}),
    'xcrun simctl list runtimes --json': JSON.stringify({runtimes:[{isAvailable:true,identifier:'com.apple.iOS-26',buildversion:'B1'}]}),
    'xcrun simctl list devices available --json': JSON.stringify({devices:{'com.apple.iOS-26':[
      {udid:process.env.UI_SIMULATOR_ID || 'test-id',name:'iPhone 17',deviceTypeIdentifier:'type',isAvailable:true,state:'Shutdown'}]}}),
    'maestro-fixture --version':'2.0',
  };
  const run = (command,args) => {
    if (command === process.execPath) return '[["chromium","123"]]';
    if (command === '/usr/bin/osascript') return '[2]';
    assert.ok(values[command+' '+args.join(' ')]);
    return values[command+' '+args.join(' ')];
  };
  const facts = ['node','playwright-browsers','gpu','hardware-model','xcode','ios-runtime','macos-build','lockfile','display-scale','fonts','maestro'];
  const context={root,run,maestro:'maestro-fixture'};
  const observed = environmentFacts(facts,context);
  assert.deepEqual(observed,environmentFacts([...facts].reverse(),context));
  assert.ok(Object.values(observed).every(v => v !== 'unavailable'));
  assert.equal(observed.lockfile,hash('{}'));
  assert.match(observed['ios-runtime'],/B1/);
  assert.match(observed.fonts,/^[0-9a-f]{64}$/);
  values['/usr/sbin/system_profiler SPFontsDataType -json']='{}';
  assert.deepEqual(environmentFacts(['fonts','new-fact'],context),{fonts:'unavailable','new-fact':'unavailable'});
  assert.equal(environmentFacts(['xcode'],{root,run:()=>{throw Error('tool absent');}}).xcode,'unavailable');
});

test('guest facts require live image identity and the matching installed dependency lock', t => {
  const root=fixture(t); put(join(root,'package-lock.json'),'locked');
  const ids=['vm-image','node','fonts','playwright-browsers'];
  const guest={image:{uuid:'8E1A0BED-BE5C-4A3C-9814-6543FB229DB7',sha256:hash('image')},lockfile:hash('locked'),
    node:'v22.23.2/linux/arm64',fonts:hash('guest-font'),browsers:'three guest browsers'};
  let boots=0;
  const run=(command,args,options)=>{
    if (args[0]==='status') return 'started';
    if (args[0]==='ip-address') return '192.0.2.1';
    assert.equal(command,'ssh');
    assert.ok(args.includes('ForwardAgent=no') && args.includes('StrictHostKeyChecking=yes'));
    assert.match(options.input,/\/etc\/uld-image\.json/);
    boots++;
    return JSON.stringify(guest);
  };
  const context={root,groupId:'Linux browser behavior',run};
  assert.deepEqual(environmentFacts(ids,context),{
    fonts:guest.fonts,node:guest.node,'playwright-browsers':guest.browsers,'vm-image':guest.image.sha256});
  assert.equal(boots,1);
  put(join(root,'package-lock.json'),'changed');
  assert.ok(Object.values(environmentFacts(ids,context)).every(value=>value==='unavailable'));
  assert.equal(environmentFacts(['vm-image'],{...context,run:()=> 'stopped'})['vm-image'],'unavailable');
});

test('Android environment observations bind both profiles and the installed image contents', t => {
  const root=fixture(t), sdk=join(root,'sdk'), abi=process.arch==='arm64'?'arm64-v8a':'x86_64';
  const profiles=JSON.parse(readFileSync(join(project,'tests/android/profiles.json')));
  put(join(root,'tests/android/profiles.json'), JSON.stringify(profiles));
  const directories=profiles.profiles.map(profile => join(sdk,'system-images',
    profile.platform??profiles.platform,profile.image??profiles.image,abi));
  for (const directory of directories) {
    put(join(directory,'build.prop'),'ro.system.build.fingerprint=observed/synthetic/one\n');
    for(const file of ['system.img','vendor.img','kernel-ranchu','ramdisk.img','source.properties']) put(join(directory,file),file);
  }
  const read=()=>environmentFacts(['android-system-image'],{root,androidSdk:sdk})['android-system-image'];
  const first=read();
  assert.deepEqual(JSON.parse(first).map(([id])=>id),['low-end','standard']);
  assert.ok(JSON.parse(first).every(([, row])=>row.includes('observed/synthetic/one')));
  put(join(directories[1],'system.img'),'changed');const second=read();assert.notEqual(second,first);
  put(join(directories[0],'kernel-ranchu'),'another kernel');assert.notEqual(read(),second);
  rmSync(join(directories[0],'build.prop'));assert.equal(read(),'unavailable');
});

test('Mac exclusions prohibit direct and inherited reads and empty exclusions preserve the command', t => {
  const root=fixture(t), doc=join(root,'docs','sample'), markdown=join(root,'ROOT.md'), nested=join(root,'allowed','nested.md');
  for(const path of [doc,markdown,nested])put(path,'sample');
  const run=(exclude,path,child=false)=>{
    const read="process.stdout.write(require('node:fs').readFileSync(process.argv[1]))";
    const code=child?"require('node:child_process').execFileSync(process.execPath,['-e',process.argv[1],process.argv[2]],{stdio:'inherit'})":read;
    const args=child?['-e',code,read,path]:['-e',code,path];
    const wrapped=macCommand({root,exclude,command:process.execPath,args});
    if(!exclude.length)assert.deepEqual(wrapped,{command:process.execPath,args});
    return spawnSync(wrapped.command,wrapped.args,{encoding:'utf8'});
  };
  assert.equal(run([],doc).stdout,'sample');
  const forbidden=run(['docs/**','*.md'],doc);
  if(process.platform==='darwin'){
    assert.notEqual(forbidden.status,0);assert.ok(forbidden.stderr.includes('EPERM')&&forbidden.stderr.includes(doc));
    const inherited=run(['*.md'],markdown,true);
    assert.notEqual(inherited.status,0);assert.ok(inherited.stderr.includes('EPERM')&&inherited.stderr.includes(markdown));
    assert.equal(run(['*.md'],nested).stdout,'sample');assert.equal(run(['*.md'],doc).stdout,'sample');
  } else assert.equal(forbidden.error?.code,'ENOENT');
  assert.throws(()=>macCommand({root,exclude:['**'],command:'node',args:[]}),/Unsupported/);
});

test('Linux wraps the full guest command in inherited Landlock restrictions and passes empty exclusions through', () => {
  const original={command:'/usr/bin/node',args:['script','space in argument']};
  const root='/fixture/qualification',exclude=['*.md'];
  assert.deepEqual(linuxCommand({root,exclude:[],...original}),original);
  const wrapped=linuxCommand({root,exclude,...original});
  assert.equal(wrapped.command,'/usr/bin/python3');assert.deepEqual(wrapped.args.slice(0,2),['-I','-c']);
  assert.deepEqual(wrapped.args.slice(3),[root,JSON.stringify(exclude),original.command,...original.args]);
  assert.match(wrapped.args[2],/syscall\(446, rules, 0\)[\s\S]*os\.execvp/);
  assert.throws(()=>linuxCommand({root,exclude:['nested/**'],...original}),/Unsupported/);
  assert.throws(()=>linuxCommand({root:'.',exclude,...original}),/absolute/);
});

test('iOS app identity ignores only the signature and provisioning bytes and binds paths types and permissions', t => {
  const root=fixture(t),app=join(root,'Gallery.app');
  put(join(app,'Info.plist'),'info');put(join(app,'Gallery'),'binary');
  put(join(app,'_CodeSignature','CodeResources'),'first');put(join(app,'embedded.mobileprovision'),'first');
  put(join(app,'Frameworks','Lib','_CodeSignature','CodeResources'),'inner');
  symlinkSync('Gallery',join(app,'linked'));
  const before=appIdentity('ios',app);
  put(join(app,'_CodeSignature','CodeResources'),'second');put(join(app,'embedded.mobileprovision'),'second');
  const signed=appIdentity('ios',app);
  assert.equal(before.manifestSha256,signed.manifestSha256);assert.notEqual(before.fileSha256,signed.fileSha256);
  put(join(app,'Gallery'),'Binary');const changed=appIdentity('ios',app);
  assert.notEqual(changed.manifestSha256,signed.manifestSha256);
  put(join(app,'Frameworks','Lib','_CodeSignature','CodeResources'),'new inner');
  const inner=appIdentity('ios',app);assert.notEqual(inner.manifestSha256,changed.manifestSha256);
  chmodSync(join(app,'Gallery'),0o755);assert.notEqual(appIdentity('ios',app).manifestSha256,inner.manifestSha256);
  symlinkSync(root,join(app,'external'));assert.throws(()=>appIdentity('ios',app),/External/);
});

test('Android app identity keeps signed file provenance and distinguishes changed entry bytes', t => {
  const root=fixture(t),apk=join(root,'app.apk');
  const build=(content,signature)=>{
    execFileSync('python3',['-c',[
      'import sys,zipfile','with zipfile.ZipFile(sys.argv[1],"w") as a:',
      ' a.writestr("classes.dex",sys.argv[2])',' a.writestr("META-INF/TEST.RSA",sys.argv[3])',
    ].join('\n'),apk,content,signature]);
    return appIdentity('android',apk);
  };
  const base=build('A','old'),signed=build('A','new'),changed=build('B','new');
  assert.notEqual(base.fileSha256,signed.fileSha256);
  assert.equal(base.manifestSha256,signed.manifestSha256);
  assert.notEqual(changed.manifestSha256,signed.manifestSha256);
  assert.throws(()=>appIdentity('unknown',apk),/Unknown/);
});

test('suite inputs follow transitive gate imports and expose opaque code and data reads', () => {
  const entry = 'scripts/gates/suite.mjs', helper = 'scripts/gates/helper.mjs', leaf = 'scripts/gates/rules.mjs';
  const files = new Map([[entry, "export * from './helper.mjs';"], [helper, "import './rules.mjs';"],
    [leaf, 'export const ceiling = 1;'], ['scripts/gates/other.mjs', 'export {};']]);
  const inspect = () => moduleInputs(files, buildImportGraph(files), [entry]);
  assert.deepEqual(inspect(), { paths: [helper, leaf, entry], unresolved: [] });
  files.set(helper, 'export const load = name => import(name);');
  assert.ok(inspect().unresolved.some(issue => issue.includes(helper)));
  files.set(helper, "import { readFileSync } from 'node:fs'; export const load = name => readFileSync(name);");
  assert.ok(inspect().unresolved.includes(helper + ' uses node:fs'));
  files.set(helper, "import './missing.mjs';");
  assert.ok(inspect().unresolved.some(issue => issue.includes(helper)));
});
