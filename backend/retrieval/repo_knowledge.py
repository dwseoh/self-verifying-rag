"""Index repo-local knowledge: CLAUDE.md, rules, docs, postmortems."""

from __future__ import annotations

import re
from pathlib import Path

from backend.models import CorpusChunk

_CITATION_RE = re.compile(r"^##\s+([A-Z0-9_]+(?:\.[0-9]+)?)\s*:\s*(.+)$", re.MULTILINE)

# Filenames always indexed (any depth, within limits).
_NAMED_FILES = frozenset(
    {
        "CLAUDE.md",
        "MEMORY.md",
        "README.md",
        "CONTRIBUTING.md",
        "AGENTS.md",
        ".cursorrules",
    }
)

# Path substrings that suggest lessons / past failures.
_FAILURE_HINTS = ("postmortem", "incident", "failure", "lessons", "retro", "runbook")

_SKIP_DIRS = frozenset(
    {
        ".git",
        "node_modules",
        ".next",
        "dist",
        "build",
        ".venv",
        "venv",
        "__pycache__",
        ".pytest_cache",
        "placeholder-v1",
    }
)

_MAX_FILES = 80
_MAX_FILE_BYTES = 48_000


def _citation_id(rel: Path) -> str:
    stem = rel.stem.upper().replace("-", "_").replace(".", "_")
    if len(rel.parts) == 1:
        return f"REPO_{stem}"
    parts = "_".join(p.upper().replace("-", "_").replace(".", "_") for p in rel.parts)
    return f"REPO_{parts}"[:64]


def _should_index(path: Path, repo: Path) -> bool:
    try:
        if not path.is_file():
            return False
        if path.suffix.lower() != ".md" and path.name != ".cursorrules":
            return False
        if path.stat().st_size > _MAX_FILE_BYTES:
            return False
    except OSError:
        return False
    rel = path.relative_to(repo)
    if any(part in _SKIP_DIRS for part in rel.parts):
        return False
    name = path.name
    if name in _NAMED_FILES or name == ".cursorrules":
        return True
    rel_str = str(rel).lower()
    if rel_str.startswith(".cursor/rules"):
        return True
    if rel_str.startswith("docs/") or rel_str.startswith(".trustloop/"):
        return True
    if any(h in rel_str for h in _FAILURE_HINTS):
        return True
    return name == "CLAUDE.md"


def iter_knowledge_files(repo: Path) -> list[Path]:
    repo = repo.resolve()
    found: list[Path] = []
    seen: set[str] = set()

    def add(p: Path) -> None:
        key = str(p.resolve())
        if key in seen:
            return
        if _should_index(p, repo):
            seen.add(key)
            found.append(p)

    for name in _NAMED_FILES:
        p = repo / name
        try:
            if p.is_file():
                add(p)
        except OSError:
            continue

    try:
        for path in repo.rglob("*"):
            if not path.is_file():
                continue
            try:
                if path.name in {"CLAUDE.md", "MEMORY.md"}:
                    add(path)
            except OSError:
                continue
            if len(found) >= _MAX_FILES:
                break

        for path in repo.rglob("*.md"):
            try:
                add(path)
            except OSError:
                continue
            if len(found) >= _MAX_FILES:
                break
    except OSError:
        pass

    return sorted(found, key=lambda p: str(p.relative_to(repo)))


def chunk_knowledge_file(path: Path, repo: Path) -> list[CorpusChunk]:
    rel = path.relative_to(repo)
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    doc_title = str(rel)
    base_id = _citation_id(rel)
    chunks: list[CorpusChunk] = []

    parts = re.split(r"(?=^## )", text, flags=re.MULTILINE)
    if len(parts) <= 1 and not _CITATION_RE.search(text):
        title = rel.stem.replace("_", " ").replace("-", " ").title()
        chunks.append(
            CorpusChunk(
                citation_id=base_id,
                document_title=doc_title,
                section_title=title,
                text=text[:2000],
                score=0.0,
            )
        )
        return chunks

    for i, part in enumerate(parts):
        part = part.strip()
        if not part:
            continue
        m = _CITATION_RE.match(part)
        if m:
            citation_id, section_title = m.group(1), m.group(2).strip()
        else:
            citation_id = base_id if i == 0 else f"{base_id}_{i}"
            section_title = part.splitlines()[0].lstrip("# ").strip()[:80] or doc_title
        chunks.append(
            CorpusChunk(
                citation_id=citation_id,
                document_title=doc_title,
                section_title=section_title,
                text=part[:2000],
                score=0.0,
            )
        )
    return chunks


def load_repo_knowledge(repo: Path) -> list[CorpusChunk]:
    chunks: list[CorpusChunk] = []
    for path in iter_knowledge_files(repo):
        chunks.extend(chunk_knowledge_file(path, repo))
    return chunks


def list_knowledge_sources(repo: Path) -> list[dict]:
    out: list[dict] = []
    for path in iter_knowledge_files(repo):
        try:
            rel = path.relative_to(repo)
            out.append(
                {
                    "path": str(rel),
                    "citation_id": _citation_id(rel),
                    "size_bytes": path.stat().st_size,
                }
            )
        except OSError:
            continue
    return out


def merge_knowledge_chunks(
    formal: list[CorpusChunk],
    repo_docs: list[CorpusChunk],
) -> list[CorpusChunk]:
    """Repo-local knowledge wins over global formal corpus on citation_id clash."""
    by_id: dict[str, CorpusChunk] = {c.citation_id: c for c in formal}
    for ch in repo_docs:
        by_id[ch.citation_id] = ch
    return list(by_id.values())
