#!/bin/bash
# build-android.sh — Prepara credenciais e roda eas build local
# Uso: bash build-android.sh [preview|development|production]

PROFILE="${1:-preview}"
ICLOUD_MOBILE="/Users/coelhotv/git-icloud/meus-remedios/apps/mobile"

echo "🔐 Exportando path de credencial Firebase para profile: $PROFILE"
export GOOGLE_SERVICES_JSON_PATH="$ICLOUD_MOBILE/google-services-${PROFILE}.json"

echo "🚀 Iniciando build..."
eas build --local --platform android --profile "$PROFILE"
