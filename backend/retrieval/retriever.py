"""Keyword retrieval over engineering_corpus markdown."""

from __future__ import annotations

import re
from pathlib import Path

from backend.config import settings
from backend.models import CorpusChunk

_CITATION_RE = re.compile(r"^##\s+([A-Z0-9_]+(?:\.[0-9]+)?)\s*:\s*(.+)$", re.MULTILINE)

# Generic path/query noise — keeps retrieval from matching fintech docs on unrelated repos.
_STOP_TERMS = frozenset(
    {
        "the",
        "and",
        "for",
        "from",
        "with",
        "this",
        "that",
        "src",
        "lib",
        "tools",
        "apps",
        "api",
        "web",
        "inc",
        "def",
        "int",
        "void",
        "char",
        "return",
        "include",
        "stdio",
        "stdlib",
        "string",
        "static",
        "const",
        "struct",
        "enum",
        "typedef",
        "ifdef",
        "endif",
        "define",
        "file",
        "path",
        "repo",
        "diff",
        "changed",
    }
)

_C_SOURCE_SUFFIXES = frozenset({".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hxx"})

# Below this max score, corpus is treated as a weak match for the verify scope.
CORPUS_WEAK_THRESHOLD = 0.2


def _chunk_file(path: Path, corpus_root: Path) -> list[CorpusChunk]:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(corpus_root)
    doc_title = rel.stem.replace("_", " ").title()
    chunks: list[CorpusChunk] = []

    parts = re.split(r"(?=^## )", text, flags=re.MULTILINE)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        m = _CITATION_RE.match(part)
        if m:
            citation_id, section_title = m.group(1), m.group(2).strip()
        else:
            citation_id, section_title = rel.stem.upper(), doc_title
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


def load_corpus(corpus_path: Path | None = None) -> list[CorpusChunk]:
    root = corpus_path or settings.trustloop_corpus_path
    chunks: list[CorpusChunk] = []
    for md in root.rglob("*.md"):
        chunks.extend(_chunk_file(md, root))
    return chunks


def _query_terms(query: str) -> list[str]:
    terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
    return [t for t in terms if t not in _STOP_TERMS]


def _c_scope_hint(changed_paths: list[str]) -> str:
    if any(Path(p).suffix.lower() in _C_SOURCE_SUFFIXES for p in changed_paths):
        return "c cpp header include embedded error handling malloc cli"
    return ""


def retrieve(
    query: str,
    chunks: list[CorpusChunk],
    top_k: int = 5,
    *,
    changed_paths: list[str] | None = None,
    min_score: float = 0.15,
) -> list[CorpusChunk]:
    """Keyword scoring for MVP. Returns only chunks above min_score — no arbitrary fallback."""
    hint = _c_scope_hint(changed_paths or [])
    terms = _query_terms(f"{query}\n{hint}")
    if not terms or not chunks:
        return []

    scored: list[tuple[float, CorpusChunk]] = []
    for ch in chunks:
        blob = f"{ch.citation_id} {ch.section_title} {ch.text}".lower()
        hits = sum(1 for t in terms if t in blob)
        if hits == 0:
            continue
        score = hits / len(terms)
        if score >= min_score:
            scored.append((score, ch.model_copy(update={"score": score})))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]]


def corpus_relevance(chunks: list[CorpusChunk]) -> float:
    if not chunks:
        return 0.0
    return max(c.score for c in chunks)


def corpus_weak(chunks: list[CorpusChunk]) -> bool:
    return corpus_relevance(chunks) < CORPUS_WEAK_THRESHOLD
