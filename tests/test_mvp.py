import pytest
from httpx import ASGITransport, AsyncClient

from backend.app import app
from backend.config import settings
from backend.indexer.graph import build_graph, detect_boundary_hint, diff_summary_for_paths
from backend.models import TriggerType, VerifyRequest
from backend.pipeline.orchestrator import run_verification
from backend.retrieval.retriever import corpus_weak, load_corpus, retrieve


@pytest.fixture
def repo_path():
    return settings.resolve_repo_path("data/demo_repo")


def test_build_graph(repo_path):
    graph = build_graph(repo_path)
    assert any(n.endswith("checkout.py") for n in graph["nodes"])
    assert graph["edges"]


def test_detect_boundary_clean(repo_path):
    diff = diff_summary_for_paths(repo_path, ["apps/web/checkout.py"])
    assert detect_boundary_hint(diff) is False


def test_detect_boundary_violation(repo_path):
    diff = diff_summary_for_paths(repo_path, ["apps/web/checkout.py"])
    diff += "\nfrom packages.payments.client import charge_customer\n"
    assert detect_boundary_hint(diff) is True


def test_corpus_retrieve():
    chunks = load_corpus()
    assert len(chunks) >= 3
    hits = retrieve("payments web import boundary", chunks, top_k=3)
    ids = {c.citation_id for c in hits}
    assert "ARCH_ADR_004" in ids or any("ADR" in i for i in ids)


def test_corpus_retrieve_c_prefers_c_conventions():
    chunks = load_corpus()
    hits = retrieve(
        "obc/tools/cli/cli.c",
        chunks,
        top_k=3,
        changed_paths=["obc/tools/cli/cli.c"],
    )
    ids = {c.citation_id for c in hits}
    assert any(i.startswith("C_STYLE") for i in ids)
    assert "RUNBOOK_CHECKOUT_002" not in ids


def test_corpus_weak_when_no_match():
    chunks = load_corpus()
    hits = retrieve("xyzzy_nonexistent_module", chunks, top_k=5)
    assert hits == []
    assert corpus_weak(hits)


@pytest.mark.asyncio
async def test_run_verification_clean(repo_path, monkeypatch):
    monkeypatch.setattr(settings, "cerebras_api_key", "")
    monkeypatch.setattr(settings, "trustloop_mock", True)
    run = await run_verification(
        VerifyRequest(
            repo_path=str(repo_path),
            changed_paths=["apps/web/checkout.py"],
            trigger=TriggerType.MANUAL,
        )
    )
    assert run.metadata.agents_run == 5
    assert not any(f.severity.value == "high" for f in run.findings)


@pytest.mark.asyncio
async def test_run_verification_violation(repo_path, monkeypatch):
    monkeypatch.setattr(settings, "cerebras_api_key", "")
    monkeypatch.setattr(settings, "trustloop_mock", True)
    diff = diff_summary_for_paths(repo_path, ["apps/web/checkout.py"])
    diff += "\nfrom packages.payments.client import charge_customer\n"
    run = await run_verification(
        VerifyRequest(
            repo_path=str(repo_path),
            changed_paths=["apps/web/checkout.py"],
            trigger=TriggerType.MANUAL,
            diff_summary=diff,
        )
    )
    assert any(f.severity.value == "high" for f in run.findings)
    assert run.risk_level in {"medium", "high"}


@pytest.mark.asyncio
async def test_api_verify_clean(monkeypatch):
    monkeypatch.setattr(settings, "cerebras_api_key", "")
    monkeypatch.setattr(settings, "trustloop_mock", True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/verify",
            json={
                "repo_path": "data/demo_repo",
                "changed_paths": ["apps/web/checkout.py"],
                "trigger": "manual",
            },
        )
    assert res.status_code == 200
    body = res.json()
    assert body["metadata"]["agents_run"] == 5


@pytest.mark.asyncio
async def test_preview_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/verify/preview",
            json={"repo_path": "data/demo_repo", "changed_paths": ["apps/web/checkout.py"]},
        )
    assert res.status_code == 200
    body = res.json()
    assert "graph_excerpt" in body
    assert "retrieved_chunks" in body
    assert body["changed_paths"] == ["apps/web/checkout.py"]
    assert body["agents_planned"] == 5
    assert body["llm_mode"] in {"mock", "cerebras"}


def test_graph_cache_idempotent(repo_path):
    from backend.indexer.graph_cache import build_graph_cached

    g1 = build_graph_cached(repo_path)
    g2 = build_graph_cached(repo_path)
    assert len(g1["edges"]) == len(g2["edges"])
    assert g2.get("cached_files", 0) >= 1


def test_c_include_edges(repo_path):
    graph = build_graph(repo_path)
    assert any(n.endswith("gateway_stub.c") for n in graph["nodes"])
    assert any(
        e["from"].endswith("gateway_stub.c")
        and e["to"] == "packages/payments/client.h"
        and e["kind"] == "include_local"
        for e in graph["edges"]
    )


def test_source_file_discovery_includes_c(repo_path):
    from backend.indexer.source_files import iter_source_files

    names = {p.name for p in iter_source_files(repo_path)}
    assert "gateway_stub.c" in names
    assert "checkout.py" in names
