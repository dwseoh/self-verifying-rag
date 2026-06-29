"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type GitHubStatus = {
  oauthConfigured: boolean;
  connected: boolean;
  providerAccountId?: string;
  scope?: string | null;
};

export function GitHubConnection() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const justLinked = searchParams.get("github") === "linked";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/github-connection", { cache: "no-store" });
      if (res.ok) {
        setStatus(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, justLinked]);

  async function connect() {
    setLinking(true);
    await signIn("github", { callbackUrl: "/app/settings?github=linked" });
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/user/github-connection", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading && !status) {
    return <p className="text-sm text-body">Checking GitHub connection…</p>;
  }

  if (!status?.oauthConfigured) {
    return (
      <p className="text-sm text-body">
        GitHub OAuth is not configured on this server. Add{" "}
        <code className="font-mono text-xs">GITHUB_ID</code> and{" "}
        <code className="font-mono text-xs">GITHUB_SECRET</code> to{" "}
        <code className="font-mono text-xs">frontend/.env.local</code>, then restart the dev server.
      </p>
    );
  }

  if (status.connected) {
    return (
      <div className="space-y-3">
        {justLinked && (
          <p className="rounded-lg border border-link/20 bg-link-bg-soft px-3 py-2 text-sm text-link-deep">
            GitHub connected. You can import repositories from the{" "}
            <Link href="/app/repositories" className="underline">
              Repositories
            </Link>{" "}
            page.
          </p>
        )}
        <p className="text-sm text-body">
          <span className="font-medium text-ink">Connected</span>
          {status.providerAccountId ? (
            <span className="text-mute"> · account {status.providerAccountId}</span>
          ) : null}
        </p>
        <p className="text-xs text-mute">
          Scopes: {status.scope ?? "read:user user:email repo admin:repo_hook"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={connect} disabled={linking || disconnecting}>
            {linking ? "Reconnecting…" : "Reconnect GitHub"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={disconnect}
            disabled={linking || disconnecting}
          >
            {disconnecting ? "Disconnecting…" : "Disconnect GitHub"}
          </Button>
        </div>
        <p className="text-xs text-body">
          Disconnect removes the stored token in TrustLoop only. To fully reset OAuth, also revoke the app at{" "}
          <a
            href="https://github.com/settings/applications"
            target="_blank"
            rel="noreferrer"
            className="text-link hover:underline"
          >
            GitHub → Settings → Applications
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-body">
        Connect GitHub to list and import repositories, register PR webhooks, and post commit statuses.
        Your GitHub account is linked to this workspace — you stay signed in with email.
      </p>
      <p className="text-xs text-body">
        Use the same email on GitHub as your TrustLoop account so linking works. In production, set{" "}
        <code className="font-mono">AUTH_ALLOW_EMAIL_LINKING=1</code> if emails match but linking fails.
      </p>
      <Button type="button" onClick={connect} disabled={linking}>
        {linking ? "Redirecting to GitHub…" : "Connect GitHub"}
      </Button>
    </div>
  );
}
