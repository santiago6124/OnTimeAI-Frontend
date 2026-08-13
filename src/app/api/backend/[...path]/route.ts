import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth-types";

const BACKEND =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Sesión requerida" }, { status: 401 });
  }

  const { path } = await context.params;
  const backendPath = path.map(encodeURIComponent).join("/");
  const url = new URL(`${BACKEND}/${backendPath}`);
  url.search = request.nextUrl.search;

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    Authorization: `Bearer ${token}`,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const upstream = await fetch(url, {
      method: request.method,
      cache: "no-store",
      headers,
      body: METHODS_WITH_BODY.has(request.method)
        ? await request.arrayBuffer()
        : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
    if (upstream.status === 401) {
      response.cookies.set(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { detail: "El Backend no respondió a tiempo" },
      { status: 504 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
