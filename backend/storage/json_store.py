import json
from pathlib import Path
from typing import Any

from backend.config import settings


class JsonStore:
    """MVP persistence — local JSON files. Use Neon/Postgres in add-on A5+ if deployed."""

    def __init__(self, store_path: Path | None = None) -> None:
        self.root = store_path or settings.trustloop_store_path
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, name: str) -> Path:
        return self.root / name

    def read_json(self, name: str, default: Any) -> Any:
        path = self._path(name)
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))

    def write_json(self, name: str, data: Any) -> None:
        path = self._path(name)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def append_jsonl(self, name: str, record: dict) -> None:
        path = self._path(name)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
