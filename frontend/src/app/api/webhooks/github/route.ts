import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  findRepoByGitHubFullName,
  runVerificationForRepo,
} from "@/lib/verify-service";
import {
  getGitHubToken,
  postPrComment,
  setCommitStatus,
} from "@/lib/github";

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const actual = signature.slice("sha256=".length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

function formatPrComment(run: { result?: { risk_level?: string; findings?: Array<{ title: string; severity: string }>; id?: string } }) {
  const findings = run.result?.findings ?? [];
  const risk = run.result?.risk_level ?? "unknown";
  const lines = [
    "## TrustLoop verification",
    "",
    `**Risk:** ${risk} · **Findings:** ${findings.length}`,
    "",
  ];
  if (findings.length === 0) {
    lines.push("No issues detected in scoped changes.");
  } else {
    for (const f of findings.slice(0, 8)) {
      lines.push(`- **${f.severity}** — ${f.title}`);
    }
    if (findings.length > 8) {
      lines.push(`- _…and ${findings.length - 8} more_`);
    }
  }
  lines.push("", `_Run \`${run.result?.id ?? "?"}\` registered in your TrustLoop dashboard._`);
  return lines.join("\n");
}

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "GITHUB_WEBHOOK_SECRET not configured" }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  const body = JSON.parse(payload);

  if (event === "pull_request") {
    const action = body.action;
    if (!["opened", "synchronize", "reopened"].includes(action)) {
      return NextResponse.json({ ok: true, skipped: action });
    }

    const pr = body.pull_request;
    const repo = body.repository;
    const fullName = repo.full_name as string;
    const dbRepo = await findRepoByGitHubFullName(fullName);
    if (!dbRepo) {
      return NextResponse.json({ ok: true, skipped: "repo not registered" });
    }

    const token = await getGitHubToken(dbRepo.userId);
    const sha = pr.head.sha as string;
    const owner = repo.owner.login as string;
    const repoName = repo.name as string;
    const prNumber = pr.number as number;
    const dashboardUrl = process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/app/repos/${dbRepo.id}`
      : undefined;

    if (token) {
      await setCommitStatus(token, owner, repoName, sha, "pending", "TrustLoop verification running…", dashboardUrl);
    }

    try {
      const run = await runVerificationForRepo({
        userId: dbRepo.userId,
        repository: dbRepo,
        scopeMode: "branch",
        baseRef: pr.base.ref as string,
        headRef: pr.head.ref as string,
        trigger: "pr",
        prNumber,
        prUrl: pr.html_url as string,
      });

      const state =
        (run.result?.findings?.length ?? 0) > 0 || run.result?.risk_level === "high"
          ? "failure"
          : "success";
      const description =
        state === "success"
          ? "TrustLoop: no blocking findings"
          : `TrustLoop: ${run.result?.findings?.length ?? 0} finding(s)`;

      if (token) {
        await setCommitStatus(token, owner, repoName, sha, state, description, dashboardUrl);
        await postPrComment(token, owner, repoName, prNumber, formatPrComment(run));
      }

      return NextResponse.json({ ok: true, runId: run.id, state });
    } catch (e) {
      if (token) {
        await setCommitStatus(
          token,
          owner,
          repoName,
          sha,
          "error",
          e instanceof Error ? e.message : "Verification failed",
          dashboardUrl,
        );
      }
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, event });
}
