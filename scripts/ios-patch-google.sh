#!/usr/bin/env bash
#
# Deja el proyecto iOS en condiciones de atender el login con Google nativo.
#
# Son las dos piezas que el plugin necesita y que NO viajan en el bundle web:
#
#   1. El esquema de URL en Info.plist. Google abre su pantalla de login fuera
#      de la app y vuelve por un `openURL` contra un esquema que es el client ID
#      de iOS con los segmentos invertidos. Sin registrarlo, el usuario toca el
#      botón, elige la cuenta, y la app nunca se entera: el flujo vuelve sin
#      token y sin error.
#
#   2. El handler en AppDelegate.swift. `cap add ios` genera un
#      `application(_:open:options:)` que manda todo a ApplicationDelegateProxy.
#      GoogleSignIn tiene que ver la URL primero.
#
# Por eso el login con Google es lo único de esta pantalla que **no se puede
# arreglar por OTA**: el OTA entrega un zip del bundle web y esto es código
# nativo. Cambiar algo de acá exige recompilar y subir un build nuevo.
#
# El proyecto iOS no se versiona (se regenera con `npx cap add ios`), así que
# esto se aplica en cada build, igual que ios-patch-router.sh.
#
# Uso:  GOOGLE_IOS_CLIENT_ID=123-abc.apps.googleusercontent.com \
#         bash scripts/ios-patch-google.sh [ruta/a/ios/App/App]
set -euo pipefail

APP_DIR="${1:-ios/App/App}"
PLIST="$APP_DIR/Info.plist"
DELEGATE="$APP_DIR/AppDelegate.swift"
MARCA="// [ios-patch-google]"

CLIENT_ID="${GOOGLE_IOS_CLIENT_ID:-}"

# Sin client ID no se parchea NADA y se sale bien.
#
# Es deliberado que no sea un error: mientras las apps de iOS y Android no
# existan en la consola de Firebase no hay client ID que registrar, y un build
# tiene que seguir saliendo. El botón nativo tampoco se dibuja en ese caso
# (googleDisponibleEn en src/lib/native/google-sign-in.ts), así que la app queda
# con correo y contraseña y nada promete lo que no puede cumplir.
if [ -z "$CLIENT_ID" ]; then
  echo "GOOGLE_IOS_CLIENT_ID vacío: se saltea el parche de Google."
  echo "  El botón nativo tampoco se dibuja, así que el build es coherente."
  exit 0
fi

for f in "$PLIST" "$DELEGATE"; do
  [ -f "$f" ] || { echo "ERROR: no existe $f — ¿corriste 'npx cap add ios' antes?" >&2; exit 1; }
done

# El client ID tiene que ser el de iOS, no el web. Se parecen y confundirlos
# falla recién en el teléfono: Google rechaza el flujo porque el esquema de URL
# registrado no corresponde al cliente que pide el token.
case "$CLIENT_ID" in
  *.apps.googleusercontent.com) ;;
  *)
    echo "ERROR: GOOGLE_IOS_CLIENT_ID no parece un client ID de Google." >&2
    echo "       Tiene que terminar en .apps.googleusercontent.com" >&2
    exit 1
    ;;
esac

# Todo lo que se puede validar, se valida ANTES de escribir: un fallo a mitad
# de camino deja el proyecto con el esquema puesto y sin el handler, que es un
# build que compila y no funciona.
if ! grep -qF "$MARCA" "$DELEGATE"; then
  grep -q 'func application(_ app: UIApplication, open url: URL' "$DELEGATE" || {
    echo "ERROR: AppDelegate.swift no declara application(_:open:options:)." >&2
    echo "       Capacitor cambió la plantilla generada; revisá este script." >&2
    exit 1
  }
fi

# El esquema es el client ID con los segmentos al revés:
#   123-abc.apps.googleusercontent.com  →  com.googleusercontent.apps.123-abc
SUFIJO=".apps.googleusercontent.com"
ID_SOLO="${CLIENT_ID%$SUFIJO}"
ESQUEMA="com.googleusercontent.apps.$ID_SOLO"

# --- 1. Info.plist: el esquema de URL ---
# Se usa PlistBuddy y no sed: Info.plist es XML y editarlo con expresiones
# regulares es como sale mal. PlistBuddy viene con macOS.
PB=/usr/libexec/PlistBuddy
[ -x "$PB" ] || { echo "ERROR: no está $PB (¿no es macOS?)" >&2; exit 1; }

if "$PB" -c "Print :CFBundleURLTypes" "$PLIST" >/dev/null 2>&1; then
  # Ya hay un array: solo hay que ver si nuestro esquema está.
  if "$PB" -c "Print :CFBundleURLTypes" "$PLIST" 2>/dev/null | grep -qF "$ESQUEMA"; then
    echo "Info.plist ya tiene el esquema de Google, se saltea"
  else
    "$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $ESQUEMA" "$PLIST"
    echo "Info.plist: esquema agregado al CFBundleURLTypes que ya existía"
  fi
else
  "$PB" -c "Add :CFBundleURLTypes array" "$PLIST"
  "$PB" -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
  "$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
  "$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $ESQUEMA" "$PLIST"
  echo "Info.plist: CFBundleURLTypes creado con el esquema de Google"
fi

# --- 2. AppDelegate.swift: que GoogleSignIn vea la URL primero ---
if grep -qF "$MARCA" "$DELEGATE"; then
  echo "AppDelegate.swift ya parcheado para Google, se saltea"
else
  # Se inserta la línea como PRIMERA sentencia del método, justo después de la
  # llave de apertura. GoogleSignIn devuelve true solo si la URL es suya, así
  # que todo lo demás sigue cayendo en ApplicationDelegateProxy como antes.
  python3 - "$DELEGATE" <<'PY'
import re, sys

ruta = sys.argv[1]
with open(ruta, encoding="utf-8") as fh:
    texto = fh.read()

if "import GoogleSignIn" not in texto:
    # Después del último import, para no quedar arriba de la cabecera.
    imports = list(re.finditer(r"^import .+$", texto, re.M))
    fin = imports[-1].end()
    texto = texto[:fin] + "\nimport GoogleSignIn" + texto[fin:]

patron = re.compile(
    r"(func application\(_ app: UIApplication, open url: URL[^\{]*\{)"
)
m = patron.search(texto)
if not m:
    sys.exit("no se encontró la firma de application(_:open:options:)")

inyeccion = (
    "\n        // [ios-patch-google] — lo inyecta scripts/ios-patch-google.sh.\n"
    "        // GoogleSignIn tiene que ver la URL antes que el proxy de\n"
    "        // Capacitor: es la vuelta del login, y el proxy no la reconoce.\n"
    "        if GIDSignIn.sharedInstance.handle(url) {\n"
    "            return true\n"
    "        }\n"
)
texto = texto[:m.end()] + inyeccion + texto[m.end():]

with open(ruta, "w", encoding="utf-8") as fh:
    fh.write(texto)
PY
  echo "AppDelegate.swift parcheado para Google"
fi

# --- 3. Verificación ---
# Que el parche esté aplicado de verdad, no que el script haya terminado.
"$PB" -c "Print :CFBundleURLTypes" "$PLIST" 2>/dev/null | grep -qF "$ESQUEMA" || {
  echo "ERROR: el esquema no quedó en Info.plist" >&2
  exit 1
}
grep -qF "$MARCA" "$DELEGATE" || {
  echo "ERROR: el handler no quedó en AppDelegate.swift" >&2
  exit 1
}
grep -q "import GoogleSignIn" "$DELEGATE" || {
  echo "ERROR: falta 'import GoogleSignIn' en AppDelegate.swift" >&2
  exit 1
}
echo "OK — login con Google nativo aplicado ($ESQUEMA)"
