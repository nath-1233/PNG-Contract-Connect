"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type SettingsStatus = {
  geminiConfigured: boolean;
  claudeConfigured: boolean;
  geminiSaved: boolean;
  claudeSaved: boolean;
  geminiManagedByEnvironment: boolean;
  claudeManagedByEnvironment: boolean;
};

function getErrorMessage(body: string, fallback: string) {
  try {
    const data = JSON.parse(body) as { error?: unknown };
    if (typeof data.error === "string") return data.error;
  } catch {
    if (body.trim()) return body;
  }
  return fallback;
}

export default function AssistantApiSettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [clearGemini, setClearGemini] = useState(false);
  const [clearClaude, setClearClaude] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await sessionResponse.json();
        if (!sessionResponse.ok || !["government", "admin"].includes(session.user?.role)) {
          router.replace("/login");
          return;
        }

        const response = await fetch("/api/contract-assistant/settings", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(getErrorMessage(await response.text(), "Unable to load assistant settings."));
        }
        setStatus(await response.json() as SettingsStatus);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load assistant settings.");
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, [router]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const settings: Record<string, string | boolean> = {};
      if (geminiApiKey.trim()) settings.geminiApiKey = geminiApiKey.trim();
      if (claudeApiKey.trim()) settings.claudeApiKey = claudeApiKey.trim();
      if (clearGemini) settings.clearGemini = true;
      if (clearClaude) settings.clearClaude = true;

      const response = await fetch("/api/contract-assistant/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error(getErrorMessage(await response.text(), "Unable to save assistant settings."));
      }

      setStatus(await response.json() as SettingsStatus);
      setGeminiApiKey("");
      setClaudeApiKey("");
      setClearGemini(false);
      setClearClaude(false);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save assistant settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-100 px-4 py-10 text-center text-slate-600">Loading API settings...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/government-dashboard" className="text-sm font-semibold text-[#0d3b66] hover:underline">
          &larr; Government dashboard
        </Link>
        <header className="my-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Portal configuration</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Contract assistant API settings</h1>
          <p className="mt-2 leading-6 text-slate-600">
            Add server-side credentials to enable Gemini or Claude in the public contract assistant. Saved keys are never shown again after submission.
          </p>
        </header>

        {error ? <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {saved ? <p role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Assistant settings saved.</p> : null}

        {status ? (
          <form onSubmit={saveSettings} className="space-y-6">
            {([
              {
                id: "gemini",
                title: "Google Gemini",
                label: "Gemini API key",
                placeholder: "Paste a Gemini API key",
                value: geminiApiKey,
                setValue: setGeminiApiKey,
                visible: showGeminiKey,
                setVisible: setShowGeminiKey,
                configured: status.geminiConfigured,
                savedKey: status.geminiSaved,
                environmentManaged: status.geminiManagedByEnvironment,
                clear: clearGemini,
                setClear: setClearGemini,
              },
              {
                id: "claude",
                title: "Anthropic Claude",
                label: "Claude API key",
                placeholder: "Paste an Anthropic API key",
                value: claudeApiKey,
                setValue: setClaudeApiKey,
                visible: showClaudeKey,
                setVisible: setShowClaudeKey,
                configured: status.claudeConfigured,
                savedKey: status.claudeSaved,
                environmentManaged: status.claudeManagedByEnvironment,
                clear: clearClaude,
                setClear: setClearClaude,
              },
            ]).map((provider) => (
              <section key={provider.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{provider.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {provider.environmentManaged
                        ? "Configured by the server environment; that key takes priority over the saved key."
                        : provider.configured
                          ? "A key is saved on this server."
                          : "No key is configured."}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${provider.configured ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {provider.configured ? "Configured" : "Not configured"}
                  </span>
                </div>
                <label htmlFor={`${provider.id}-api-key`} className="mt-5 block text-sm font-semibold text-slate-700">
                  {provider.label}
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id={`${provider.id}-api-key`}
                    type={provider.visible ? "text" : "password"}
                    autoComplete="new-password"
                    value={provider.value}
                    onChange={(event) => provider.setValue(event.target.value)}
                    placeholder={provider.configured ? "Saved — leave blank to keep the current key" : provider.placeholder}
                    maxLength={4096}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => provider.setVisible((visible) => !visible)}
                    className="rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {provider.visible ? "Hide" : "Show"}
                  </button>
                </div>
                {provider.savedKey ? (
                  <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={provider.clear} onChange={(event) => provider.setClear(event.target.checked)} />
                    Remove the saved key
                  </label>
                ) : null}
              </section>
            ))}

            <button disabled={saving} type="submit" className="rounded-full bg-[#0d3b66] px-6 py-3 text-sm font-semibold text-white hover:bg-[#123d72] disabled:opacity-60">
              {saving ? "Saving..." : "Save API settings"}
            </button>
          </form>
        ) : null}

        <aside className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <h2 className="font-bold">Local testing and deployment</h2>
          <p className="mt-2">
            For local testing, keys entered here are stored in the untracked <code>web/.local-secrets/contract-assistant.json</code> file on this server. Do not commit or share that file.
          </p>
          <p className="mt-2">
            This file-based setting is intended only for a single local development server. For deployment, configure keys in your hosting provider&apos;s secret manager instead; environment variables take priority over saved keys.
          </p>
        </aside>
      </div>
    </main>
  );
}
