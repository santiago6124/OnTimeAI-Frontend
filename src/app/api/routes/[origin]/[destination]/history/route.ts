// UGS-133: endpoint de historial de puntualidad por ruta
// Implementación con mock data; cuando FastAPI esté disponible (Sprint 3)
// el frontend solo necesita cambiar la base URL.
import { NextResponse } from "next/server";
import { MOCK_ROUTE_HISTORY } from "@/lib/mock-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ origin: string; destination: string }> },
) {
  const { origin, destination } = await params;
  const key = `${origin.toUpperCase()} → ${destination.toUpperCase()}`;
  const data = MOCK_ROUTE_HISTORY[key] ?? [];

  return NextResponse.json({ route: key, data });
}
