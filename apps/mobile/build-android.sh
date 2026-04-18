#!/bin/bash
# build-android.sh — Prepara credenciais e roda eas build local
# Uso: bash build-android.sh [preview|development|production]

PROFILE="${1:-preview}"
ICLOUD_MOBILE="/Users/coelhotv/git-icloud/meus-remedios/apps/mobile"

# production usa google-services.json (sem sufixo), demais usam google-services-{profile}.json
if [ "$PROFILE" = "production" ]; then
  CREDS_FILE="$ICLOUD_MOBILE/google-services.json"
else
  CREDS_FILE="$ICLOUD_MOBILE/google-services-${PROFILE}.json"
fi

if [ ! -f "$CREDS_FILE" ]; then
  echo "❌ Credencial não encontrada: $CREDS_FILE"
  echo "   Baixe o google-services.json do Firebase Console e salve nesse path."
  exit 1
fi

echo "🔐 Exportando credencial Firebase: $CREDS_FILE"
export GOOGLE_SERVICES_JSON_PATH="$CREDS_FILE"

echo "🚀 Iniciando build ($PROFILE)..."
eas build --local --platform android --profile "$PROFILE"
