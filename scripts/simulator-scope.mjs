import { execFileSync } from 'node:child_process';
import { simulatorRequired } from '../packages/policy/quality/simulator-scope.mjs';

const root = process.cwd();
const tree = execFileSync('git', ['write-tree'], { cwd: root, encoding: 'utf8' }).trim();
console.log(simulatorRequired(root, tree, process.argv[2] ?? 'commit') ? 'run' : 'skip');
