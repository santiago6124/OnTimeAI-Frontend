import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth-types";

export async function POST(request: Request) {

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
