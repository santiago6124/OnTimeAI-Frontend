import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from "@/lib/auth-types";

function hardenCookie(response: NextResponse, token: string | undefined) {
  if (!token) return response;
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE_SECONDS,
    path: "/",
    priority: "high",
  });
  return response;
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    if (token) {
      return hardenCookie(
        NextResponse.redirect(new URL("/", request.url)),
        token,
      );
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return hardenCookie(NextResponse.next(), token);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
