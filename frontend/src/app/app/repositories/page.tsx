"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Repository } from "@/lib/types";
import {
  createRepository,
  discoverLocalRepos,
  fetchGitHubRepos,
  fetchRepositories,
} from "@/lib/saas-api";
import { Button } from "@/components/ui/button";

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [source, setSource] = useState<"local" | "github">("local");
  const [name, setName] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [search, setSearch] = useState("");
  const [discovered, setDiscovered] = useState<
    Array<{ name: string; path: string; default_branch: string }>
  >([]);
  const [ghRepos, setGhRepos] = useState<
    Array<{ fullName: string; name: string; owner: string; defaultBranch: string }>
  >([]);
  const [selectedGh, setSelectedGh] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRepositories().then(setRepos).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!showAdd || source !== "local") return;
    const t = setTimeout(() => {
      discoverLocalRepos(search).then(setDiscovered);
    }, 300);
    return () => clearTimeout(t);
  }, [search, showAdd, source]);

  useEffect(() => {
    if (showAdd && source === "github") {
      fetchGitHubRepos().then(setGhRepos);
    }
  }, [showAdd, source]);

  async function register() {
    setSaving(true);
    setError(null);
    try {
      let repo: Repository;
      if (source === "github") {
        const pick = ghRepos.find((r) => r.fullName === selectedGh);
        if (!pick) throw new Error("Select a GitHub repository");
        repo = await createRepository({
          source: "github",
          name: name.trim() || pick.name,
          githubOwner: pick.owner,
          githubRepo: pick.name,
          githubFullName: pick.fullName,
          defaultBranch: pick.defaultBranch,
        });
      } else {
        if (!localPath.trim()) throw new Error("Select or enter a local git path");
        repo = await createRepository({
          source: "local",
          name: name.trim() || localPath.split("/").pop(),
          localPath: localPath.trim(),
        });
      }
      setRepos((prev) => [repo, ...prev]);
      setShowAdd(false);
      setName("");
      setLocalPath("");
      setSelectedGh("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase text-mute">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Repositories.</h1>
          <p className="mt-2 max-w-xl text-sm text-body">
            Connect a local git repo (searched on the TrustLoop server) or a GitHub repository.
            PR webhooks register runs automatically when CI is enabled.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          Add repository
        </Button>
      </div>

      {showAdd && (
        <section className="card-float rounded-lg bg-canvas p-6">
          <h2 className="text-lg font-semibold">Register repository</h2>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`rounded-sm px-3 py-1.5 text-sm ${source === "local" ? "bg-ink text-on-primary" : "bg-canvas-soft-2"}`}
              onClick={() => setSource("local")}
            >
              Local git
            </button>
            <button
              type="button"
              className={`rounded-sm px-3 py-1.5 text-sm ${source === "github" ? "bg-ink text-on-primary" : "bg-canvas-soft-2"}`}
              onClick={() => setSource("github")}
            >
              GitHub
            </button>
          </div>

          {source === "local" ? (
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                Display name
                <input
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3"
                  placeholder="My project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Search local git repos
                <input
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
                  placeholder="orbital, self-verifying, …"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="max-h-48 overflow-y-auto rounded-md border border-hairline">
                {discovered.length === 0 ? (
                  <p className="p-3 text-xs text-mute">No repos found — try another query or paste path below.</p>
                ) : (
                  discovered.map((r) => (
                    <button
                      key={r.path}
                      type="button"
                      onClick={() => {
                        setLocalPath(r.path);
                        if (!name) setName(r.name);
                      }}
                      className={`block w-full border-b border-hairline px-3 py-2 text-left text-sm last:border-0 hover:bg-canvas-soft ${
                        localPath === r.path ? "bg-canvas-soft-2" : ""
                      }`}
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-mute">{r.path}</span>
                    </button>
                  ))
                )}
              </div>
              <label className="block text-sm">
                Or paste absolute path
                <input
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
                  placeholder="/Users/you/Documents/Repositories/my-app"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-body">
                Sign in with GitHub to list repositories. Connecting registers a webhook for PR checks
                when <code className="font-mono">TRUSTLOOP_WEBHOOK_URL</code> is configured on deploy.
              </p>
              <label className="block text-sm">
                GitHub repository
                <select
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 text-sm"
                  value={selectedGh}
                  onChange={(e) => setSelectedGh(e.target.value)}
                >
                  <option value="">Select…</option>
                  {ghRepos.map((r) => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Display name
                <input
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-error">{error}</p>}

          <div className="mt-6 flex gap-2">
            <Button size="sm" onClick={register} disabled={saving}>
              {saving ? "Connecting…" : "Register"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-body">Loading repositories…</p>
      ) : repos.length === 0 ? (
        <div className="card-elevated rounded-lg bg-canvas p-12 text-center">
          <p className="text-sm text-body">No repositories yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {repos.map((repo) => (
            <Link
              key={repo.id}
              href={`/app/repos/${repo.id}`}
              className="card-float block rounded-lg bg-canvas p-6 transition hover:border-hairline-strong"
            >
              <h2 className="text-lg font-semibold text-ink">{repo.name}</h2>
              <p className="mt-2 font-mono text-sm text-body">{repo.path}</p>
              <p className="mt-4 text-xs text-mute">
                {repo.source === "local" ? "Local git" : "GitHub"} · Click to open dashboard →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
