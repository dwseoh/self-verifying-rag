from pathlib import Path

from backend.retrieval.repo_knowledge import iter_knowledge_files, load_repo_knowledge


def test_indexes_claude_and_readme(tmp_path: Path) -> None:
    (tmp_path / "CLAUDE.md").write_text("# Project rules\n\nAlways use TypeScript strict mode.\n")
    (tmp_path / "README.md").write_text("# Site\n\nPortfolio project.\n")
    files = iter_knowledge_files(tmp_path)
    names = {p.name for p in files}
    assert "CLAUDE.md" in names
    assert "README.md" in names
    chunks = load_repo_knowledge(tmp_path)
    assert any("TypeScript" in c.text for c in chunks)


def test_cursor_rules_indexed(tmp_path: Path) -> None:
    rules = tmp_path / "docs" / "trustloop_corpus"
    rules.mkdir(parents=True)
    (rules / "style.md").write_text("## STYLE_001: Formatting\n\nUse prettier.\n")
    chunks = load_repo_knowledge(tmp_path)
    assert any(c.citation_id == "STYLE_001" for c in chunks)
