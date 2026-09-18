/**
 * Política de privacidad. Pública: App Store y Play exigen una URL que abra
 * sin sesión, y Apple la verifica antes de aceptar el envío.
 *
 * Lo que dice está verificado contra el código, no redactado en abstracto:
 * la tabla `users` del backend guarda correo (que es el usuario), rol, tipo de
 * perfil y preferencias visuales; las credenciales las administra Firebase
 * Authentication; no hay SDK de analítica ni de publicidad en el árbol. Si
 * alguna de esas cosas cambia, esta página tiene que cambiar con ella.
 */

import type { Metadata } from "next";

import { LegalShell } from "@/components/legal-shell";
import { ISSUES_URL, PRIVACIDAD_ACTUALIZADA } from "@/lib/contacto";

export const metadata: Metadata = {
  title: "Política de privacidad — OnTimeAI",
  description:
    "Qué datos recoge OnTimeAI, para qué los usa, dónde los guarda y cómo pedir que se borren.",
};

export default function PrivacidadPage() {
  return (
    <LegalShell title="Política de privacidad" updated={PRIVACIDAD_ACTUALIZADA}>
      <section>
        <h2>Quiénes somos</h2>
        <p>
          OnTimeAI es un trabajo final de carrera desarrollado por Santiago
          Carranza, Lorenzo Galaverna, Facundo Oliva Marchetto y Mateo
          Pappalardo. Predice retrasos de vuelos del aeropuerto de Atlanta
          (ATL) con un modelo de aprendizaje automático entrenado sobre datos
          públicos. No es un producto comercial: no se vende nada, no hay
          publicidad y no se comercializan datos.
        </p>
      </section>

      <section>
        <h2>Qué datos recogemos</h2>
        <p>Solo lo necesario para que tengas una cuenta y la app te reconozca:</p>
        <ul>
          <li>
            <strong>Correo electrónico y contraseña</strong>, para crear la
            cuenta e iniciar sesión. La contraseña nunca llega a nuestros
            servidores en texto plano: la administra Firebase Authentication
            (Google), que la almacena cifrada. Si entrás con Google, recibimos
            únicamente tu correo.
          </li>
          <li>
            <strong>Rol y tipo de perfil</strong> (aerolínea o pasajero), que
            elegís al empezar y que define qué pantallas ves.
          </li>
          <li>
            <strong>Preferencias visuales</strong>: modo de color y paleta.
          </li>
        </ul>
        <p>
          No pedimos ni guardamos nombre, teléfono, ubicación, contactos, fotos
          ni ningún otro dato personal. Los datos de vuelos y de clima que ves
          en la app son información operativa pública, no datos sobre vos.
        </p>
      </section>

      <section>
        <h2>Para qué los usamos</h2>
        <ul>
          <li>Para autenticarte y mantener tu sesión abierta.</li>
          <li>Para mostrarte la app según tu rol y tu perfil.</li>
          <li>Para recordar cómo preferís verla.</li>
        </ul>
        <p>
          No hacemos perfiles de comportamiento, no usamos herramientas de
          analítica ni de rastreo publicitario, y no cruzamos tus datos con
          otras fuentes.
        </p>
      </section>

      <section>
        <h2>Dónde se guardan</h2>
        <p>
          Los datos de tu cuenta viven en servidores de Google Cloud (región{" "}
          <code>us-central1</code>, Estados Unidos), donde corre el backend de
          OnTimeAI. Las credenciales viven en Firebase Authentication, también
          de Google, bajo su{" "}
          <a
            href="https://firebase.google.com/support/privacy"
            target="_blank"
            rel="noreferrer"
          >
            política de privacidad
          </a>
          .
        </p>
        <p>
          En la app para iPhone, el token que identifica tu sesión se guarda en
          el almacenamiento privado de la app en tu dispositivo, no compartido
          con otras aplicaciones. Cerrar sesión lo elimina.
        </p>
      </section>

      <section>
        <h2>Con quién se comparten</h2>
        <p>
          Con nadie con fines propios. Los únicos terceros que intervienen lo
          hacen para que la app funcione:
        </p>
        <ul>
          <li>
            <strong>Firebase Authentication (Google)</strong>: administra el
            alta, la verificación del correo y la recuperación de contraseña.
          </li>
          <li>
            <strong>Esri</strong>: sirve las imágenes de fondo de los mapas.
            Al cargar un mapa, tu dispositivo le pide esas imágenes
            directamente, y Esri recibe tu dirección IP como en cualquier
            visita a un sitio web. No le enviamos ningún dato de tu cuenta.
          </li>
        </ul>
        <p>
          El clima y los datos de vuelos los consulta nuestro propio servidor;
          tu dispositivo no habla con esas fuentes.
        </p>
      </section>

      <section>
        <h2>Cuánto tiempo los conservamos</h2>
        <p>
          Mientras tu cuenta exista. Si pedís que la borremos, eliminamos tu
          registro de nuestra base y tu usuario de Firebase Authentication
          dentro de los 30 días.
        </p>
      </section>

      <section>
        <h2>Tus derechos</h2>
        <p>
          Podés pedir en cualquier momento acceder a los datos que tenemos
          sobre vos, corregirlos o que los borremos por completo, incluida la
          cuenta. Para hacerlo, abrí una consulta en{" "}
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            el repositorio del proyecto
          </a>{" "}
          indicando el correo con el que te registraste. Verificamos que el
          pedido venga de la persona titular antes de actuar.
        </p>
      </section>

      <section>
        <h2>Menores</h2>
        <p>
          La app no está dirigida a menores de 13 años y no recogemos a
          sabiendas datos de menores. Si creés que un menor creó una cuenta,
          avisanos y la eliminamos.
        </p>
      </section>

      <section>
        <h2>Cambios en esta política</h2>
        <p>
          Si cambiamos qué datos recogemos o cómo los usamos, actualizamos esta
          página y la fecha que figura arriba. Los cambios rigen desde su
          publicación.
        </p>
      </section>
    </LegalShell>
  );
}
