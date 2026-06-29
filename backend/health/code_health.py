"""Deterministic repo health signals — no LLM required."""

from __future__ import annotations

import re
from pathlib import Path

from backend.indexer.source_files import SCOPE_SUFFIXES

_SKIP_DIRS = frozenset({".git", "node_modules", ".next", "dist", "build", ".venv", "venv"})

_LINE_WARN = 400
_LINE_HIGH = 800

_SMELL_PATTERNS: list[tuple[str, str, str]] = [
    (r"\bconsole\.log\s*\(", "debug_log", "Remove console.log before shipping."),
    (r"\bdebugger\b", "debugger", "Remove debugger statements."),
    (r"\bTODO\b", "todo", "Resolve or ticket TODO comments in changed code."),
    (r"\bFIXME\b", "fixme", "Address FIXME before merge."),
    (r"\bHACK\b", "hack", "Replace hack/workaround with a proper fix."),
    (r":\s*any\b", "typescript_any", "Avoid `any` — tighten types."),
]

_EXPORT_RE = re.compile(
    r"^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)",
    re.MULTILINE,
)


def _iter_scoped_files(repo: Path, paths: list[str] | None) -> list[Path]:
    if paths:
        out: list[Path] = []
        for p in paths:
            fp = repo / p
            if fp.is_file() and fp.suffix.lower() in SCOPE_SUFFIXES:
                out.append(fp)
        return out

    found: list[Path] = []
    for path in repo.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SCOPE_SUFFIXES:
            continue
        if any(part in _SKIP_DIRS for part in path.relative_to(repo).parts):
            continue
        found.append(path)
        if len(found) >= 200:
            break
    return found


def _read_safe(path: Path) -> str:
    try:
        if path.stat().st_size > 200_000:
            return ""
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def analyze_code_health(repo: Path, changed_paths: list[str] | None = None) -> list[dict]:
    """Return health findings for changed files (or repo sample)."""
    findings: list[dict] = []
    files = _iter_scoped_files(repo, changed_paths)

    export_index: dict[str, list[str]] = {}
    for fp in files:
        rel = str(fp.relative_to(repo))
        text = _read_safe(fp)
        if not text:
            continue

        lines = text.count("\n") + 1
        if lines >= _LINE_HIGH:
            findings.append(
                {
                    "id": f"health_large_{rel}",
                    "severity": "medium",
                    "title": f"Very large file ({lines} lines)",
                    "explanation": f"{rel} is {_LINE_HIGH}+ lines — consider splitting for maintainability.",
                    "related_paths": [rel],
                    "recommended_fix": "Extract components/modules into smaller files.",
                    "detected_by": ["code_health"],
                }
            )
        elif lines >= _LINE_WARN:
            findings.append(
                {
                    "id": f"health_large_{rel}",
                    "severity": "low",
                    "title": f"Large file ({lines} lines)",
                    "explanation": f"{rel} exceeds {_LINE_WARN} lines.",
                    "related_paths": [rel],
                    "recommended_fix": "Consider refactoring into smaller units.",
                    "detected_by": ["code_health"],
                }
            )

        for pattern, kind, fix in _SMELL_PATTERNS:
            if re.search(pattern, text):
                findings.append(
                    {
                        "id": f"health_{kind}_{rel}",
                        "severity": "low" if kind in {"todo", "fixme"} else "medium",
                        "title": f"Code smell: {kind.replace('_', ' ')}",
                        "explanation": f"Found `{kind}` pattern in {rel}.",
                        "related_paths": [rel],
                        "recommended_fix": fix,
                        "detected_by": ["code_health"],
                    }
                )

        for m in _EXPORT_RE.finditer(text):
            export_index.setdefault(m.group(1), []).append(rel)

    # Possibly unused exports: defined in one file, never referenced elsewhere (heuristic).
    if len(files) <= 80:
        all_text = "\n".join(_read_safe(f) for f in files)
        for name, defining in export_index.items():
            if len(defining) != 1:
                continue
            refs = len(re.findall(rf"\b{re.escape(name)}\b", all_text))
            if refs <= 1:
                rel = defining[0]
                findings.append(
                    {
                        "id": f"health_unused_{name}_{rel}",
                        "severity": "low",
                        "title": f"Possibly unused export: {name}",
                        "explanation": f"`{name}` is exported from {rel} but rarely referenced in indexed files.",
                        "related_paths": [rel],
                        "recommended_fix": "Remove dead export or wire it up where intended.",
                        "detected_by": ["code_health"],
                    }
                )

    return findings[:25]


def health_to_findings(raw: list[dict]) -> list:
    from backend.models import Finding, Severity

    out: list[Finding] = []
    for h in raw:
        out.append(
            Finding(
                id=h["id"],
                severity=Severity(h.get("severity", "low")),
                confidence=90,
                title=h["title"],
                explanation=h["explanation"],
                citation_ids=[],
                related_paths=h.get("related_paths", []),
                recommended_fix=h.get("recommended_fix"),
                detected_by=h.get("detected_by", ["code_health"]),
            )
        )
    return out
