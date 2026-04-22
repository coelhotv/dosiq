#!/bin/bash
# build-ios.sh — Valida certificado no keychain e roda eas build local para iOS
# Uso: bash build-ios.sh [development|preview|production]

set -euo pipefail

PROFILE="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Bundle ID por perfil (deve refletir app.config.js)
if [ "$PROFILE" = "production" ]; then
  BUNDLE_ID="com.coelhotv.dosiq"
  PLIST_FILE="$SCRIPT_DIR/GoogleService-Info-production.plist"
else
  BUNDLE_ID="com.coelhotv.dosiq.development"
  PLIST_FILE="$SCRIPT_DIR/GoogleService-Info-development.plist"
fi

echo "🔍 Verificando Distribution Certificate no keychain..."

CERT=$(security find-identity -v -p codesigning | grep "iPhone Distribution" | grep "$BUNDLE_ID\|Antonio Coelho" | head -1)

if [ -z "$CERT" ]; then
  echo ""
  echo "❌ Distribution Certificate não encontrado no keychain."
  echo ""
  echo "   Para instalar:"
  echo "   1. eas credentials --platform ios"
  echo "   2. Build Credentials → Distribution Certificate → Download"
  echo "   3. Clique duplo no .p12 baixado para instalar no Keychain Access"
  echo "   4. Rode este script novamente"
  exit 1
fi

echo "   ✅ Certificado encontrado: $CERT"

echo "🔐 Desbloqueando keychain..."
security unlock-keychain ~/Library/Keychains/login.keychain-db

if [ ! -f "$PLIST_FILE" ]; then
  echo "❌ GoogleService-Info não encontrado: $PLIST_FILE"
  echo "   Baixe do Firebase Console e salve nesse path."
  exit 1
fi

echo "🔐 Exportando credencial Firebase: $PLIST_FILE"
export GOOGLE_SERVICES_PLIST_PATH="$PLIST_FILE"
export EAS_BUILD_PROFILE="$PROFILE"

echo "🚀 Iniciando build iOS ($PROFILE)..."
eas build --local --platform ios --profile "$PROFILE"
