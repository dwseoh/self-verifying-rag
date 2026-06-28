from backend.models import AgentResult, Finding


def score_findings(findings: list[Finding], verification_incomplete: bool) -> list[Finding]:
    scored: list[Finding] = []
    for f in findings:
        score = 100
        if f.severity.value == "high":
            score -= 25
        elif f.severity.value == "medium":
            score -= 12
        elif f.severity.value == "low":
            score -= 5
        if not f.citation_ids:
            score -= 15
        if verification_incomplete:
            score = min(score, 70)
        scored.append(f.model_copy(update={"confidence": max(0, min(100, score))}))
    return scored


def overall_confidence(
    findings: list[Finding],
    verification_incomplete: bool,
    *,
    corpus_weak: bool = False,
) -> int:
    if not findings:
        if verification_incomplete:
            return 85
        if corpus_weak:
            return 55
        return 100
    return max(0, min(100, int(sum(f.confidence for f in findings) / len(findings))))
