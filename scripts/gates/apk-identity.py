"""Hash the signed APK and its sorted (entry name, uncompressed SHA-256) manifest."""
import hashlib
import json
import re
import sys
import zipfile


def sha256(stream):
    digest = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(block)
    return digest.hexdigest()


with open(sys.argv[1], "rb") as apk:
    file_hash = sha256(apk)
    with zipfile.ZipFile(apk) as archive:
        manifest = []
        seen = set()
        for entry in archive.infolist():
            name = entry.orig_filename
            if name != entry.filename or name in seen:
                raise ValueError("Ambiguous APK entry: " + repr(name))
            seen.add(name)
            if re.fullmatch(r"META-INF/[^/]+\.(?:RSA|SF|EC|DSA)", name):
                continue
            with archive.open(entry) as content:
                manifest.append((name, sha256(content)))

encoded = json.dumps(sorted(manifest), separators=(",", ":")).encode("ascii")
print(json.dumps({"apkSha256": file_hash, "entryManifestSha256": hashlib.sha256(encoded).hexdigest()}))
