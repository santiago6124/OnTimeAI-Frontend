/**
 * Entrada rápida con Face ID en el bundle de iOS.
 *
 * ## Qué resuelve
 *
 * El JWT del backend vence a las 8 h. Pasado eso, el arranque del bundle cae
 * en el login y hay que volver a escribir correo y contraseña, aunque Firebase
 * siga teniendo la sesión viva en IndexedDB —se renueva sola con su refresh
 * token—. Face ID es el permiso del usuario para usar esa sesión de Firebase
 * sin preguntarle nada más: con la cara se pide un ID token nuevo a Firebase y
 * se canjea en `/auth/firebase`, el mismo canje que hace el login normal.
 *
 * ## Lo que NO es
 *
 * Face ID acá es una compuerta de interfaz, no un cifrado. El refresh token de
 * Firebase vive en IndexedDB sin protección biométrica: alguien con acceso al
 * contenedor de la app (un backup sin cifrar, un teléfono con jailbreak) lo
 * puede usar sin pasar por la cara. La alternativa fuerte sería guardar la
 * credencial en el Keychain con `SecAccessControl` biométrico, para que el
 * propio sistema se niegue a entregarla sin Face ID. No se hizo a propósito:
 * exige sacar la sesión de Firebase de IndexedDB y manejar su refresh a mano,
 * y el riesgo que cubre —el contenedor ya comprometido— expone también el JWT
 * de `session.ts`, que tampoco está en el Keychain. Ver MOBILE_APP.md §11.
 *
 * ## Dónde corre
 *
 * Solo en iOS y solo con el plugin presente en el binario. Android carga la web
 * de Cloud Run en un WebView: un deploy le cambia el JS a los teléfonos ya
 * instalados sin pasar por Play, y el APK no trae el plugin. Es la misma
 * lección que dejó el botón de Google (ver `pluginNativoPresente`): tener el JS
 * no es tener el código nativo, así que se pregunta por los dos.
 *
 * Los plugins se importan con `import()` dentro de cada función por el mismo
 * motivo que en `session.ts`: el objeto del plugin es un Proxy y no puede pasar
 * por un `await` ni salir de una función async, porque la maquinaria de
 * promesas le lee `.then` y la llamada viaja al puente nativo como un método
 * que no existe —y la promesa no resuelve nunca—.
 */
import type { SessionUser } from "@/lib/auth-types";
import { plataformaActual, type Plataforma } from "@/lib/native/google-sign-in";

/**
 * Lo que eligió el usuario en este teléfono. Sin valor guardado = todavía no se
 * le preguntó, que es la única situación en la que se le ofrece.
 */
export type Eleccion = "activada" | "rechazada";

/** El nombre que ve el usuario. Los iPhone con botón de inicio tienen Touch ID. */
export type TipoBiometria = "Face ID" | "Touch ID";

const CLAVE_ELECCION = "ontimeai.biometria.eleccion";

/**
 * Marca de "ya se intentó entrar con la cara en este arranque".
 *
 * Va en `sessionStorage` y no solo en memoria porque las navegaciones de
 * salida del gate son duras (`window.location.replace`): un intento fallido
 * manda a /login, /login vuelve a montar el gate con el JS recién cargado, y
 * una marca en memoria ya no estaría. Con ella, el gate pediría la cara otra
 * vez, el usuario cancelaría otra vez, y así sin fin. `sessionStorage`
 * sobrevive a esas recargas dentro del mismo WebView y muere cuando iOS mata
 * el proceso, que es exactamente "un intento por apertura de la app".
 */
const CLAVE_INTENTO = "ontimeai.biometria.intentada";
let intentadaEnMemoria = false;

/** El nombre con que el plugin se registra; lo que mira `isPluginAvailable`. */
const PLUGIN = "NativeBiometric";

// --- Preferencia guardada -------------------------------------------------

export async function leerEleccion(): Promise<Eleccion | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: CLAVE_ELECCION });
    return value === "activada" || value === "rechazada" ? value : null;
  } catch {
    return null;
  }
}

export async function guardarEleccion(eleccion: Eleccion): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: CLAVE_ELECCION, value: eleccion });
  } catch {
    // Sin puente no hay biometría que activar: no hay nada que perder.
  }
}

export async function olvidarEleccion(): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key: CLAVE_ELECCION });
  } catch {
    // Idem.
  }
}

// --- Capacidad del teléfono ----------------------------------------------

/**
 * Qué biometría hay para usar, o `null` si no hay ninguna utilizable acá.
 *
 * Tres condiciones, en este orden: que sea iOS (en Android y en la web la
 * función no existe), que el binario traiga el plugin (un bundle nuevo puede
 * llegar por OTA a un binario viejo) y que el teléfono tenga Face ID o Touch
 * ID configurado.
 */
export async function biometriaDisponible(
  plataforma?: Plataforma,
): Promise<TipoBiometria | null> {
  if ((plataforma ?? (await plataformaActual())) !== "ios") return null;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isPluginAvailable(PLUGIN)) return null;
    const { NativeBiometric, BiometryType } = await import(
      "@capgo/capacitor-native-biometric"
    );
    const resultado = await NativeBiometric.isAvailable();
    if (!resultado.isAvailable) return null;
    return resultado.biometryType === BiometryType.TOUCH_ID ? "Touch ID" : "Face ID";
  } catch {
    return null;
  }
}

/**
 * Pide la cara (o el dedo). `true` solo si el sistema la reconoció.
 *
 * Cancelar, fallar, tocar "Usar contraseña" o quedarse bloqueado dan `false` y
 * no un error: para quien llama todos significan lo mismo, ir al login normal.
 * `useFallback: false` es deliberado: el código del teléfono no es la
 * contraseña de la cuenta, y la alternativa a la cara es nuestro login, no el
 * desbloqueo del iPhone.
 */
export async function verificarIdentidad(tipo: TipoBiometria): Promise<boolean> {
  try {
    const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
    await NativeBiometric.verifyIdentity({
      reason: `Entrar a OnTimeAI con ${tipo}`,
      title: "OnTimeAI",
      useFallback: false,
      fallbackTitle: "Usar contraseña",
    });
    return true;
  } catch {
    return false;
  }
}

// --- Sesión de Firebase ---------------------------------------------------

/**
 * La sesión de Firebase persistida, si hay.
 *
 * `currentUser` vale `null` hasta que Firebase termina de leer IndexedDB;
 * preguntarlo antes de `authStateReady()` diría que no hay nadie aunque haya.
 */
async function usuarioDeFirebase() {
  try {
    const { firebaseAuth } = await import("@/lib/firebase");
    const auth = firebaseAuth();
    await auth.authStateReady();
    return auth.currentUser;
  } catch {
    return null;
  }
}

// --- Marca de un intento por arranque ------------------------------------

function yaIntentada(): boolean {
  if (intentadaEnMemoria) return true;
  try {
    return sessionStorage.getItem(CLAVE_INTENTO) === "1";
  } catch {
    return false;
  }
}

function marcarIntentada(): void {
  intentadaEnMemoria = true;
  try {
    sessionStorage.setItem(CLAVE_INTENTO, "1");
  } catch {
    // Queda la marca en memoria, que alcanza mientras no haya recarga.
  }
}

// --- Entrada -------------------------------------------------------------

/**
 * Intenta entrar sin contraseña. Lo llama el gate del bundle cuando no hay JWT
 * válido; `null` significa "seguí como siempre", o sea, al login.
 *
 * Por qué solo sin JWT válido y no en cada arranque: con el JWT vigente la app
 * ya entra sola, y pedir la cara ahí convertiría esto en un bloqueo de pantalla
 * —otra función, con otra pregunta: qué hacer con una sesión válida si el
 * usuario cancela—. Acá Face ID reemplaza a la contraseña, no se suma a ella.
 *
 * Las comprobaciones van de la más barata a la más cara, y la preferencia
 * primero: quien no lo activó no paga cargar Firebase ni el plugin en el
 * arranque.
 */
export async function entrarConBiometria(): Promise<SessionUser | null> {
  if (yaIntentada()) return null;
  if ((await leerEleccion()) !== "activada") return null;

  const tipo = await biometriaDisponible();
  if (!tipo) return null;

  const usuario = await usuarioDeFirebase();
  if (!usuario) return null;

  // La marca va ANTES de pedir la cara: si el usuario cancela, o la app se
  // recarga en el medio, no se le vuelve a preguntar en este arranque.
  marcarIntentada();
  if (!(await verificarIdentidad(tipo))) return null;

  try {
    // `true` fuerza un token recién emitido: el cacheado puede tener hasta una
    // hora y el backend rechaza uno vencido.
    const idToken = await usuario.getIdToken(true);
    const { apiLoginFirebase } = await import("@/lib/api");
    const { username, role, userType } = await apiLoginFirebase(idToken);
    return { username, role, userType };
  } catch {
    // Firebase no renovó (cuenta borrada o deshabilitada, refresh revocado) o
    // el backend no canjeó: la cara no alcanza, hace falta la contraseña.
    return null;
  }
}

// --- Oferta y ajuste -------------------------------------------------------

/**
 * Si corresponde ofrecer la activación, y con qué nombre.
 *
 * Una sola vez: cuando no hay elección guardada. Se pide además una sesión de
 * Firebase porque sin ella activarlo no serviría de nada —la cara habilita esa
 * sesión, no la reemplaza—.
 */
export async function biometriaParaOfrecer(): Promise<TipoBiometria | null> {
  const tipo = await biometriaDisponible();
  if (!tipo) return null;
  if ((await leerEleccion()) !== null) return null;
  return (await usuarioDeFirebase()) ? tipo : null;
}

/**
 * Activa la entrada con la cara, pidiéndola una vez.
 *
 * Verificar antes de guardar confirma dos cosas: que la biometría anda en este
 * teléfono y que quien la activa es el dueño de la cara registrada —no alguien
 * que encontró la app abierta—. Si no pasa, no se guarda nada.
 */
export async function activarBiometria(tipo: TipoBiometria): Promise<boolean> {
  if (!(await verificarIdentidad(tipo))) return false;
  await guardarEleccion("activada");
  return true;
}

export async function desactivarBiometria(): Promise<void> {
  await guardarEleccion("rechazada");
}

/**
 * Estado para el interruptor de Ajustes, o `null` si no hay que mostrarlo
 * (web, Android, binario sin plugin, teléfono sin biometría configurada).
 */
export async function estadoDelAjuste(): Promise<{
  tipo: TipoBiometria;
  activada: boolean;
} | null> {
  const tipo = await biometriaDisponible();
  if (!tipo) return null;
  return { tipo, activada: (await leerEleccion()) === "activada" };
}

// --- Salida ----------------------------------------------------------------

/**
 * Lo que el logout del bundle tiene que borrar además del JWT.
 *
 * La sesión de Firebase se cierra acá y antes no hacía falta: era un resto
 * inofensivo, porque nada la convertía en un JWT sin la contraseña. Con Face ID
 * pasa a ser una credencial, y un logout que la deja viva no cierra nada.
 *
 * La elección se olvida para que la próxima persona que entre en este teléfono
 * decida por sí misma, y la marca de intento se baja para que esa decisión
 * valga desde ya.
 */
export async function limpiarAlCerrarSesion(): Promise<void> {
  await olvidarEleccion();
  intentadaEnMemoria = false;
  try {
    sessionStorage.removeItem(CLAVE_INTENTO);
  } catch {
    // Sin sessionStorage no había marca persistida que bajar.
  }
  try {
    const [{ firebaseAuth }, { signOut }] = await Promise.all([
      import("@/lib/firebase"),
      import("firebase/auth"),
    ]);
    await signOut(firebaseAuth());
  } catch {
    // Que Firebase no conteste no frena el logout: el JWT ya se borró.
  }
}
