#!/bin/bash
# build-ios.sh — Prepara certificados e roda eas build local
# Uso: bash build-ios.sh [development|production]

set -euo pipefail

PROFILE="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Bundle ID único (reflete o app.config.js)
BUNDLE_ID="com.coelhotv.dosiq"

if [ "$PROFILE" = "production" ]; then
  PLIST_FILE="$SCRIPT_DIR/GoogleService-Info-production.plist"
else
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

# 1. Extrair versão do app.config.js
APP_VERSION=$(node -p "require('$SCRIPT_DIR/app.config.js').expo.version")
echo "📦 Versão detectada: v$APP_VERSION"

# 2. Preparar diretório de saída
TARGET_DIR="$HOME/local/dev-builds"
mkdir -p "$TARGET_DIR"

# 3. Definir nome e extensão do arquivo
if [ "$PROFILE" = "production" ]; then
  EXT="ipa"
else
  EXT="app"
fi

TEMP_OUTPUT="$SCRIPT_DIR/build-temp.$EXT"
FINAL_NAME="dosiq-v$APP_VERSION-$PROFILE.$EXT"
FINAL_PATH="$TARGET_DIR/$FINAL_NAME"

echo ""
echo "📱 --- RESUMO DO PROCESSO ---"
echo "👤 Perfil:  $PROFILE"
echo "📦 Versão:  v$APP_VERSION"
echo "📂 Destino: $FINAL_PATH"
echo "🚀 Submit:  $( [ "$PROFILE" = "production" ] && echo "SIM (TestFlight ✈️)" || echo "NÃO (Apenas Local 💾)" )"
echo "-----------------------------"
read -p "Confirma as informações acima? (Enter para rodar / Ctrl+C para cancelar) "

echo "🧹 Limpando cache e regenerando diretório nativo..."
npx expo prebuild --platform ios --clean

echo "🚀 Iniciando build iOS ($PROFILE) para v$APP_VERSION..."
# Usamos || true para ignorar erros de limpeza interna do EAS (comum no iCloud) 
# O sucesso será validado pela existência do arquivo na linha seguinte.
eas build --local --platform ios --profile "$PROFILE" --output "$TEMP_OUTPUT" --clear-cache || {
  echo "⚠️ Aviso: O comando EAS reportou um problema (provavelmente limpeza de cache no iCloud), verificando integridade do binário..."
}

if [ ! -f "$TEMP_OUTPUT" ]; then
  echo "❌ Erro: Build concluído mas arquivo não encontrado em $TEMP_OUTPUT"
  exit 1
fi

# 4. Mover e renomear
echo "💾 Movendo build para: $FINAL_PATH"
mv "$TEMP_OUTPUT" "$FINAL_PATH"

# 5. Submissão automática para TestFlight (apenas produção)
if [ "$PROFILE" = "production" ]; then
  echo "⬆️ Iniciando submissão para TestFlight..."
  if eas submit --platform ios --profile production --path "$FINAL_PATH" ; then
    echo "✅ Submissão concluída com sucesso!"
  else
    echo "⚠️ Falha na submissão ao TestFlight, mas o build local foi preservado em $FINAL_PATH"
    exit 1
  fi
fi

echo "✨ Processo finalizado com sucesso!"
echo "📂 Arquivo disponível em: $FINAL_PATH"
