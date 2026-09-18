/**
 * Página de soporte. App Store Connect exige una "URL de soporte" que exista y
 * diga cómo pedir ayuda; Play pide un canal de contacto. Esta cumple las dos.
 */

import type { Metadata } from "next";

import { LegalShell } from "@/components/legal-shell";
import { ISSUES_URL, REPO_URL } from "@/lib/contacto";

export const metadata: Metadata = {
  title: "Soporte — OnTimeAI",
  description: "Cómo pedir ayuda, reportar un problema o consultar sobre tu cuenta de OnTimeAI.",
};

export default function SoportePage() {
  return (
    <LegalShell title="Soporte">
      <section>
        <h2>Qué es OnTimeAI</h2>
        <p>
          Una app que predice la probabilidad de retraso de los vuelos que
          salen del aeropuerto de Atlanta (ATL), usando un modelo de
          aprendizaje automático entrenado con datos públicos de operaciones y
          de clima. Es un trabajo final de carrera; el código es abierto y está
          en{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Cómo pedir ayuda</h2>
        <p>
          El canal de soporte son las consultas del repositorio:{" "}
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            {ISSUES_URL}
          </a>
          . Sirve para cualquier cosa: un error, una pantalla que no carga, una
          pregunta sobre cómo se calcula una predicción o un pedido sobre tu
          cuenta.
        </p>
        <p>Para que podamos ayudarte rápido, contanos:</p>
        <ul>
          <li>Qué estabas haciendo y qué esperabas que pasara.</li>
          <li>Qué pasó en cambio (una captura ayuda mucho).</li>
          <li>Si usás la app en iPhone, en Android o en el navegador.</li>
        </ul>
        <p>
          No incluyas tu contraseña en ninguna consulta: nunca te la vamos a
          pedir.
        </p>
      </section>

      <section>
        <h2>Tu cuenta</h2>
        <ul>
          <li>
            <strong>Olvidaste la contraseña</strong>: en la pantalla de
            ingreso, tocá &ldquo;La olvidé&rdquo; y te llega un correo para
            restablecerla.
          </li>
          <li>
            <strong>No te llegó el correo de verificación</strong>: revisá la
            carpeta de no deseados; desde la pantalla de ingreso podés pedir que
            se reenvíe.
          </li>
          <li>
            <strong>Querés borrar tu cuenta</strong>: pedilo por el canal de
            soporte indicando el correo con el que te registraste. La
            eliminamos, con todos tus datos, dentro de los 30 días. El detalle
            está en la <a href="/privacidad">política de privacidad</a>.
          </li>
        </ul>
      </section>

      <section>
        <h2>Sobre las predicciones</h2>
        <p>
          Las predicciones son estimaciones estadísticas y pueden equivocarse.
          No reemplazan la información oficial de tu aerolínea ni del
          aeropuerto: para decidir sobre un vuelo, consultá siempre esas
          fuentes.
        </p>
      </section>
    </LegalShell>
  );
}
