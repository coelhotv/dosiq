#!/bin/bash
# build-android.sh — Prepara credenciais e roda eas build local
# Uso: bash build-android.sh [preview|development|production]

PROFILE="${1:-preview}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR"

# production usa google-services.json; dev e preview compartilham google-services-development.json
if [ "$PROFILE" = "production" ]; then
  CREDS_FILE="$APP_DIR/google-services.json"
else
  CREDS_FILE="$APP_DIR/google-services-development.json"
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
