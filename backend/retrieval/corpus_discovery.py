"""Discover engineering corpus markdown inside a target repo."""

from __future__ import annotations

from pathlib import Path

from backend.config import ROOT, settings

# Checked in order — first folder with *.md wins.
CORPUS_CANDIDATES = (
    "docs/trustloop_corpus",
    "docs/engineering_corpus",
    "engineering_corpus",
    ".trustloop/corpus",
    "docs",
)


def discover_corpus_path(repo_path: Path, explicit: Path | str | None = None) -> Path:
    """Resolve corpus: explicit override → repo-local discovery → global default."""
    if explicit:
        path = Path(explicit)
        if not path.is_absolute():
            path = ROOT / path
        if path.is_dir():
            return path

    repo = repo_path.resolve()
    for rel in CORPUS_CANDIDATES:
        candidate = repo / rel
        if not candidate.is_dir():
            continue
        if any(candidate.rglob("*.md")):
            return candidate

    return settings.trustloop_corpus_path


def list_corpus_files(corpus_root: Path) -> list[dict]:
    """Rules explorer: all markdown sections with citation ids."""
    from backend.retrieval.retriever import load_corpus

    chunks = load_corpus(corpus_root)
    by_file: dict[str, list[dict]] = {}
    for ch in chunks:
        # Approximate file grouping via document_title
        key = ch.document_title
        by_file.setdefault(key, []).append(
            {
                "citation_id": ch.citation_id,
                "section_title": ch.section_title,
                "text_preview": ch.text[:400],
            }
        )
    return [
        {"document": doc, "sections": sections}
        for doc, sections in sorted(by_file.items())
    ]
