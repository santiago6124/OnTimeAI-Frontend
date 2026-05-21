import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ origin: string; destination: string }> },
) {
  const { origin, destination } = await params;
  const auth = req.headers.get("Authorization") ?? "";
  try {
    const res = await fetch(`${BACKEND}/metrics/routes/${origin}/${destination}/history`, {
      headers: auth ? { Authorization: auth } : {},
    });
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
