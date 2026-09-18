#!/usr/bin/env bash
#
# Ajustes del proyecto nativo que App Store Connect exige y que `cap add ios`
# no trae, porque `ios/` no se versiona y se regenera en cada build limpio.
#
# Dos cosas, y las dos son decisiones de tienda, no de código:
#
#   1. `ITSAppUsesNonExemptEncryption = false` en el Info.plist. La app solo
#      usa HTTPS estándar, que está exento de la declaración de exportación.
#      Sin la clave, App Store Connect frena cada build subido con la pregunta
#      de cumplimiento hasta que alguien la conteste a mano en la web.
#
#   2. `TARGETED_DEVICE_FAMILY = 1` (solo iPhone). Capacitor declara "1,2"
#      (iPhone + iPad), y con iPad en el listado Apple exige capturas de 13" y
#      el revisor la prueba en iPad. La app sigue instalándose en iPad, en modo
#      compatibilidad; lo que cambia es que no hay que defender un layout más.
#
# Idempotente: correrlo dos veces deja el mismo resultado.
#
# Uso:  bash scripts/ios-store-settings.sh
set -euo pipefail

cd "$(dirname "$0")/.."

PLIST=ios/App/App/Info.plist
PBXPROJ=ios/App/App.xcodeproj/project.pbxproj

if [ ! -f "$PLIST" ] || [ ! -f "$PBXPROJ" ]; then
  echo "No existe ios/App: corré 'npx cap add ios' primero." >&2
  exit 1
fi

# PlistBuddy falla si la clave ya existe con `Add`, y si no existe con `Set`.
if /usr/libexec/PlistBuddy -c "Print :ITSAppUsesNonExemptEncryption" "$PLIST" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST"
else
  /usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST"
fi

# El valor viene entre comillas porque tiene una coma; el nuevo no las necesita.
sed -i '' 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' "$PBXPROJ"

# Verificación: las dos cosas tienen que haber quedado, porque un pbxproj con
# otro formato haría que el sed no encuentre nada y no falle.
if [ "$(/usr/libexec/PlistBuddy -c "Print :ITSAppUsesNonExemptEncryption" "$PLIST")" != "false" ]; then
  echo "ITSAppUsesNonExemptEncryption no quedó en false en $PLIST" >&2
  exit 1
fi
if grep -q 'TARGETED_DEVICE_FAMILY = "1,2"' "$PBXPROJ"; then
  echo "TARGETED_DEVICE_FAMILY sigue en \"1,2\" en $PBXPROJ" >&2
  exit 1
fi
if ! grep -q 'TARGETED_DEVICE_FAMILY = 1;' "$PBXPROJ"; then
  echo "No se encontró TARGETED_DEVICE_FAMILY en $PBXPROJ; ¿cambió el formato del proyecto?" >&2
  exit 1
fi

echo "OK — Info.plist: cifrado exento; proyecto: solo iPhone."
