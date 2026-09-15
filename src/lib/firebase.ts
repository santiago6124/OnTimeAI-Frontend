/**
 * Cliente de Firebase Authentication.
 *
 * Firebase se ocupa de las credenciales por correo —alta, verificación del
 * correo, recuperación de contraseña— que es lo que este proyecto no puede
 * hacer solo: no hay servicio de envío de mails. El backend valida el ID token
 * que Firebase emite y entrega un JWT propio; la tabla `users` sigue siendo
 * dueña del rol y del tipo de cuenta.
 *
 * ## Por qué la config está acá y no en variables de entorno
 *
 * Estos valores son públicos: viajan en el bundle del navegador, y la `apiKey`
 * de Firebase identifica al proyecto, no autoriza nada por sí sola. La
 * seguridad la dan los dominios autorizados y las reglas del proyecto.
 *
 * Ponerlos en variables implicaría pasar seis valores por la misma cadena
 * —substitución de Cloud Build, build-arg de Docker, `ARG`/`ENV`— que el
 * 15/09 se tragó el client id de Google en silencio y dejó el botón invisible
 * seis horas. Con un solo entorno, el costo de esa cadena supera al beneficio.
 *
 * Si algún día hay un entorno de staging, acá va la lectura de `process.env`.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAb3Hj4N3Sm_jaVTncToOYmcvLPABR4vQE",
  authDomain: "ontimeai-prod.firebaseapp.com",
  projectId: "ontimeai-prod",
  storageBucket: "ontimeai-prod.firebasestorage.app",
  messagingSenderId: "871707213932",
  appId: "1:871707213932:web:9e5462219ee41e6b4b5849",
};

/**
 * Next renderiza los módulos más de una vez entre recargas en desarrollo, y
 * `initializeApp` dos veces sobre el mismo nombre lanza. Se reutiliza la que
 * ya exista.
 */
function app(): FirebaseApp {
  const existentes = getApps();
  return existentes.length > 0 ? existentes[0] : initializeApp(firebaseConfig);
}

export function firebaseAuth(): Auth {
  const auth = getAuth(app());
  // Los correos de verificación y de recuperación salen en el idioma del
  // navegador; sin esto llegan en inglés aunque la app esté en español.
  auth.useDeviceLanguage();
  return auth;
}

/**
 * Traduce los códigos de error de Firebase a algo que se pueda leer.
 *
 * Los mensajes que trae —"Firebase: Error (auth/invalid-credential)"— no le
 * dicen nada a quien está en el formulario, y algunos son directamente
 * engañosos: `invalid-credential` sale tanto si la contraseña está mal como si
 * la cuenta no existe, porque Firebase no distingue a propósito para no
 * revelar qué correos están registrados.
 */
export function mensajeDeError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con ese correo. Probá ingresar.";
    case "auth/invalid-email":
      return "El correo no parece válido.";
    case "auth/weak-password":
      return "La contraseña es demasiado corta.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "El correo o la contraseña no coinciden.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
    case "auth/network-request-failed":
      return "No se pudo conectar. Revisá tu conexión.";
    case "auth/unauthorized-domain":
      // Pasa si falta agregar el dominio en Authentication → Settings →
      // Authorized domains de la consola de Firebase.
      return "Este dominio no está autorizado para iniciar sesión.";
    default:
      return "No se pudo completar la operación. Probá de nuevo.";
  }
}
