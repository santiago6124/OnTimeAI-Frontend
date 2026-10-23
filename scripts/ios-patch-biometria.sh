#!/usr/bin/env bash
#
# Agrega al Info.plist el texto que iOS muestra al pedir Face ID.
#
# `NSFaceIDUsageDescription` no es opcional: sin la clave, la primera llamada a
# Face ID no muestra ningún permiso, el sistema cierra la app en el acto y App
# Review rechaza el binario si lo detecta. Touch ID no la necesita, pero un
# mismo binario corre en los dos tipos de iPhone.
#
# Como ios-patch-google.sh, esto es nativo y **no llega por OTA**: el zip del
# OTA lleva solo el bundle web. Y como `ios/` no se versiona (se regenera con
# `npx cap add ios`), se aplica en cada build.
#
# Idempotente: si la clave ya está con otro texto, se pisa con este; correrlo
# dos veces deja el mismo resultado.
#
# Uso:  bash scripts/ios-patch-biometria.sh [ruta/a/ios/App/App]
set -euo pipefail

APP_DIR="${1:-ios/App/App}"
PLIST="$APP_DIR/Info.plist"
TEXTO="OnTimeAI usa Face ID para que vuelvas a entrar sin escribir tu contraseña."

[ -f "$PLIST" ] || { echo "ERROR: no existe $PLIST — ¿corriste 'npx cap add ios' antes?" >&2; exit 1; }

# PlistBuddy y no sed, por lo mismo que en ios-patch-google.sh: es XML.
PB=/usr/libexec/PlistBuddy
[ -x "$PB" ] || { echo "ERROR: no está $PB (¿no es macOS?)" >&2; exit 1; }

# `Add` falla si la clave existe y `Set` si no existe.
if "$PB" -c "Print :NSFaceIDUsageDescription" "$PLIST" >/dev/null 2>&1; then
  "$PB" -c "Set :NSFaceIDUsageDescription $TEXTO" "$PLIST"
else
  "$PB" -c "Add :NSFaceIDUsageDescription string $TEXTO" "$PLIST"
fi

# Verificación: que haya quedado de verdad, no que el script haya terminado.
if [ "$("$PB" -c "Print :NSFaceIDUsageDescription" "$PLIST")" != "$TEXTO" ]; then
  echo "ERROR: NSFaceIDUsageDescription no quedó en $PLIST" >&2
  exit 1
fi
echo "OK — Info.plist: NSFaceIDUsageDescription"
