#!/usr/bin/env bash
#
# Firma manual, SOLO en el target App y SOLO en Release.
#
# Pasar CODE_SIGN_STYLE / PROVISIONING_PROFILE_SPECIFIER en la línea de
# comandos de xcodebuild los aplica a todos los targets del workspace, y los
# frameworks de CocoaPods (Capacitor, Alamofire, …) rechazan un perfil de
# provisión: "Version does not support provisioning profiles". Así falló la
# primera corrida firmada de ios-release.yml.
#
# Los ajustes van entonces en el pbxproj, en el bloque de configuración del
# target App. `cap add ios` lo genera con CODE_SIGN_STYLE = Automatic e
# identidad "iPhone Developer"; en un runner solo hay certificado de
# distribución, así que Release pasa a Manual + Apple Distribution + el perfil
# de App Store. Debug no se toca: un build local a un teléfono necesita firma
# automática con certificado de desarrollo.
#
# Es para CI. Localmente no hace falta: Xcode firma solo con la cuenta.
#
# Uso:  bash scripts/ios-manual-signing.sh <TEAM_ID> "<nombre del perfil>"
set -euo pipefail

cd "$(dirname "$0")/.."

TEAM_ID="${1:?falta el Team ID}"
PROFILE_NAME="${2:?falta el nombre del perfil}"
PBXPROJ=ios/App/App.xcodeproj/project.pbxproj

if [ ! -f "$PBXPROJ" ]; then
  echo "No existe $PBXPROJ: corré 'npx cap add ios' primero." >&2
  exit 1
fi

# El pbxproj es texto con bloques `{ ... }` por configuración. Se busca el
# bloque XCBuildConfiguration que sea a la vez del target App (tiene
# PRODUCT_BUNDLE_IDENTIFIER) y Release, y ahí se reemplaza la línea de
# CODE_SIGN_STYLE por el juego completo de firma manual.
TEAM_ID="$TEAM_ID" PROFILE_NAME="$PROFILE_NAME" PBXPROJ="$PBXPROJ" python3 - <<'PY'
import os, re, sys

path = os.environ["PBXPROJ"]
team = os.environ["TEAM_ID"]
profile = os.environ["PROFILE_NAME"]
src = open(path, encoding="utf-8").read()

bloque = re.compile(
    r"(\t\t[0-9A-F]{24} /\* Release \*/ = \{\n\t\t\tisa = XCBuildConfiguration;\n.*?\n\t\t\};)",
    re.S,
)
hechos = 0
def firmar(m):
    global hechos
    b = m.group(1)
    if "PRODUCT_BUNDLE_IDENTIFIER" not in b or "name = Release;" not in b:
        return b
    if "CODE_SIGN_STYLE = Automatic;" not in b:
        sys.exit(f"el bloque Release del target App no tiene CODE_SIGN_STYLE = Automatic:\n{b}")
    nuevo = (
        "CODE_SIGN_STYLE = Manual;\n"
        '\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";\n'
        f"\t\t\t\tDEVELOPMENT_TEAM = {team};\n"
        f'\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "{profile}";'
    )
    hechos += 1
    return b.replace("CODE_SIGN_STYLE = Automatic;", nuevo, 1)

out = bloque.sub(firmar, src)
if hechos != 1:
    sys.exit(f"esperaba exactamente 1 bloque Release del target App, encontré {hechos}")
open(path, "w", encoding="utf-8").write(out)
PY

# Verificación: una sola vez cada ajuste, y Debug sigue automático.
for clave in 'CODE_SIGN_STYLE = Manual;' 'CODE_SIGN_IDENTITY = "Apple Distribution";' "DEVELOPMENT_TEAM = $TEAM_ID;" "PROVISIONING_PROFILE_SPECIFIER = \"$PROFILE_NAME\";"; do
  n=$(grep -cF "$clave" "$PBXPROJ" || true)
  if [ "$n" != "1" ]; then
    echo "esperaba 1 línea '$clave' en $PBXPROJ, hay $n" >&2
    exit 1
  fi
done
if [ "$(grep -cF 'CODE_SIGN_STYLE = Automatic;' "$PBXPROJ")" != "1" ]; then
  echo "Debug tendría que seguir con firma automática" >&2
  exit 1
fi

echo "OK — target App/Release: firma manual con Apple Distribution y el perfil \"$PROFILE_NAME\" (equipo $TEAM_ID)."
