#!/usr/bin/env bash
#
# Prepara el proyecto iOS: bundle, config empaquetada, sync y parche del router.
#
# La CLI de Capacitor lee siempre `capacitor.config.ts` de la raíz y no acepta
# un `--config`, así que la config de iOS hay que ponerla ahí durante el sync.
# Ese es el único motivo de este script: hacerlo sin dejar el repo pisado.
#
# La restauración va en un `trap`, no al final: si el sync falla —o alguien
# corta con Ctrl-C— el archivo tiene que volver igual. Sin eso, un build fallido
# deja `capacitor.config.ts` con la config de iOS, y el próximo build de Android
# sale sin `server.url`: un APK que abre un WebView vacío.
#
# Uso:  bash scripts/ios-prepare.sh [--open]
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP="$(mktemp)"
cp capacitor.config.ts "$BACKUP"
restaurar() {
  cp "$BACKUP" capacitor.config.ts
  rm -f "$BACKUP"
}
trap restaurar EXIT

echo "==> 1/4 bundle web empaquetado"
node scripts/build-mobile.mjs

echo "==> 2/4 config de iOS (sin server.url)"
cp capacitor.config.ios.ts capacitor.config.ts

echo "==> 3/4 cap sync ios"
npx cap sync ios

echo "==> 4/4 router de export estático"
bash scripts/ios-patch-router.sh

echo
echo "Listo. El proyecto quedó en ios/ y capacitor.config.ts sin tocar."
if [ "${1:-}" = "--open" ]; then
  npx cap open ios
fi
