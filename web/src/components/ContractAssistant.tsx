"use client";

import { FormEvent, useEffect, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};
type AssistantStatus = {
  geminiConfigured: boolean;
  model: string;
};

const maximumMessages = 20;
const maximumMessageLength = 6_000;
const maximumConversationLength = 48_000;

function getErrorMessage(body: string, fallback: string) {
  try {
    const data = JSON.parse(body) as { error?: unknown };
    if (typeof data.error === "string") return data.error;
  } catch {
    if (body.trim()) return body;
  }
  return fallback;
}

function getBoundedConversation(messages: Message[], nextMessage: Message) {
  const conversation = [...messages, nextMessage];
  while (
    conversation.length > maximumMessages ||
    (conversation.length > 1 &&
      conversation.reduce((total, message) => total + message.content.length, 0) > maximumConversationLength)
  ) {
    conversation.splice(0, 2);
  }
  return conversation;
}

export default function ContractAssistant() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/contract-assistant", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to check assistant configuration.");
        setStatus(await response.json() as AssistantStatus);
      })
      .catch(() => setStatusUnavailable(true));
  }, []);

  const configurationMessage = statusUnavailable
    ? "Assistant configuration could not be checked. Try again later."
    : status && !status.geminiConfigured
      ? "Gemini is not configured. A government administrator can add an API key in Government dashboard → API settings."
      : "";

  async function handleChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!content || busy) return;
    if (content.length > maximumMessageLength) {
      setError(`Keep each message under ${maximumMessageLength.toLocaleString()} characters.`);
      return;
    }

    const conversation = getBoundedConversation(messages, { role: "user", content });
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contract-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation }),
      });
      if (!response.ok) {
        throw new Error(getErrorMessage(await response.text(), "Unable to get a response from Gemini."));
      }

      const data = await response.json() as { response?: unknown };
      if (typeof data.response !== "string" || !data.response.trim()) {
        throw new Error("Gemini returned an invalid response.");
      }

      setMessages([...conversation, { role: "assistant", content: data.response }]);
      setQuestion("");
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Unable to get a response from Gemini.");
    } finally {
      setBusy(false);
    }
  }

  function clearConversation() {
    setMessages([]);
    setQuestion("");
    setError("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-[1000] flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
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
              Ask about using the portal, bidding, or general PNG procurement. Do not share confidential bid information.
            </p>

            <p className="text-sm font-semibold text-slate-800">Powered by Google Gemini</p>

            {configurationMessage ? (
              <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {configurationMessage}
              </p>
            ) : null}

            {messages.length ? (
              <div aria-live="polite" className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${index}-${message.role}`}
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${
                      message.role === "user"
                        ? "ml-auto bg-[#0d3b66] text-white"
                        : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {message.content}
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
              <label htmlFor="contract-assistant-question" className="sr-only">Ask the contract assistant</label>
              <textarea
                id="contract-assistant-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask Gemini a question..."
                rows={2}
                maxLength={maximumMessageLength}
                disabled={busy}
                className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0d3b66] disabled:bg-slate-100 disabled:text-slate-400"
              />
              <button
                type="submit"
                aria-label="Send question to Gemini"
                disabled={busy || !question.trim()}
                className="rounded-full bg-[#0d3b66] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123d72] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "..." : "Send"}
              </button>
            </form>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500" role="status">
                {busy ? "Asking Gemini..." : "Informational only; not legal advice."}
              </p>
              <button
                type="button"
                onClick={clearConversation}
                disabled={busy || messages.length === 0}
                className="text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-[#0d3b66] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear chat
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-label={open ? "Close contract assistant" : "Open contract assistant"}
        aria-expanded={open}
        aria-controls="contract-assistant-panel"
        className="inline-flex min-h-14 items-center gap-3 rounded-full border-2 border-white bg-[#d62828] px-6 py-3 font-bold text-white shadow-[0_12px_36px_rgba(13,59,102,0.35)] transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0d3b66]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.4-.76L4 20l1.76-4.34A7.46 7.46 0 0 1 5 12.5 7.5 7.5 0 1 1 20 11.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 12h7M8.5 9h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {open ? "Close help" : "Contract help"}
      </button>
    </div>
  );
}
