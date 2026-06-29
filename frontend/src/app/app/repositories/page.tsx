"use client";

import Link from "next/link";
import { useState } from "react";
import type { Repository } from "@/lib/types";
import { addRepository, loadSettings } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

export default function RepositoriesPage() {
  const [repos, setRepos] = useState(() => loadSettings().repositories);
  const [showAdd, setShowAdd] = useState(false);
  const [source, setSource] = useState<"local" | "github">("local");
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  function register() {
    if (source === "github") {
      alert("GitHub connect is MVP — coming soon. Use local path for now.");
      return;
    }
    if (!name.trim() || !path.trim()) return;
    const repo: Repository = {
      id: crypto.randomUUID(),
      name: name.trim(),
      source: "local",
      path: path.trim(),
      defaultBranch: "main",
      connectedAt: new Date().toISOString(),
    };
    addRepository(repo);
    setRepos([repo, ...repos]);
    setShowAdd(false);
    setName("");
    setPath("");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase text-mute">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Repositories.</h1>
          <p className="mt-2 max-w-xl text-sm text-body">
            Register a codebase, then open it to start runs. Rules are auto-detected from{" "}
            <code className="font-mono text-xs">docs/trustloop_corpus/</code> inside the repo.
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
              Local path
            </button>
            <button
              type="button"
              className={`rounded-sm px-3 py-1.5 text-sm ${source === "github" ? "bg-ink text-on-primary" : "bg-canvas-soft-2"}`}
              onClick={() => setSource("github")}
            >
              GitHub (soon)
            </button>
          </div>

          {source === "local" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                Path on TrustLoop server
                <input
                  className="mt-1 h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
                  placeholder="data/demo_repo"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                />
              </label>
              <p className="md:col-span-2 text-xs text-mute">
                Relative to repo root (e.g. <code className="font-mono">data/demo_repo</code>,{" "}
                <code className="font-mono">data/orbital</code>). Browser file picker cannot set server paths — paste the path here.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <input
                className="h-10 w-full rounded-sm border border-hairline px-3 text-sm"
                placeholder="github.com/org/repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                disabled
              />
              <p className="mt-2 text-xs text-mute">GitHub App integration — post-MVP.</p>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button size="sm" onClick={register}>
              Register
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

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
              {repo.source === "local" ? "Local" : "GitHub"} · Click to open dashboard →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
