from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVES = ROOT / "archives"
OUTPUT = ROOT / "docs" / "assets" / "data" / "records.json"


def main() -> None:
    records = []
    for folder in sorted(ARCHIVES.glob("TK-*"), key=lambda p: p.name, reverse=True):
        if not folder.is_dir():
            continue
        images_dir = folder / "images"
        images = []
        if images_dir.is_dir():
            images = sorted(p.name for p in images_dir.glob("*.png") if p.is_file())
        records.append({"folder": folder.name, "images": images})

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"records": records}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
