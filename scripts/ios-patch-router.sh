#!/usr/bin/env bash
#
# Reemplaza el router de assets de Capacitor iOS por uno que entienda la salida
# de un export estático de Next.
#
# El problema, que se manifiesta como pantalla en blanco después del splash:
#
#   CapacitorRouter.route(for:) manda CUALQUIER ruta sin extensión al
#   index.html de la RAÍZ (node_modules/@capacitor/ios/.../Router.swift):
#
#       if pathUrl.pathExtension.isEmpty { return basePath + "/index.html" }
#
#   Next con `trailingSlash: true` exporta un index.html por directorio:
#   /login/index.html, /flights/detail/index.html, etc. Cuando la app arranca
#   sin sesión, NativeSessionGate hace location.replace('/login/') —una
#   navegación de documento completa—, el router devuelve el index de la RAÍZ, y
#   el cliente de Next bootea creyendo que la ruta es "/" mientras la URL dice
#   "/login/". La app queda mostrando la pantalla equivocada o directamente en
#   blanco.
#
# La solución: resolver /login/ → /login/index.html cuando ese archivo existe.
# Es exactamente para esto que Capacitor expone `Router` como protocolo y
# `CAPBridgeViewController.router()` como `open`.
#
# El proyecto iOS no se versiona (se regenera con `npx cap add ios`), así que
# esto se aplica en cada build. Es código NATIVO: no se puede arreglar por OTA.
#
# Uso:  bash scripts/ios-patch-router.sh [ruta/a/ios/App/App]
set -euo pipefail

APP_DIR="${1:-ios/App/App}"
DELEGATE="$APP_DIR/AppDelegate.swift"
STORYBOARD="$APP_DIR/Base.lproj/Main.storyboard"
MARCA="// [ios-patch-router]"

for f in "$DELEGATE" "$STORYBOARD"; do
  [ -f "$f" ] || { echo "ERROR: no existe $f — ¿corriste 'npx cap add ios' antes?" >&2; exit 1; }
done

# --- 1. El router y el view controller ---
# Van al final de AppDelegate.swift a propósito: ese archivo ya está en el
# target de Xcode. Agregar un .swift nuevo obligaría a editar project.pbxproj,
# que es frágil de automatizar.
# -F: la marca lleva corchetes y grep los tomaría como clase de caracteres.
if grep -qF "$MARCA" "$DELEGATE"; then
  echo "AppDelegate.swift ya parcheado, se saltea"
else
  cat >> "$DELEGATE" <<'SWIFT'

// [ios-patch-router] — lo inyecta scripts/ios-patch-router.sh, no editar a mano.

/// Router para la salida de `next build` con `output: 'export'`.
///
/// El router por defecto de Capacitor manda toda ruta sin extensión al
/// index.html de la raíz. Next exporta un index.html por directorio, así que
/// /login/ tiene que resolver a /login/index.html y no al de la raíz.
struct StaticExportRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        let requested = path.isEmpty ? "/" : path

        // Un archivo real (.js, .css, .png, el payload RSC): tal cual.
        if !URL(fileURLWithPath: requested).pathExtension.isEmpty {
            return basePath + requested
        }

        // Directorio con su index.html, que es lo que produce trailingSlash.
        // Se descarta el query string: /flights/detail/?id=X tiene que resolver
        // al mismo archivo que /flights/detail/, y el id lo lee el JS de
        // window.location.
        let sinQuery = requested.split(separator: "?", maxSplits: 1).first.map(String.init) ?? requested
        let directory = sinQuery.hasSuffix("/") ? String(sinQuery.dropLast()) : sinQuery
        let candidate = basePath + directory + "/index.html"
        if FileManager.default.fileExists(atPath: candidate) {
            return candidate
        }

        // Ruta que no existe en el bundle: se cae al index de la raíz, igual
        // que el router por defecto.
        return basePath + "/index.html"
    }
}

class OnTimeAIBridgeViewController: CAPBridgeViewController {
    override open func router() -> Router {
        return StaticExportRouter()
    }
}
SWIFT
  echo "AppDelegate.swift parcheado"
fi

# --- 2. El storyboard tiene que instanciar NUESTRO view controller ---
# `cap add ios` genera el storyboard con customClass="CAPBridgeViewController".
# Sin este cambio el router nuevo queda compilado pero nunca se usa, que es el
# modo de falla más caro: compila, instala, y falla recién en el teléfono.
if grep -q 'customClass="OnTimeAIBridgeViewController"' "$STORYBOARD"; then
  echo "Main.storyboard ya parcheado, se saltea"
else
  grep -q 'customClass="CAPBridgeViewController"' "$STORYBOARD" || {
    echo "ERROR: Main.storyboard no declara CAPBridgeViewController." >&2
    echo "       Capacitor cambió el storyboard generado; revisá este script." >&2
    exit 1
  }
  # customModule: la clase vive en el módulo de la app, no en el de Capacitor.
  sed -i '' \
    -e 's|customClass="CAPBridgeViewController" customModule="Capacitor"|customClass="OnTimeAIBridgeViewController" customModule="App"|' \
    -e 's|customClass="CAPBridgeViewController"|customClass="OnTimeAIBridgeViewController" customModule="App"|' \
    "$STORYBOARD"
  echo "Main.storyboard apuntado a OnTimeAIBridgeViewController"
fi

# --- 3. Verificación ---
# Que el parche se haya aplicado de verdad, no que el script haya terminado.
grep -qF "$MARCA" "$DELEGATE" || { echo "ERROR: el router no quedó en AppDelegate.swift" >&2; exit 1; }
grep -q 'customClass="OnTimeAIBridgeViewController"' "$STORYBOARD" || {
  echo "ERROR: el storyboard no quedó apuntando al view controller nuevo" >&2
  exit 1
}
echo "OK — router de export estático aplicado"
