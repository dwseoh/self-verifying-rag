from backend.models import AgentResult, CorpusChunk, EvidenceSnippet, Finding


def _infer_fix(finding: Finding, chunks: list[CorpusChunk]) -> str | None:
    by_id = {c.citation_id: c for c in chunks}
    for cid in finding.citation_ids:
        ch = by_id.get(cid)
        if not ch:
            continue
        for line in ch.text.splitlines():
            low = line.lower()
            if any(k in low for k in ("fix:", "how to fix", "instead", "should", "must not", "do not")):
                return line.strip().lstrip("-•# ").strip()[:500]
    if finding.related_paths:
        return f"Review and update {finding.related_paths[0]} to align with cited rules."
    return None


def attach_evidence(findings: list[Finding], chunks: list[CorpusChunk]) -> list[Finding]:
    by_id = {c.citation_id: c for c in chunks}
    out: list[Finding] = []
    for f in findings:
        snippets = [
            EvidenceSnippet(citation_id=cid, text=by_id[cid].text[:500])
            for cid in f.citation_ids
            if cid in by_id
        ]
        out.append(f.model_copy(update={"evidence_snippets": snippets}))
    finalized: list[Finding] = []
    for f in out:
        fix = f.recommended_fix or _infer_fix(f, chunks)
        finalized.append(f.model_copy(update={"recommended_fix": fix}) if fix else f)
    return finalized


def compose_findings(agent_results: list[AgentResult], chunks: list[CorpusChunk]) -> list[Finding]:
    merged: dict[tuple[str, str], Finding] = {}
    for result in agent_results:
        if result.status != "ok":
            continue
        for f in result.findings:
            key = (f.title.lower(), tuple(sorted(f.related_paths)))
            if key in merged:
                existing = merged[key]
                merged[key] = existing.model_copy(
                    update={
                        "detected_by": list(set(existing.detected_by + f.detected_by)),
                        "citation_ids": list(set(existing.citation_ids + f.citation_ids)),
                    }
                )
            else:
                merged[key] = f
    findings = attach_evidence(list(merged.values()), chunks)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda x: (severity_order.get(x.severity.value, 9), -x.confidence))
    return findings
