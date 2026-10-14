"use client";

import { FormEvent, useEffect, useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

type ServiceStatus = "checking" | "configured" | "unconfigured" | "unavailable";

const sessionStorageKey = "png-contract-assistant-session";
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function getErrorMessage(body: string, fallback: string) {
  try {
    const data = JSON.parse(body) as { error?: unknown; detail?: unknown };
    if (typeof data.error === "string") return data.error;
    if (typeof data.detail === "string") return data.detail;
  } catch {
    if (body.trim()) return body;
  }
  return fallback;
}

export default function ContractAssistant() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("checking");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/contract-assistant/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to check assistant configuration.");
        const data = await response.json() as { configured?: boolean };
        setServiceStatus(data.configured ? "configured" : "unconfigured");
      })
      .catch(() => setServiceStatus("unavailable"));
  }, []);

  function toggleAssistant() {
    if (!open && !sessionId && !sessionError) {
      try {
        const storedSessionId = window.sessionStorage.getItem(sessionStorageKey);
        const id = storedSessionId && uuidPattern.test(storedSessionId)
          ? storedSessionId
          : window.crypto.randomUUID();

        if (id !== storedSessionId) {
          window.sessionStorage.setItem(sessionStorageKey, id);
        }
        setSessionId(id);
      } catch {
        setSessionError("Browser session storage is unavailable. Enable it to use the contract assistant.");
      }
    }
    setOpen((isOpen) => !isOpen);
  }

  const requestHeaders = () => ({ "X-Session-ID": sessionId });

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file");
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF document to continue.");
      return;
    }
    if (!sessionId) {
      setError(sessionError || "The browser session is not ready yet.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/contract-assistant/upload", {
        method: "POST",
        headers: requestHeaders(),
        body: formData,
      });
      if (!response.ok) {
        throw new Error(getErrorMessage(await response.text(), "Unable to upload this document."));
      }

      setUploaded(true);
      setMessages([]);
      setError("");
      form.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload this document.");
    } finally {
      setBusy(false);
    }
  }

  async function handleChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = question.trim();
    if (!query || busy) return;
    if (!sessionId) {
      setError(sessionError || "The browser session is not ready yet.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contract-assistant/chat", {
        method: "POST",
        headers: { ...requestHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        throw new Error(getErrorMessage(await response.text(), "Unable to get an answer."));
      }

      const data = await response.json() as { response?: unknown };
      if (typeof data.response !== "string" || !data.response.trim()) {
        throw new Error("The contract assistant returned an invalid response.");
      }
      const answer = data.response;

      setMessages((current) => [
        ...current,
        { id: Date.now(), role: "user", text: query },
        { id: Date.now() + 1, role: "assistant", text: answer },
      ]);
      setQuestion("");
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to get an answer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contract-assistant/reset", {
        method: "POST",
        headers: requestHeaders(),
      });
      if (!response.ok) {
        throw new Error(getErrorMessage(await response.text(), "Unable to clear the assistant session."));
      }
      setMessages([]);
      setQuestion("");
      setUploaded(false);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to clear the assistant session.");
    } finally {
      setBusy(false);
    }
  }

  const configurationMessage = serviceStatus === "unconfigured"
    ? "The assistant is not configured yet. Set CONTRACT_ASSISTANT_API_URL on the portal server."
    : serviceStatus === "unavailable"
      ? "Assistant configuration could not be checked. Try again later."
      : "";
  const actionsDisabled = busy || !sessionId || serviceStatus !== "configured";

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {open ? (
        <section
          id="contract-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="contract-assistant-title"
          className="flex h-[min(38rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between gap-4 bg-[#0d3b66] px-5 py-4 text-white">
            <div>
              <h2 id="contract-assistant-title" className="text-lg font-bold">Contract tracker assistant</h2>
              <p className="mt-1 text-xs text-sky-100">Help for contractors, officers, and visitors</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close contract assistant"
              className="rounded-full p-2 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <p className="text-sm leading-6 text-slate-600">
              Upload a contract PDF, then ask questions about its requirements, dates, or terms. Your document is isolated to this browser session.
            </p>

            {configurationMessage ? (
              <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {configurationMessage}
              </p>
            ) : null}
            {sessionError ? (
              <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {sessionError}
              </p>
            ) : null}

            {!uploaded ? (
              <form onSubmit={handleUpload} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <label htmlFor="contract-assistant-file" className="mb-2 block text-sm font-semibold text-slate-800">
                  Upload a contract PDF
                </label>
                <input
                  id="contract-assistant-file"
                  name="file"
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={actionsDisabled}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0d3b66] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={actionsDisabled}
                  className="mt-3 w-full rounded-full bg-[#0d3b66] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123d72] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Uploading..." : "Upload document"}
                </button>
              </form>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                PDF uploaded. Ask a question about this document.
              </div>
            )}

            {messages.length ? (
              <div aria-live="polite" className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${
                      message.role === "user"
                        ? "ml-auto bg-[#0d3b66] text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-slate-200 p-4">
            <form onSubmit={handleChat} className="flex items-end gap-2">
              <label htmlFor="contract-assistant-question" className="sr-only">Ask about your contract</label>
              <textarea
                id="contract-assistant-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={uploaded ? "Ask a question..." : "Upload a PDF to ask questions"}
                rows={2}
                disabled={actionsDisabled || !uploaded}
                className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0d3b66] disabled:bg-slate-100 disabled:text-slate-400"
              />
              <button
                type="submit"
                aria-label="Send question"
                disabled={actionsDisabled || !uploaded || !question.trim()}
                className="rounded-full bg-[#0d3b66] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123d72] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "..." : "Send"}
              </button>
            </form>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{busy ? "Working..." : "Answers are based on your uploaded PDF."}</p>
              <button
                type="button"
                onClick={handleReset}
                disabled={actionsDisabled}
                className="text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-[#0d3b66] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear session
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={toggleAssistant}
        aria-expanded={open}
        aria-controls="contract-assistant-panel"
        className="inline-flex items-center gap-2 rounded-full bg-[#d62828] px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d3b66]"
      >
        <span aria-hidden="true">?</span>
        {open ? "Close help" : "Contract help"}
      </button>
    </div>
  );
}
