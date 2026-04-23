#!/bin/bash
# build-android.sh — Prepara credenciais e roda eas build local para Android
# Uso: bash build-android.sh [development|production]

set -euo pipefail

PROFILE="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. Extrair versão do app.config.js
APP_VERSION=$(node -p "require('$SCRIPT_DIR/app.config.js').expo.version")
echo "📦 Versão detectada: v$APP_VERSION"

# 2. Configurar credenciais (Arquivo único)
CREDS_FILE="$SCRIPT_DIR/google-services.json"

if [ ! -f "$CREDS_FILE" ]; then
  echo "❌ Credencial não encontrada: $CREDS_FILE"
  echo "   Baixe o google-services.json do Firebase Console e salve nesse path."
  exit 1
fi

# 3. Preparar diretório de saída
TARGET_DIR="$HOME/local/dev-builds"
mkdir -p "$TARGET_DIR"

# No Android, production gera .aab e o restante gera .apk (conforme eas.json)
if [ "$PROFILE" = "production" ]; then
  EXT="aab"
else
  EXT="apk"
fi

TEMP_OUTPUT="$SCRIPT_DIR/build-temp.$EXT"
FINAL_NAME="dosiq-v$APP_VERSION-$PROFILE.$EXT"
FINAL_PATH="$TARGET_DIR/$FINAL_NAME"

echo ""
echo "📱 --- RESUMO DO PROCESSO ANDROID ---"
echo "👤 Perfil:  $PROFILE"
echo "📦 Versão:  v$APP_VERSION"
echo "📂 Destino: $FINAL_PATH"
echo "🚀 Formato: $EXT"
echo "------------------------------------"
read -p "Confirma as informações acima? (Enter para rodar / Ctrl+C para cancelar) "

echo "🔐 Exportando credencial Firebase: $CREDS_FILE"
export GOOGLE_SERVICES_JSON_PATH="$CREDS_FILE"
export EAS_BUILD_PROFILE="$PROFILE"

echo "🧹 Limpando cache e regenerando diretório nativo..."
npx expo prebuild --platform android --clean

echo "🚀 Iniciando build Android ($PROFILE) para v$APP_VERSION..."
# Usamos || true para ignorar erros de limpeza interna do EAS (comum no iCloud) 
eas build --local --platform android --profile "$PROFILE" --output "$TEMP_OUTPUT" --clear-cache || {
  echo "⚠️ Aviso: O comando EAS reportou um problema (provavelmente limpeza de cache no iCloud), verificando integridade do binário..."
}

if [ ! -f "$TEMP_OUTPUT" ]; then
  echo "❌ Erro: Build concluído mas arquivo não encontrado em $TEMP_OUTPUT"
  exit 1
fi

# 4. Mover e renomear
echo "💾 Movendo build para: $FINAL_PATH"
mv "$TEMP_OUTPUT" "$FINAL_PATH"

echo "✨ Processo finalizado com sucesso!"
echo "📂 Arquivo disponível em: $FINAL_PATH"
