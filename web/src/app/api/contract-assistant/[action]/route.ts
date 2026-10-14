const actions = new Set(["upload", "chat", "reset"]);
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ action: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { action } = await params;

  if (action !== "status") {
    return Response.json({ error: "This contract assistant action was not found." }, { status: 404 });
  }

  return Response.json({ configured: Boolean(process.env.CONTRACT_ASSISTANT_API_URL) });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { action } = await params;

  if (!actions.has(action)) {
    return Response.json({ error: "This contract assistant action was not found." }, { status: 404 });
  }

  const sessionId = request.headers.get("X-Session-ID");
  if (!sessionId || !uuidPattern.test(sessionId)) {
    return Response.json({ error: "A valid browser session ID is required." }, { status: 400 });
  }

  const serviceUrl = process.env.CONTRACT_ASSISTANT_API_URL;
  if (!serviceUrl) {
    return Response.json(
      { error: "The contract assistant is not configured. Set CONTRACT_ASSISTANT_API_URL on the portal server." },
      { status: 503 },
    );
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(serviceUrl);
    if (!["http:", "https:"].includes(upstreamUrl.protocol)) {
      throw new Error("Unsupported service URL protocol.");
    }
    upstreamUrl.pathname = `${upstreamUrl.pathname.replace(/\/+$/, "")}/${action}`;
    upstreamUrl.search = "";
    upstreamUrl.hash = "";
  } catch {
    return Response.json(
      { error: "The contract assistant service URL is invalid. Check CONTRACT_ASSISTANT_API_URL on the portal server." },
      { status: 500 },
    );
  }

  let body: BodyInit;
  const headers = new Headers({ "X-Session-ID": sessionId });

  if (action === "upload") {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ error: "Upload a PDF document to continue." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Choose a PDF document to continue." }, { status: 400 });
    }

    const upload = new FormData();
    upload.append("file", file, file.name);
    body = upload;
  } else {
    body = await request.arrayBuffer();
    const contentType = request.headers.get("Content-Type");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "The contract assistant service could not be reached." },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  const responseContentType = upstream.headers.get("Content-Type");
  if (responseContentType) {
    responseHeaders.set("Content-Type", responseContentType);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
