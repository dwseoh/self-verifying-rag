const run = {
  id: "run_violation_demo",
  trigger: "manual",
  repo_path: "data/demo_repo",
  base_ref: "main",
  head_ref: "HEAD",
  changed_paths: ["apps/web/checkout.py"],
  findings: [
    {
      id: "finding_boundary_1",
      severity: "high",
      confidence: 75,
      title: "Direct web to payments import",
      explanation:
        "checkout.py imports packages.payments.client, violating ARCH_ADR_004. Web must use apps.api.payments_gateway.",
      citation_ids: ["ARCH_ADR_004", "INCIDENT_PM_2024_03"],
      evidence_snippets: [
        {
          citation_id: "ARCH_ADR_004",
          text: "The web application (apps/web) must not import from the packages/payments package directly.",
        },
        {
          citation_id: "INCIDENT_PM_2024_03",
          text: "Direct apps/web to packages/payments imports caused duplicate charges under load.",
        },
      ],
      related_paths: ["apps/web/checkout.py"],
      recommended_fix:
        "Use apps.api.payments_gateway.create_payment_intent instead of importing payments.client.",
      detected_by: ["architecture_boundary", "incident_pattern"],
      status: "open",
    },
    {
      id: "finding_risk_1",
      severity: "medium",
      confidence: 88,
      title: "Payment data path change",
      explanation: "Modification touches customer payment flow; medium compliance risk until reviewed.",
      citation_ids: ["ARCH_ADR_004"],
      evidence_snippets: [
        {
          citation_id: "ARCH_ADR_004",
          text: "All payment operations from the web tier must go through the API gateway service.",
        },
      ],
      related_paths: ["apps/web/checkout.py"],
      recommended_fix: "Ensure payment calls stay on approved gateway path.",
      detected_by: ["risk"],
      status: "open",
    },
  ],
  risk_level: "high",
  overall_confidence: 82,
  verification_incomplete: false,
  agent_timeline: [
    { agent: "architecture_boundary", status: "ok", latency_ms: 138 },
    { agent: "incident_pattern", status: "ok", latency_ms: 121 },
    { agent: "risk", status: "ok", latency_ms: 119 },
  ],
  retrieved_chunks: [
    {
      citation_id: "ARCH_ADR_004",
      document_title: "Arch Adr 004 Service Boundaries",
      section_title: "Service Boundary Rules",
      text: "The web application must not import from the packages/payments package directly.",
      score: 0.92,
    },
    {
      citation_id: "INCIDENT_PM_2024_03",
      document_title: "Incident Pm 2024 03 Payments Bypass",
      section_title: "Direct web-to-payments import outage",
      text: "Direct apps/web to packages/payments imports caused duplicate charges.",
      score: 0.88,
    },
  ],
  latency: {
    indexing_ms: 35,
    retrieval_ms: 22,
    parallel_verification_ms: 138,
    composition_ms: 8,
    total_ms: 203,
  },
  metadata: {
    files_checked: 3,
    citations_consulted: 5,
    agents_run: 3,
  },
};

const byId = (id) => document.getElementById(id);

function titleCase(value) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderSummary(data) {
  byId("riskLevel").textContent = titleCase(data.risk_level);
  byId("confidence").textContent = `${data.overall_confidence}%`;
  byId("latency").textContent = `${data.latency.total_ms}ms`;
  byId("agentsRun").textContent = data.metadata.agents_run;
  byId("runId").textContent = data.id;
}

function renderFindings(data) {
  const list = byId("findingsList");

  if (data.findings.length === 0) {
    list.innerHTML = `<div class="empty">No open findings for this run.</div>`;
    return;
  }

  list.innerHTML = data.findings
    .map(
      (finding) => `
        <article class="finding">
          <div class="finding-header">
            <h3>${finding.title}</h3>
            <span class="severity ${finding.severity}">${finding.severity}</span>
          </div>
          <p>${finding.explanation}</p>
          <div class="meta-row">
            <span>${finding.confidence}% confidence</span>
            <span>${finding.related_paths.join(", ")}</span>
            <span>${finding.detected_by.map(titleCase).join(", ")}</span>
          </div>
          <div class="fix">${finding.recommended_fix}</div>
        </article>
      `,
    )
    .join("");
}

function renderTimeline(data) {
  const timeline = byId("timeline");
  const maxLatency = Math.max(...data.agent_timeline.map((agent) => agent.latency_ms), 1);

  timeline.innerHTML = data.agent_timeline
    .map((agent) => {
      const width = Math.max(12, Math.round((agent.latency_ms / maxLatency) * 100));

      return `
        <div class="agent">
          <div class="agent-row">
            <span class="agent-name">${titleCase(agent.agent)}</span>
            <span class="agent-ms">${agent.latency_ms}ms - ${agent.status}</span>
          </div>
          <div class="bar" aria-hidden="true"><span style="width: ${width}%"></span></div>
        </div>
      `;
    })
    .join("");
}

function renderCitations(data) {
  const citations = byId("citations");

  citations.innerHTML = data.retrieved_chunks
    .map(
      (chunk) => `
        <article class="citation">
          <strong>${chunk.citation_id} - ${chunk.document_title}</strong>
          <p>${chunk.text}</p>
        </article>
      `,
    )
    .join("");
}

function render(data) {
  renderSummary(data);
  renderFindings(data);
  renderTimeline(data);
  renderCitations(data);
}

byId("verifyButton").addEventListener("click", () => render(run));

render(run);
