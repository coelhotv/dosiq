#!/bin/bash
# build-android.sh — Prepara credenciais e roda eas build local para Android
# Uso: bash build-android.sh [development|preview|production]
#
# Perfis (spec 051-A · canais de OTA declarados em eas.json):
#   development → .apk  · canal `development` · uso diário de desenvolvimento
#   preview     → .apk  · canal `preview`     · alvo do smoke de OTA, INCLUSIVE o teste
#                                               destrutivo do PO-5 (update que crasha de
#                                               propósito). NUNCA rodar esse teste em production.
#   production  → .aab  · canal `production`  · o que vai pra Play Store
#
# ⚠️ Mesmo bundle ID (com.coelhotv.dosiq) nos três: o APK local é assinado por esta máquina e o
#    app da Play Store pelo Google — assinaturas diferentes, o Android RECUSA instalar por cima.
#    Para instalar um build preview/development: desinstale o Dosiq da loja antes.

set -euo pipefail

# Garantir que o Android SDK é encontrado pelo Gradle
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if [ ! -d "$ANDROID_HOME" ]; then
  echo "❌ Android SDK não encontrado em $ANDROID_HOME"
  echo "   Instale o Android SDK via Android Studio ou defina ANDROID_HOME."
  exit 1
fi

PROFILE="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# R-307: procedencia do binario de loja (tag no git + arvore limpa)
. "$SCRIPT_DIR/lib-release-tag.sh"

# Falhar cedo e explícito: perfil desconhecido só apareceria lá na frente como erro do EAS,
# depois do prebuild e do --clear-cache (minutos perdidos).
case "$PROFILE" in
  development|preview|production) ;;
  *)
    echo "❌ Perfil inválido: '$PROFILE'"
    echo "   Use: development | preview | production"
    exit 1
    ;;
esac

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

# R-307: build de loja precisa de procedência. Checar ANTES de compilar — falhar depois de 20 min
# de gradle é desperdício, e falhar depois do submit é tarde demais.
if [ "$PROFILE" = "production" ]; then
  assert_taggable_build "$APP_VERSION" || exit 1
fi

echo ""
echo "📱 --- RESUMO DO PROCESSO ANDROID ---"
echo "👤 Perfil:  $PROFILE"
echo "📡 Canal OTA: $PROFILE  (updates publicados em outro canal NÃO chegam neste build)"
echo "📦 Versão:  v$APP_VERSION"
echo "📂 Destino: $FINAL_PATH"
echo "🚀 Formato: $EXT"
echo "------------------------------------"
read -p "Confirma as informações acima? (Enter para rodar / Ctrl+C para cancelar) "

echo "🔐 Exportando credencial Firebase: $CREDS_FILE"
export GOOGLE_SERVICES_JSON_PATH="$CREDS_FILE"
export EAS_BUILD_PROFILE="$PROFILE"

# SENTRY_AUTH_TOKEN: os .env não chegam ao build (o .easignore corta dotfiles; o env do prebuild
# morre antes do gradle). Detalhe e evidência em lib-sentry-token.sh.
# shellcheck source=lib-sentry-token.sh
. "$SCRIPT_DIR/lib-sentry-token.sh"
load_sentry_auth_token "$SCRIPT_DIR" || true
require_sentry_auth_token_for_production "$PROFILE"

# echo "🧹 Limpando cache e realizando Hard Reset do diretório nativo..."
# Deletar pastas nativas para resolver conflitos de sincronização (iCloud)
rm -rf "$SCRIPT_DIR/android"

echo "🧹 Limpando cache e regenerando diretório nativo..."
npx expo prebuild --platform android --clean

echo "🚀 Iniciando build Android ($PROFILE) para v$APP_VERSION..."
# Build local via EAS - ignoramos o código de saída direto para checar o arquivo depois
# pois erros de cleanup (ENOTEMPTY) podem retornar 1 mesmo com build bem sucedida.
eas build --local --platform android --profile "$PROFILE" --output "$TEMP_OUTPUT" --clear-cache || true

if [ -f "$TEMP_OUTPUT" ]; then
  echo "✅ EAS build finalizado (arquivo gerado em $TEMP_OUTPUT)."
else
  echo "❌ Erro crítico: O arquivo de saída não foi encontrado em $TEMP_OUTPUT."
  echo "Verifique os logs do EAS acima para entender o porquê da falha na compilação."
  exit 1
fi

# 4. Mover e renomear
echo "💾 Movendo build para: $FINAL_PATH"
mv "$TEMP_OUTPUT" "$FINAL_PATH"

# R-307: marcar o commit que virou este binário. Só agora, com o artefato em mãos — tag de build
# que falhou é mentira sobre o que existe.
if [ "$PROFILE" = "production" ]; then
  create_release_tag "$APP_VERSION"
fi

echo "✨ Processo finalizado com sucesso!"
echo "📂 Arquivo disponível em: $FINAL_PATH"
