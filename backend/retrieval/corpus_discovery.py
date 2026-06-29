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


def ensure_repo_corpus_dir(repo_path: Path) -> Path:
    """Prefer existing corpus dir inside repo; create docs/trustloop_corpus if none."""
    repo = repo_path.resolve()
    for rel in CORPUS_CANDIDATES:
        candidate = repo / rel
        if candidate.is_dir():
            return candidate
    target = repo / "docs" / "trustloop_corpus"
    target.mkdir(parents=True, exist_ok=True)
    return target


def append_rule(
    repo_path: Path,
    *,
    citation_id: str,
    section_title: str,
    body: str,
    filename: str = "custom_rules.md",
) -> dict:
    """Append a ## CITATION_ID section to repo-local corpus markdown."""
    corpus = ensure_repo_corpus_dir(repo_path)
    safe_name = "".join(c for c in filename if c.isalnum() or c in "._-").strip() or "custom_rules.md"
    if not safe_name.endswith(".md"):
        safe_name += ".md"
    file_path = corpus / safe_name
    section = f"\n\n## {citation_id.strip()}: {section_title.strip()}\n\n{body.strip()}\n"
    if file_path.exists():
        file_path.write_text(file_path.read_text(encoding="utf-8") + section, encoding="utf-8")
    else:
        header = f"# Custom rules\n\nRules added via TrustLoop dashboard.\n"
        file_path.write_text(header + section, encoding="utf-8")
    return {"path": str(file_path), "citation_id": citation_id, "corpus_path": str(corpus)}
