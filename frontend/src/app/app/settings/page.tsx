"use client";

import { useState } from "react";
import { fetchHealth, testLlmConnection } from "@/lib/api";
import { loadSettings, saveSettings } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadSettings);
  const [draftKey, setDraftKey] = useState(settings.cerebrasApiKey);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    const next = { ...settings, cerebrasApiKey: draftKey };
    try {
      await fetchHealth(next.backendUrl);
      const llm = await testLlmConnection(next.backendUrl);
      if (llm.status === "ok") {
        next.apiKeyVerified = true;
        next.apiKeyLastChecked = new Date().toISOString();
        setMessage({ type: "ok", text: "Backend connected · Cerebras API key is working." });
      } else {
        next.apiKeyVerified = false;
        next.apiKeyLastChecked = new Date().toISOString();
        const health = await fetchHealth(next.backendUrl);
        if (health.mock_mode) {
          setMessage({
            type: "error",
            text: "Backend has no API key (mock mode). Add CEREBRAS_API_KEY to backend .env — the key here is stored for future BYOK only.",
          });
        } else {
          setMessage({ type: "error", text: llm.error ?? "LLM check failed" });
        }
      }
      saveSettings(next);
      setSettings(next);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Cannot reach backend",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="font-mono text-xs uppercase text-mute">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Workspace.</h1>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border border-link/20 bg-link-bg-soft text-link-deep"
              : "border border-error/20 bg-error-soft text-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="card-float space-y-4 rounded-lg bg-canvas p-6">
        <h2 className="text-lg font-semibold">Cerebras API key</h2>
        <p className="text-sm text-body">
          Runs call the backend, which uses <code className="font-mono text-xs">CEREBRAS_API_KEY</code> in{" "}
          <code className="font-mono text-xs">.env</code> today. Save here to test connectivity; per-request BYOK
          ships next.
        </p>
        <input
          type="password"
          placeholder="csk-…"
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
          className="h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
        />
        {settings.apiKeyLastChecked && (
          <p className="text-xs text-mute">
            Last checked: {new Date(settings.apiKeyLastChecked).toLocaleString()} ·{" "}
            {settings.apiKeyVerified ? "Verified" : "Not verified"}
          </p>
        )}
      </section>

      <section className="card-elevated space-y-4 rounded-lg bg-canvas p-6">
        <h2 className="text-lg font-semibold">Backend URL</h2>
        <input
          value={settings.backendUrl}
          onChange={(e) => setSettings({ ...settings, backendUrl: e.target.value })}
          className="h-10 w-full rounded-sm border border-hairline px-3 font-mono text-sm"
        />
      </section>

      <Button onClick={saveAll} disabled={saving}>
        {saving ? "Saving…" : "Save & test connection"}
      </Button>
    </div>
  );
}
