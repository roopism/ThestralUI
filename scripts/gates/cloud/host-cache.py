"""Transport an exact-proposal iPhone build under the isolated shard account."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile

mode, directory, bundle, identity = sys.argv[1:]
root, archive = Path(directory), Path(bundle)
manifest = archive.with_suffix(".json")


def digest():
    with archive.open("rb") as source:
        value = hashlib.sha256()
        for block in iter(lambda: source.read(1048576), b""):
            value.update(block)
        return value.hexdigest()


def allowed(member):
    name = Path(member.name)
    if name.is_absolute() or ".." in name.parts or not name.parts or not name.parts[0].startswith("ios-"):
        return False
    if member.isdir() or member.isfile():
        return True
    if member.issym():
        target = Path(member.linkname)
        return not target.is_absolute() and (root / name.parent / target).resolve().is_relative_to(root.resolve())
    return False


if mode == "save":
    # Cache only a complete host whose entries can be safely restored.
    dirs = sorted(p for p in root.glob("ios-*") if p.is_dir() and not p.is_symlink() and (p / "ready.json").is_file())
    if not dirs:
        sys.exit(0)
    with tarfile.open(archive, "x") as output:
        for path in dirs:
            output.add(path, arcname=path.name)
    with tarfile.open(archive) as saved:
        if not all(allowed(member) for member in saved):
            archive.unlink()
            sys.exit(0)
    manifest.write_text(json.dumps({"identity": identity, "sha256": digest()}))
elif mode == "restore":
    if not archive.exists() and not manifest.exists():
        sys.exit(0)
    if json.loads(manifest.read_text()) != {"identity": identity, "sha256": digest()}:
        raise ValueError("The cached simulator host differs from its exact-build digest")
    root.mkdir(exist_ok=True)
    with tarfile.open(archive) as saved:
        members = saved.getmembers()
        if not members or not all(allowed(member) for member in members):
            raise ValueError("Unexpected simulator host archive member")
        # data_filter also checks every resolved destination during extraction.
        saved.extractall(root, members=members, filter="data")
else:
    raise ValueError("Unknown simulator cache operation")
