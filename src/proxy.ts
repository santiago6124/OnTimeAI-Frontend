import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS } from "@/lib/auth-types";

/**
 * Rutas accesibles con o sin sesión. El resto de la app es Modo Pro y exige
 * autenticación.
 *
 * - `/live`: Modo Lite, vista pública de solo lectura (issue #1).
 * - `/privacidad` y `/soporte`: las dos tiendas exigen que abran sin login, y
 *   Apple lo verifica antes de aceptar el envío a revisión.
 */
const PUBLIC_ROUTES = ["/live", "/privacidad", "/soporte"];

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

  // Modo Lite: no exige sesión. Si el visitante la tiene, se le renueva igual.
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isPublic) {
    return hardenCookie(NextResponse.next(), token);
  }

  // Login y alta: accesibles sin sesión, y sin sentido con una. Quien ya entró
  // y vuelve acá —por un enlace viejo, por el botón de atrás— va al inicio en
  // vez de ver un formulario que no necesita.
  if (pathname === "/login" || pathname === "/signup") {
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
  // Se excluyen rutas de API (una redirección rompería los fetch del BFF),
  // assets de Next y cualquier archivo con extensión — estos últimos para que
  // el favicon y las imágenes carguen en /live sin sesión.
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.).*)"],
};
