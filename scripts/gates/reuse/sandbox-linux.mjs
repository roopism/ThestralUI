import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { isAbsolute } from 'node:path';

// This module travels from the trusted Mac checkout to the guest. Landlock
// restricts the child and its descendants without privileges or a VM package.
const landlock = `
import ctypes, json, os, platform, stat, struct, sys
from pathlib import Path

if platform.system() != "Linux" or platform.machine() != "aarch64":
    raise RuntimeError("The qualification sandbox requires the arm64 Linux guest")
root = Path(sys.argv[1]).resolve(strict=True)
globs = json.loads(sys.argv[2])
if root != Path.cwd().resolve() or root == Path.home() or not root.is_relative_to(Path.home()):
    raise ValueError("Expected the guest checkout inside its home directory")
if not globs or not all(p in ("docs/**", "*.md") for p in globs):
    raise ValueError("Unknown Linux sandbox exclusion")

libc = ctypes.CDLL(None, use_errno=True)
def checked(result):
    if result < 0:
        err = ctypes.get_errno()
        raise OSError(err, os.strerror(err))
    return result
def syscall(number, *args):
    return checked(libc.syscall(number, *args))

# arm64 Linux UAPI: create_ruleset, add_rule, restrict_self.
if syscall(444, None, 0, 1) < 1:
    raise RuntimeError("The guest kernel does not offer file access restrictions")
read_file, read_dir = 4, 8
rights = read_file | read_dir if "docs/**" in globs else read_file
rules = syscall(444, struct.pack("=Q", rights), 8, 0)
def allow(path):
    fd = os.open(path, os.O_PATH | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        mask = rights if stat.S_ISDIR(os.fstat(fd).st_mode) else read_file
        syscall(445, rules, 1, struct.pack("=Qi", mask, fd), 0)
    finally:
        os.close(fd)

system = [Path(p) for p in ("/usr", "/etc", "/dev", "/proc", "/sys", "/tmp", "/opt", "/run")]
for tree in system + [Path.home() / ".cache"]:
    if tree.exists():
        if root.is_relative_to(tree.resolve()):
            raise ValueError("Guest checkout overlaps a permitted system directory")
        allow(tree.resolve())
for child in root.iterdir():
    if child.name == "docs" and "docs/**" in globs:
        if child.is_symlink() or not child.is_dir():
            raise ValueError("Ambiguous docs exclusion")
        continue
    if child.name.endswith(".md") and "*.md" in globs and not child.is_dir():
        if child.is_symlink() or not child.is_file() or child.stat().st_nlink != 1:
            raise ValueError("Ambiguous Markdown exclusion")
        continue
    if not child.is_symlink():
        allow(child)
checked(libc.prctl(38, 1, 0, 0, 0))  # PR_SET_NO_NEW_PRIVS
syscall(446, rules, 0)
os.close(rules)
os.execvp(sys.argv[3], sys.argv[3:])
`;

export function linuxCommand({ root, exclude, command, args }) {
  assert.ok(Array.isArray(exclude) && exclude.every(item => item === 'docs/**' || item === '*.md'),
    'Unsupported Linux sandbox exclusion');
  if (!exclude.length) return { command, args };
  assert.ok(isAbsolute(root), 'Expected an absolute Linux sandbox root');
  return { command: '/usr/bin/python3', args: ['-I', '-c', landlock, root, JSON.stringify(exclude), command, ...args] };
}

if (import.meta.main) {
  const [raw, separator, command, ...args] = process.argv.slice(2);
  assert.ok(separator === '--' && command, 'Expected JSON exclusions, -- and a command');
  const wrapped = linuxCommand({ root: process.cwd(), exclude: JSON.parse(raw), command, args });
  const result = spawnSync(wrapped.command, wrapped.args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
