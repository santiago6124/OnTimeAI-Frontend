/**
 * Ingreso con usuario y contraseña del backend, sin pasar por Firebase.
 *
 * Las cuentas sembradas desde el entorno (`admin`, `viewer`) y las que se dan
 * de alta en /admin no tienen correo: viven sólo en `users.db`. El formulario
 * de login mandaba todo a Firebase, que rechazaba `admin` por no ser un correo
 * antes de mirar la contraseña, y la única forma de entrar era llamar a
 * /api/auth/login desde la consola del navegador.
 *
 * Lo que no tiene `@` no puede ser un correo de Firebase, así que va al
 * backend. Un correo sigue yendo a Firebase como siempre.
 */

import { ApiError, apiLogin } from "@/lib/api";
import { safeReturnPath } from "@/lib/auth-types";

export function esUsuarioDelBackend(identificador: string): boolean {
  const valor = identificador.trim();
  return valor.length > 0 && !valor.includes("@");
}

function mensajeDeFallo(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 401) {
    return "Usuario o contraseña incorrectos.";
  }
  if (cause instanceof ApiError) return cause.message;
  return "No se pudo iniciar sesión. Probá de nuevo.";
}

/**
 * Abre la sesión y navega a `desde` (o al inicio). Si falla, no navega y le
 * pasa el mensaje a `onError`.
 */
export async function ingresarConUsuario(
  usuario: string,
  password: string,
  desde: string | null,
  onError: (mensaje: string) => void,
  {
    login = apiLogin,
    navegar = (destino: string) => window.location.replace(destino),
  }: {
    login?: typeof apiLogin;
    navegar?: (destino: string) => void;
  } = {},
): Promise<void> {
  try {
    await login(usuario.trim(), password);
  } catch (cause) {
    onError(mensajeDeFallo(cause));
    return;
  }
  navegar(desde ? safeReturnPath(desde) : "/");
}
