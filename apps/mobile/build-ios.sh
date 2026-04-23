#!/bin/bash
# build-ios.sh — Prepara certificados e roda eas build local
# Uso: bash build-ios.sh [development|production]

set -euo pipefail

PROFILE="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Bundle ID e Credenciais unificados
BUNDLE_ID="com.coelhotv.dosiq"
PLIST_FILE="$SCRIPT_DIR/GoogleService-Info.plist"

if [ "$PROFILE" = "production" ]; then
  echo "🔍 Verificando Distribution Certificate no keychain..."
  CERT=$(security find-identity -v -p codesigning | grep "iPhone Distribution" | grep "$BUNDLE_ID\|Antonio Coelho" | head -1)

  if [ -z "$CERT" ]; then
    echo ""
    echo "❌ Distribution Certificate não encontrado no keychain (Necessário para Production)."
    echo ""
    echo "   Para instalar:"
    echo "   1. eas credentials --platform ios"
    echo "   2. Build Credentials → Distribution Certificate → Download"
    echo "   3. Clique duplo no .p12 baixado para instalar no Keychain Access"
    echo "   4. Rode este script novamente"
    exit 1
  fi
  echo "   ✅ Certificado encontrado: $CERT"
else
  echo "ℹ️  Simulador detectado (perfil $PROFILE): Pulando verificação de certificado de distribuição."
fi

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

echo "🧹 Limpando cache e realizando Hard Reset do diretório nativo..."
# Deletar pastas nativas para resolver conflitos de sincronização (iCloud)
rm -rf "$SCRIPT_DIR/ios"
rm -rf "$SCRIPT_DIR/android"

# Prebuild sem instalar pacotes nativos automaticamente (evita erro de path com espaços no iCloud)
if npx expo prebuild --platform ios --no-install ; then
  echo "✅ Código nativo regenerado com sucesso."
else
  echo "❌ Erro ao regenerar código nativo. Verifique logs."
  exit 1
fi

# Instalação manual de Pods (mais resiliente a caminhos com espaços)
echo "📦 Instalando dependências nativas (CocoaPods)..."
cd "$SCRIPT_DIR/ios"
if pod install ; then
  cd "$SCRIPT_DIR"
  echo "✅ CocoaPods concluído."
else
  echo "⚠️ Erro no pod install automático, tentando forçar com repo update..."
  pod install --repo-update || {
    echo "❌ Falha crítica no CocoaPods. Verifique o caminho iCloud para conflitos."
    exit 1
  }
  cd "$SCRIPT_DIR"
fi

rm -f "$TEMP_OUTPUT"

echo "🚀 Iniciando build iOS ($PROFILE) para v$APP_VERSION..."
# Build local via EAS
if eas build --local --platform ios --profile "$PROFILE" --output "$TEMP_OUTPUT" --clear-cache ; then
  echo "✅ EAS build concluído com sucesso."
else
  echo "❌ Erro crítico no EAS build. Verifique os logs acima."
  exit 1
fi

if [ ! -e "$TEMP_OUTPUT" ]; then
  echo "❌ Erro: Arquivos de saída não encontrados em $TEMP_OUTPUT"
  exit 1
fi

# 4. Mover e renomear
echo "💾 Movendo build para: $FINAL_PATH"
mv "$TEMP_OUTPUT" "$FINAL_PATH"

# 4.1 Extração automática para Simulador (Wave v0.1.5)
if [ "$PROFILE" != "production" ] && [ -f "$FINAL_PATH" ]; then
  # Verifica se é um arquivo comprimido (tar.gz)
  if file "$FINAL_PATH" | grep -q "gzip compressed data"; then
    echo "📦 Detectado pacote comprimido. Iniciando extração para simulador..."
    
    # Criamos um diretório temporário para extração segura
    EXTRACT_TMP=$(mktemp -d)
    
    if tar -xvzf "$FINAL_PATH" -C "$EXTRACT_TMP" ; then
      # Após extrair, removemos o tarball e movemos a pasta .app para o lugar dele
      rm "$FINAL_PATH"
      mkdir -p "$FINAL_PATH"
      cp -R "$EXTRACT_TMP/"* "$FINAL_PATH/"
      rm -rf "$EXTRACT_TMP"
      echo "✅ Extração concluída com sucesso em: $FINAL_PATH"
    else
      echo "❌ Erro ao extrair pacote. Mantendo arquivo original."
      rm -rf "$EXTRACT_TMP"
    fi
  else
    echo "ℹ️  O arquivo em $FINAL_PATH não parece estar comprimido. Pulando extração."
  fi
fi

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
