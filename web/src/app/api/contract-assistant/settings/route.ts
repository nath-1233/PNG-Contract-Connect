import { getCurrentUser } from "@/lib/auth";
import {
  getAssistantKeyStatus,
  getSavedGeminiApiKey,
  saveGeminiApiKey,
} from "@/lib/contract-assistant-config";

const maximumApiKeyLength = 4_096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["government", "admin"].includes(user.role)) {
    return Response.json({ error: "Government or administrator access is required." }, { status: user ? 403 : 401 });
  }

  try {
    return Response.json(await getAssistantKeyStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to read assistant settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["government", "admin"].includes(user.role)) {
    return Response.json({ error: "Government or administrator access is required." }, { status: user ? 403 : 401 });
  }
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "Key saving is disabled in production. Configure credentials in the hosting provider's secret manager." },
      { status: 503 },
    );
  }
  if (!isAllowedOrigin(request)) {
    return Response.json({ error: "The settings request must come from this website." }, { status: 403 });
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Send settings as JSON." }, { status: 415 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) {
      return Response.json({ error: "The settings request is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Send valid settings." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json({ error: "Send valid settings." }, { status: 400 });
  }

  if (
    Object.keys(body).some((key) => !["geminiApiKey", "clearGemini"].includes(key)) ||
    (body.geminiApiKey !== undefined && typeof body.geminiApiKey !== "string") ||
    (body.clearGemini !== undefined && typeof body.clearGemini !== "boolean")
  ) {
    return Response.json({ error: "Send valid API key settings." }, { status: 400 });
  }

  try {
    const currentKey = await getSavedGeminiApiKey();
    const submittedGeminiKey = typeof body.geminiApiKey === "string" ? body.geminiApiKey.trim() : undefined;
    if ((submittedGeminiKey?.length ?? 0) > maximumApiKeyLength) {
      return Response.json({ error: "API keys must be 4,096 characters or fewer." }, { status: 400 });
    }
    const geminiApiKey = body.clearGemini === true ? "" : submittedGeminiKey ?? currentKey;
    await saveGeminiApiKey({ geminiApiKey });
    return Response.json(await getAssistantKeyStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to save assistant settings on this server." }, { status: 500 });
  }
}
