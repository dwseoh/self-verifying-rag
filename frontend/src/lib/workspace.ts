"use client";

import type { Repository, StoredRun, WorkspaceSettings } from "./types";

const SETTINGS_KEY = "trustloop.workspace";
const runsKey = (repoId: string) => `trustloop.runs.${repoId}`;

export const DEFAULT_REPOS: Repository[] = [];

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  cerebrasApiKey: "",
  apiKeyVerified: false,
  apiKeyLastChecked: null,
  backendUrl: "/backend",
  repositories: DEFAULT_REPOS,
};

export function loadSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      repositories: parsed.repositories?.length ? parsed.repositories : DEFAULT_REPOS,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: WorkspaceSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getRepo(id: string): Repository | undefined {
  return loadSettings().repositories.find((r) => r.id === id);
}

export function addRepository(repo: Repository): void {
  const s = loadSettings();
  saveSettings({ ...s, repositories: [repo, ...s.repositories] });
}

export function loadRuns(repoId: string): StoredRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(runsKey(repoId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRun(stored: StoredRun): void {
  const existing = loadRuns(stored.repoId);
  localStorage.setItem(runsKey(stored.repoId), JSON.stringify([stored, ...existing].slice(0, 20)));
}

export function titleCase(value: string): string {
  return value
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
