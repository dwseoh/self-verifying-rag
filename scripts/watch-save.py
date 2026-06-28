#!/usr/bin/env python3
"""Debounced file watcher → POST /api/verify on save (Add-on A1)."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("TRUSTLOOP_API", "http://localhost:8000")
REPO = os.environ.get("TRUSTLOOP_REPO", "data/demo_repo")
WATCH_DIR = Path(REPO).resolve()
DEBOUNCE_S = float(os.environ.get("TRUSTLOOP_DEBOUNCE", "0.8"))
POLL_S = 0.3


def rel_path(path: Path) -> str:
    return str(path.relative_to(WATCH_DIR))


def post_verify(changed: list[str]) -> None:
    body = json.dumps(
        {
            "repo_path": str(WATCH_DIR),
            "changed_paths": changed,
            "trigger": "save",
        }
    ).encode()
    req = urllib.request.Request(
        f"{API}/api/verify",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.load(resp)
    highs = [f for f in data.get("findings", []) if f.get("severity") == "high"]
    print(
        f"[verify] {len(data.get('findings', []))} findings, "
        f"{len(highs)} high, {data.get('latency', {}).get('total_ms')}ms "
        f"— {changed}"
    )


def main() -> None:
    if not WATCH_DIR.exists():
        raise SystemExit(f"Watch dir not found: {WATCH_DIR}")

    print(f"Watching {WATCH_DIR} → {API}/api/verify (debounce {DEBOUNCE_S}s)")
    mtimes: dict[Path, float] = {}
    pending: dict[str, float] = {}

    for py in WATCH_DIR.rglob("*.py"):
        mtimes[py] = py.stat().st_mtime

    while True:
        time.sleep(POLL_S)
        now = time.time()
        for py in WATCH_DIR.rglob("*.py"):
            try:
                m = py.stat().st_mtime
            except OSError:
                continue
            prev = mtimes.get(py)
            if prev is None:
                mtimes[py] = m
                continue
            if m != prev:
                mtimes[py] = m
                pending[rel_path(py)] = now

        due = [p for p, t in pending.items() if now - t >= DEBOUNCE_S]
        if due:
            try:
                post_verify(due)
            except urllib.error.URLError as exc:
                print(f"[error] {exc}")
            for p in due:
                pending.pop(p, None)


if __name__ == "__main__":
    main()
