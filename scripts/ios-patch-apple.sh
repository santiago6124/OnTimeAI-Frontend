#!/usr/bin/env bash
#
# Deja el proyecto iOS en condiciones de atender Sign in with Apple.
#
# Son tres piezas, todas nativas, y ninguna viaja en el zip del OTA:
#
#   1. El entitlement `com.apple.developer.applesignin = [Default]`, en
#      `App/App.entitlements`. Sin él, `ASAuthorizationController` falla con
#      `AuthorizationError 1000` en cuanto se toca el botón, sin abrir la hoja.
#
#   2. `CODE_SIGN_ENTITLEMENTS` en el target App (Debug y Release). El archivo
#      solo no alcanza: `cap add ios` no genera ninguno, y si el target no lo
#      nombra, codesign firma sin entitlements y el perfil de provisión —aunque
#      tenga la capability— no aporta nada. Con firma manual (CI), además,
#      Xcode compara este archivo con el perfil "OnTimeAI App Store" y corta el
#      archive si el perfil no trae Sign in with Apple: por eso el perfil se
#      regenera después de habilitar la capability en el App ID.
#
#   3. La marca `OnTimeAI-SIWA/1` en el user agent del WebView
#      (`ios.appendUserAgent` del capacitor.config.json del binario). Es lo
#      que mira el gate de `src/lib/native/apple-sign-in.ts` para saber que
#      ESTE binario tiene el entitlement: el plugin ya estaba en 1.1.0 (7), que
#      no lo tiene, y un bundle nuevo le llega por OTA. La marca y el
#      entitlement los pone el mismo script, así que no pueden separarse.
#      Un `npx cap sync` posterior reescribe el JSON y borra la marca: el botón
#      desaparece (falla cerrada), no queda roto.
#
# Como `ios/` no se versiona (se regenera con `npx cap add ios`), se aplica en
# cada build, igual que ios-patch-google.sh. Idempotente.
#
# Uso:  bash scripts/ios-patch-apple.sh [ruta/a/ios/App]
set -euo pipefail

PROYECTO="${1:-ios/App}"
PBXPROJ="$PROYECTO/App.xcodeproj/project.pbxproj"
CONFIG_JSON="$PROYECTO/App/capacitor.config.json"
MARCA="OnTimeAI-SIWA/1"
ENTITLEMENTS_DEFECTO="App/App.entitlements"

for f in "$PBXPROJ" "$CONFIG_JSON"; do
  [ -f "$f" ] || { echo "ERROR: no existe $f — ¿corriste 'npx cap add ios' y 'cap sync' antes?" >&2; exit 1; }
done

PB=/usr/libexec/PlistBuddy
[ -x "$PB" ] || { echo "ERROR: no está $PB (¿no es macOS?)" >&2; exit 1; }

# --- 1 y 2. CODE_SIGN_ENTITLEMENTS en los bloques del target App ---
# Se reconoce el target App porque es el único con PRODUCT_BUNDLE_IDENTIFIER;
# el bloque del proyecto no lo tiene. Si ya nombra un archivo de entitlements
# (alguien agregó una capability a mano), se respeta ese archivo y se le suma
# la clave, en vez de pisarlo con uno nuevo.
ENTITLEMENTS_REL=$(PBXPROJ="$PBXPROJ" DEFECTO="$ENTITLEMENTS_DEFECTO" python3 - <<'PY'
import os, re, sys

ruta = os.environ["PBXPROJ"]
defecto = os.environ["DEFECTO"]
src = open(ruta, encoding="utf-8").read()

bloque = re.compile(
    r"(\t\t[0-9A-F]{24} /\* (?:Debug|Release) \*/ = \{\n\t\t\tisa = XCBuildConfiguration;\n.*?\n\t\t\};)",
    re.S,
)
existentes = set()
hechos = 0

def poner(m):
    global hechos
    b = m.group(1)
    if "PRODUCT_BUNDLE_IDENTIFIER" not in b:
        return b
    hechos += 1
    ya = re.search(r"CODE_SIGN_ENTITLEMENTS = \"?([^\";]+)\"?;", b)
    if ya:
        existentes.add(ya.group(1))
        return b
    return b.replace(
        "buildSettings = {\n",
        f"buildSettings = {{\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = {defecto};\n",
        1,
    )

out = bloque.sub(poner, src)
if hechos != 2:
    sys.exit(f"esperaba 2 bloques (Debug y Release) del target App, encontré {hechos}")
if len(existentes) > 1:
    sys.exit(f"Debug y Release nombran entitlements distintos: {sorted(existentes)}")
open(ruta, "w", encoding="utf-8").write(out)
print(existentes.pop() if existentes else defecto)
PY
)

ENTITLEMENTS="$PROYECTO/$ENTITLEMENTS_REL"
if [ ! -f "$ENTITLEMENTS" ]; then
  cat > "$ENTITLEMENTS" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
PLIST
fi

# `Delete` + `Add` deja siempre exactamente [Default], aunque hubiera otro valor.
"$PB" -c "Delete :com.apple.developer.applesignin" "$ENTITLEMENTS" >/dev/null 2>&1 || true
"$PB" -c "Add :com.apple.developer.applesignin array" "$ENTITLEMENTS"
"$PB" -c "Add :com.apple.developer.applesignin:0 string Default" "$ENTITLEMENTS"

# --- 3. La marca en el user agent ---
CONFIG_JSON="$CONFIG_JSON" MARCA="$MARCA" python3 - <<'PY'
import json, os

ruta = os.environ["CONFIG_JSON"]
marca = os.environ["MARCA"]
with open(ruta, encoding="utf-8") as fh:
    cfg = json.load(fh)
ios = cfg.setdefault("ios", {})
actual = (ios.get("appendUserAgent") or "").strip()
if marca not in actual.split():
    ios["appendUserAgent"] = f"{actual} {marca}".strip()
with open(ruta, "w", encoding="utf-8") as fh:
    json.dump(cfg, fh, indent=2, ensure_ascii=False)
    fh.write("\n")
PY

# --- Verificación ---
# Que haya quedado de verdad, no que el script haya terminado.
[ "$("$PB" -c "Print :com.apple.developer.applesignin:0" "$ENTITLEMENTS")" = "Default" ] || {
  echo "ERROR: el entitlement no quedó en $ENTITLEMENTS" >&2
  exit 1
}
n=$(grep -c "CODE_SIGN_ENTITLEMENTS = \"\{0,1\}$ENTITLEMENTS_REL\"\{0,1\};" "$PBXPROJ" || true)
[ "$n" = "2" ] || {
  echo "ERROR: esperaba CODE_SIGN_ENTITLEMENTS en Debug y Release del target App, hay $n" >&2
  exit 1
}
node -e '
  const c = require(process.argv[1]);
  if (!(c.ios?.appendUserAgent ?? "").split(/\s+/).includes(process.argv[2])) process.exit(1);
' "$(cd "$(dirname "$CONFIG_JSON")" && pwd)/$(basename "$CONFIG_JSON")" "$MARCA" || {
  echo "ERROR: la marca $MARCA no quedó en $CONFIG_JSON" >&2
  exit 1
}
echo "OK — Sign in with Apple: entitlement en $ENTITLEMENTS_REL, CODE_SIGN_ENTITLEMENTS en Debug y Release, marca $MARCA"
