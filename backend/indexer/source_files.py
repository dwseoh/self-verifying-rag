"""Discover source files and extract dependency edges."""

from __future__ import annotations

import ast
import re
from pathlib import Path

SOURCE_SUFFIXES = frozenset({".py", ".c", ".cc", ".cpp", ".cxx", ".h", ".hpp", ".hxx"})

GRAPH_SUFFIXES = SOURCE_SUFFIXES | frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"})

# Files included in verify scope (git diff / working tree). Wider than graph index.
SCOPE_SUFFIXES = GRAPH_SUFFIXES | frozenset({".css", ".scss", ".md"})


def is_source_file(path: Path) -> bool:
    return path.suffix.lower() in SOURCE_SUFFIXES


def is_scoped_file(path: Path) -> bool:
    return path.suffix.lower() in SCOPE_SUFFIXES


def is_graph_file(path: Path) -> bool:
    return path.suffix.lower() in GRAPH_SUFFIXES


SKIP_DIR_NAMES = frozenset(
    {
        ".git",
        "build",
        "node_modules",
        ".next",
        "dist",
        ".venv",
        "venv",
        "__pycache__",
        ".pytest_cache",
        "placeholder-v1",
    }
)

_INCLUDE_RE = re.compile(
    r'^\s*#\s*include\s+([<"])([^>"]+)[>"]',
    re.MULTILINE,
)


def iter_source_files(repo: Path) -> list[Path]:
    return _iter_by_suffix(repo, is_source_file)


def iter_graph_files(repo: Path) -> list[Path]:
    return _iter_by_suffix(repo, is_graph_file)


def _iter_by_suffix(repo: Path, predicate) -> list[Path]:
    files: list[Path] = []
    for path in repo.rglob("*"):
        if not path.is_file() or not predicate(path):
            continue
        if any(part in SKIP_DIR_NAMES for part in path.parts):
            continue
        files.append(path)
    return files


def extract_python_imports(source: str, file_path: str) -> list[dict]:
    edges: list[dict] = []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return edges

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                edges.append({"from": file_path, "to": alias.name, "kind": "import"})
        elif isinstance(node, ast.ImportFrom) and node.module:
            edges.append({"from": file_path, "to": node.module, "kind": "import"})
    return edges


def extract_c_includes(source: str, file_path: str) -> list[dict]:
    edges: list[dict] = []
    for match in _INCLUDE_RE.finditer(source):
        delim, target = match.group(1), match.group(2)
        kind = "include_system" if delim == "<" else "include_local"
        edges.append({"from": file_path, "to": target, "kind": kind})
    return edges


_TS_IMPORT_RE = re.compile(
    r"""(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]"""
    r"""|import\s+['"]([^'"]+)['"]""",
)


def extract_ts_imports(source: str, file_path: str) -> list[dict]:
    edges: list[dict] = []
    for m in _TS_IMPORT_RE.finditer(source):
        target = m.group(1) or m.group(2)
        if target:
            edges.append({"from": file_path, "to": target, "kind": "import"})
    return edges


def extract_edges(source: str, file_path: str, suffix: str) -> list[dict]:
    if suffix == ".py":
        return extract_python_imports(source, file_path)
    if suffix in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
        return extract_ts_imports(source, file_path)
    return extract_c_includes(source, file_path)


def edges_for_file(path: Path, repo: Path) -> list[dict]:
    rel = str(path.relative_to(repo))
    source = path.read_text(encoding="utf-8", errors="replace")
    return extract_edges(source, rel, path.suffix.lower())
