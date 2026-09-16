import { NextResponse } from "next/server";

/**
 * Servidor de actualizaciones OTA del bundle de iOS.
 *
 * Reemplaza al cloud de Capgo: el plugin `@capgo/capacitor-updater` (MPL-2.0)
 * acepta cualquier `updateUrl`, y lo único que necesita es este contrato,
 * leído de su código nativo (`CapgoUpdater.swift`, `getLatest`):
 *
 *  - Pide con POST y un JSON con `app_id`, `platform`, `device_id`,
 *    `version_build` (la versión nativa instalada), `version_name` (el bundle
 *    que está corriendo) y `defaultChannel` si el binario lo fija.
 *  - "No hay novedades" es `{ kind: "up_to_date" }`. Los `kind` que entiende
 *    son `up_to_date`, `blocked` y `failed`; cualquier otro lo lee como
 *    `failed`. Un `error` no vacío también se trata como falla.
 *  - Para ofrecer un bundle: `{ version, url, checksum }`. El checksum es el
 *    SHA-256 del zip tal cual se descarga; es opcional, pero si viene y no
 *    coincide el plugin descarta la descarga.
 *
 * Qué bundle corresponde lo dice un manifest JSON en un bucket público de GCS,
 * escrito por `scripts/ota-publish.mjs`: `channels` apunta cada canal a una
 * versión, y `bundles` tiene la URL y el checksum de cada versión subida. Se
 * lee en cada consulta y sin caché, para que apuntar un canal a otra versión
 * (un rollback) rija de inmediato. Son pocos dispositivos y un archivo chico.
 *
 * La URL va hardcodeada con override por env a propósito: `deploy.yml` hace
 * `gcloud run deploy --set-env-vars`, que borra toda variable que no pase, así
 * que una variable puesta a mano en Cloud Run no sobrevive al siguiente deploy.
 *
 * Sin autenticación: el bundle es el mismo JS que viaja dentro del .ipa, y el
 * manifest ya es público. No hay nada acá que no tenga quien tenga la app.
 */

export const OTA_APP_ID = "com.ontimeai.app";

const MANIFEST_URL =
  process.env.OTA_MANIFEST_URL ||
  "https://storage.googleapis.com/ontimeai-ota/ios/manifest.json";

type Bundle = {
  url: string;
  checksum?: string;
  /** Primera versión nativa que puede correr este bundle (plugins nuevos). */
  min_native?: string | null;
};

type Manifest = {
  schema: number;
  app_id: string;
  channels: Record<string, string | null>;
  bundles: Record<string, Bundle>;
};

type UpdateRequest = {
  app_id?: unknown;
  platform?: unknown;
  device_id?: unknown;
  version_build?: unknown;
  version_name?: unknown;
  defaultChannel?: unknown;
};

type Semver = [number, number, number];

function semver(value: unknown): Semver | null {
  if (typeof value !== "string") return null;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compare(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function upToDate(message: string) {
  return NextResponse.json({ kind: "up_to_date", message });
}

function blocked(error: string, message: string, status = 200) {
  return NextResponse.json({ kind: "blocked", error, message }, { status });
}

function failed(error: string, message: string) {
  return NextResponse.json({ kind: "failed", error, message }, { status: 503 });
}

function isManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<Manifest>;
  return (
    typeof m.app_id === "string" &&
    !!m.channels &&
    typeof m.channels === "object" &&
    !!m.bundles &&
    typeof m.bundles === "object"
  );
}

async function loadManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const parsed: unknown = await res.json();
    return isManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: UpdateRequest;
  try {
    body = ((await request.json()) ?? {}) as UpdateRequest;
  } catch {
    return blocked("bad_request", "Solicitud inválida", 400);
  }

  if (body.app_id !== OTA_APP_ID) {
    return blocked("app_mismatch", `Este servidor solo actualiza ${OTA_APP_ID}`);
  }
  if (body.platform !== "ios") {
    // Android es un WebView remoto: su actualización es el deploy de la web.
    return blocked("platform_unsupported", "Solo iOS recibe OTA");
  }

  const native = semver(body.version_build);
  if (!native) {
    // Con MOBILE_OTA=1 el config exige MOBILE_APP_VERSION en semver, así que
    // esto es un binario mal compilado, no un caso a tolerar en silencio.
    return blocked("native_version_invalid", "version_build no es semver");
  }
  const running = typeof body.version_name === "string" ? body.version_name : "";

  const manifest = await loadManifest();
  if (!manifest) {
    return failed("manifest_unavailable", "No se pudo leer el manifest de bundles");
  }
  if (manifest.app_id !== OTA_APP_ID) {
    return failed("manifest_invalid", "El manifest es de otra app");
  }

  const requested =
    typeof body.defaultChannel === "string" && body.defaultChannel.trim()
      ? body.defaultChannel.trim()
      : "production";
  if (!(requested in manifest.channels)) {
    // Un binario apuntado a un canal que no existe es un error de build:
    // mejor que se vea en el log del dispositivo a que actualice de otro lado.
    return blocked("unknown_channel", `El canal "${requested}" no existe`);
  }

  const target = manifest.channels[requested];
  const bundle = target ? manifest.bundles[target] : undefined;

  const log = (offered: string | null, reason: string) => {
    console.log(
      JSON.stringify({
        ota: "check",
        device: typeof body.device_id === "string" ? body.device_id : null,
        channel: requested,
        native: body.version_build,
        running,
        offered,
        reason,
      }),
    );
  };

  if (!target) {
    log(null, "channel_empty");
    return upToDate(`El canal "${requested}" no tiene bundle`);
  }
  if (!bundle || typeof bundle.url !== "string" || !bundle.url) {
    log(null, "manifest_inconsistent");
    return failed("manifest_inconsistent", `El canal apunta a ${target}, que no está en bundles`);
  }
  if (target === running) {
    log(null, "already_running");
    return upToDate("Ya está corriendo esa versión");
  }

  const targetVersion = semver(target);
  if (targetVersion && compare(targetVersion, native) < 0) {
    // El binario ya trae algo más nuevo que el canal: no se baja por debajo
    // del nativo. Pasa después de una release nativa, hasta el siguiente OTA.
    log(null, "under_native");
    return upToDate(`El bundle ${target} es anterior al nativo ${body.version_build}`);
  }
  const minNative = semver(bundle.min_native);
  if (minNative && compare(native, minNative) < 0) {
    // El bundle usa algo nativo (un plugin, un permiso) que este binario no
    // tiene. Es lo que en Capgo hacía --fail-on-incompatible, a mano.
    log(null, "native_too_old");
    return upToDate(`El bundle ${target} requiere nativo ≥ ${bundle.min_native}`);
  }

  log(target, "offered");
  return NextResponse.json({
    version: target,
    url: bundle.url,
    checksum: typeof bundle.checksum === "string" ? bundle.checksum : "",
  });
}
