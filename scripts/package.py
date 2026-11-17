"""Create installable-extension and upload-ready repository archives. No dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist"
OUT.mkdir(exist_ok=True)
version = json.loads((ROOT / "package.json").read_text())["version"]
assert version == json.loads((ROOT / "extension/manifest.json").read_text())["version"]

with ZipFile(OUT / "x0_chessica-extension.zip", "w", ZIP_DEFLATED) as archive:
    for file in sorted((ROOT / "extension").rglob("*")):
        if file.is_file():
            archive.write(file, Path("x0_chessica") / file.relative_to(ROOT / "extension"))
    for name in ["LICENSE", "THIRD_PARTY_NOTICES.md"]:
        archive.write(ROOT / name, Path("x0_chessica") / name)
    for file in sorted((ROOT / "third_party").rglob("*")):
        if file.is_file():
            archive.write(file, Path("x0_chessica") / file.relative_to(ROOT))

excluded = {".git", "node_modules", "dist", "__pycache__", "playwright-report", "test-results", ".openai"}
with ZipFile(OUT / "x0_chessica-github.zip", "w", ZIP_DEFLATED) as archive:
    for file in sorted(ROOT.rglob("*")):
        relative = file.relative_to(ROOT)
        if not file.is_file() or any(part in excluded for part in relative.parts):
            continue
        if file.name.startswith(".env") or file.name in {".DS_Store", "Thumbs.db"} or file.suffix in {".log", ".pyc"}:
            continue
        archive.write(file, Path("x0_chessica") / relative)

for name in ["x0_chessica-extension.zip", "x0_chessica-github.zip"]:
    with ZipFile(OUT / name) as archive:
        assert archive.testzip() is None
    print(f"Built {name} for version {version}: {(OUT / name).stat().st_size:,} bytes")
