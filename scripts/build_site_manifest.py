from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVES = ROOT / "archives"
OUTPUT = ROOT / "docs" / "assets" / "data" / "records.json"


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def metadata_for(folder: Path) -> dict:
    meta_path = folder / "meta.json"
    final_path = folder / "final.json"

    if meta_path.is_file():
        meta = load_json(meta_path)
        source_format = "text"
    elif final_path.is_file():
        legacy = load_json(final_path)
        unresolved = legacy.get("unresolved")
        meta = {
            "document_number": legacy.get("document_number", folder.name),
            "title": legacy.get("title", "件名未整理の公開記録"),
            "summary": legacy.get("summary", "公開記録"),
            "document_type": "調査報告書",
            "department": "記録編纂課",
            "public_class": "一般",
            "unresolved_count": len(unresolved) if isinstance(unresolved, list) else 0,
        }
        source_format = "legacy"
    else:
        meta = {}
        source_format = "text"

    return {
        "folder": folder.name,
        "format": source_format,
        "document_number": meta.get("document_number", folder.name),
        "title": meta.get("title", "件名未整理の公開記録"),
        "summary": meta.get("summary", "公開記録"),
        "document_type": meta.get("document_type", "記録"),
        "department": meta.get("department", "記録編纂課"),
        "public_class": meta.get("public_class", "一般"),
        "record_date": meta.get("record_date"),
        "unresolved_count": int(meta.get("unresolved_count", 0) or 0),
        "has_report": (folder / "report.md").is_file(),
    }


def main() -> None:
    records = []
    for folder in sorted(ARCHIVES.glob("TK-*"), key=lambda p: p.name, reverse=True):
        if not folder.is_dir():
            continue
        record = metadata_for(folder)
        if record["has_report"]:
            records.append(record)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps({"records": records}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
