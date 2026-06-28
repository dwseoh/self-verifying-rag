"""Keyword retrieval over engineering_corpus markdown."""

from __future__ import annotations

import re
from pathlib import Path

from backend.config import settings
from backend.models import CorpusChunk

_CITATION_RE = re.compile(r"^##\s+([A-Z0-9_]+(?:\.[0-9]+)?)\s*:\s*(.+)$", re.MULTILINE)


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


def retrieve(query: str, chunks: list[CorpusChunk], top_k: int = 5) -> list[CorpusChunk]:
    """Simple keyword scoring for MVP."""
    terms = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
    if not terms:
        return chunks[:top_k]

    scored: list[tuple[float, CorpusChunk]] = []
    for ch in chunks:
        blob = f"{ch.citation_id} {ch.text}".lower()
        score = sum(1 for t in terms if t in blob) / len(terms)
        if score > 0:
            scored.append((score, ch.model_copy(update={"score": score})))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:top_k]] or chunks[:top_k]
