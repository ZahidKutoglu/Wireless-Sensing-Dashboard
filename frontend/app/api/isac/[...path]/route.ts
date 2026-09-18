import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

function backendBase() {
  const fromEnv = process.env.ISAC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL) return "";
  return "http://127.0.0.1:8010";
}

async function proxy(req: NextRequest, context: { params: { path: string[] } }) {
  const backend = backendBase();
  if (!backend) {
    return Response.json(
      {
        error: "backend_unconfigured",
        detail: "Set ISAC_API_URL to your deployed FastAPI origin, e.g. https://isac-api.vercel.app",
      },
      { status: 503 }
    );
  }

  const path = (context.params.path ?? []).join("/");
  const target = `${backend}/api/isac/${path}${req.nextUrl.search}`;
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const contentType = req.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;

    const init: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.text();
    }

    const res = await fetch(target, init);
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "backend_unreachable",
        backend,
        detail: error instanceof Error ? error.message : "fetch failed",
      },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, context: { params: { path: string[] } }) {
  return proxy(req, context);
}

export async function POST(req: NextRequest, context: { params: { path: string[] } }) {
  return proxy(req, context);
}
