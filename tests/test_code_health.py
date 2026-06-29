from pathlib import Path

from backend.health.code_health import analyze_code_health


def test_detects_console_log(tmp_path: Path) -> None:
    f = tmp_path / "app.tsx"
    f.write_text("export function App() { console.log('hi'); return null; }\n")
    findings = analyze_code_health(tmp_path, ["app.tsx"])
    assert any("console" in x["title"].lower() or "debug" in x["id"] for x in findings)
