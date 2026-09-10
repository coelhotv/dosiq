#!/bin/bash
# build-ios.sh — Prepara certificados e roda eas build local
# Uso: bash build-ios.sh [development|preview|production]
#
# Perfis (spec 051-A · canais de OTA declarados em eas.json):
#   development → .app (simulador) · canal `development` · uso diário
#   preview     → .app (simulador) · canal `preview`     · alvo do smoke de OTA
#   device      → .ipa (ad hoc)    · canal `device`      · APARELHO FÍSICO registrado (065/PO-8)
#   production  → .ipa             · canal `production`  · TestFlight/App Store
#
# ℹ️ development/preview no iOS saem como build de SIMULADOR (não exigem Distribution
#    Certificate) — e simulador NÃO recebe push. Para qualquer smoke que dependa de
#    notificação no iPhone, o perfil é `device`: ad hoc assinado para os UDIDs de
#    `eas device:list`, sem passar pela Apple. O smoke
#    do OTA em device real roda no Android (build-android.sh preview) — o mecanismo do
#    expo-updates é o mesmo nas duas plataformas, e um device físico basta pra provar.

set -euo pipefail

# Resiliência de locale (039/F3): CocoaPods sob Ruby 4.0 quebra com
# "Unicode Normalization not appropriate for ASCII-8BIT (Encoding::CompatibilityError)"
# ao normalizar paths quando o locale não é UTF-8. O `eas build --local` roda pod install
# internamente → forçar UTF-8 aqui evita a falha. (Inofensivo se já estiver UTF-8.)
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

# Resiliência de ambiente (065 PR A): o `npm ci` que o EAS roda dentro do build morre com
# `EALLOWSCRIPTS` quando o ambiente traz `npm_config_allow_scripts` — o npm >= 11.17 recusa esse
# config vindo por ENV como se fosse flag de CLI em install de projeto ("--allow-scripts is not
# allowed in project-scoped installs"). A variável não vem do repo: o `npx` converte o `~/.npmrc`
# do operador em `npm_config_*` e as exporta ao processo filho.
#
# 🔴 `export npm_config_allow_scripts=` NÃO resolve (foi a primeira tentativa, e ela falha): o npx
# relê o `~/.npmrc` e sobrescreve o valor vazio. Medido:
#   export vazio + npx  → npm_config_allow_scripts=esbuild   (o arquivo vence)
#   userconfig alternativo + npx → npm_config_allow_scripts= (vazio atravessa)
# Por isso a neutralização é do ARQUIVO de config, não da variável: um userconfig vazio próprio do
# build. O `npm ci` passa a avisar que não rodou o postinstall de esbuild — é warning, não erro
# (exit 0 verificado), e o build do EAS não depende desse script.
BUILD_NPMRC="$(mktemp -t dosiq-build-npmrc)"
: > "$BUILD_NPMRC"
export npm_config_userconfig="$BUILD_NPMRC"
trap 'rm -f "$BUILD_NPMRC"' EXIT

PROFILE="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# R-307: procedencia do binario de loja (tag no git + arvore limpa)
. "$SCRIPT_DIR/lib-release-tag.sh"

# Falhar cedo e explícito: perfil desconhecido só apareceria como erro do EAS depois do
# prebuild + pod install (minutos perdidos).
case "$PROFILE" in
  development|preview|device|production) ;;
  *)
    echo "❌ Perfil inválido: '$PROFILE'"
    echo "   Use: development | preview | device | production"
    exit 1
    ;;
esac

# Bundle ID e Credenciais unificados
BUNDLE_ID="com.coelhotv.dosiq"
PLIST_FILE="$SCRIPT_DIR/GoogleService-Info.plist"

# `device` (ad hoc) assina com o MESMO Apple Distribution certificate do production — só o
# provisioning profile difere (lista de UDIDs em vez de App Store). Pular a verificação aqui
# devolveria o erro no FIM do build, depois do prebuild + pod install.
if [ "$PROFILE" = "production" ] || [ "$PROFILE" = "device" ]; then
  echo "🔍 Verificando Distribution Certificate no keychain..."
  CERT=$(security find-identity -v -p codesigning | grep -E "Apple Distribution" | grep "Antonio Coelho" | head -1)

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
  echo "ℹ️  Simulador (perfil $PROFILE): Pulando verificação de certificado de distribuição."
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

# SENTRY_AUTH_TOKEN: os .env não chegam ao build (o .easignore corta dotfiles; o env do prebuild
# morre antes do xcodebuild). Detalhe e evidência em lib-sentry-token.sh.
# No iOS o que sobe é o dSYM — sem ele o crash nativo também chega sem símbolo. O perfil de
# produção deixou de tolerar falha de upload, então a checagem vale para as duas plataformas.
# shellcheck source=lib-sentry-token.sh
. "$SCRIPT_DIR/lib-sentry-token.sh"
load_sentry_auth_token "$SCRIPT_DIR" || true
require_sentry_auth_token_for_production "$PROFILE"

# 1. Extrair versão do app.config.js
APP_VERSION=$(node -p "require('$SCRIPT_DIR/app.config.js').expo.version")
echo "📦 Versão detectada: v$APP_VERSION"

# 2. Preparar diretório de saída
TARGET_DIR="$HOME/local/dev-builds"
mkdir -p "$TARGET_DIR"

# 3. Definir nome e extensão do arquivo
# `.ipa` para tudo que instala em aparelho FÍSICO (production via TestFlight, device via ad hoc);
# `.app` só para os perfis de simulador.
if [ "$PROFILE" = "production" ] || [ "$PROFILE" = "device" ]; then
  EXT="ipa"
else
  EXT="app"
fi

TEMP_OUTPUT="$SCRIPT_DIR/build-temp.$EXT"
FINAL_NAME="dosiq-v$APP_VERSION-$PROFILE.$EXT"
FINAL_PATH="$TARGET_DIR/$FINAL_NAME"

# R-307: build de loja precisa de procedência. Checar ANTES de compilar.
if [ "$PROFILE" = "production" ]; then
  assert_taggable_build "$APP_VERSION" || exit 1
fi

echo ""
echo "📱 --- RESUMO DO PROCESSO ---"
echo "👤 Perfil:  $PROFILE"
echo "📡 Canal OTA: $PROFILE  (updates publicados em outro canal NÃO chegam neste build)"
echo "📦 Versão:  v$APP_VERSION"
echo "📂 Destino: $FINAL_PATH"
echo "🚀 Submit:  $( [ "$PROFILE" = "production" ] && echo "SIM (TestFlight ✈️)" || echo "NÃO (Apenas Local 💾)" )"
if [ "$PROFILE" = "device" ]; then
  echo "📲 Ad hoc:  instala em APARELHO FÍSICO registrado (eas device:list) — substitui o app da"
  echo "            App Store no aparelho, mesmos dados. Para voltar ao real, reinstalar pela loja."
fi
echo "-----------------------------"
read -p "Confirma as informações acima? (Enter para rodar / Ctrl+C para cancelar) "

# echo "🧹 Limpando cache e realizando Hard Reset do diretório nativo..."
# Deletar pastas nativas para resolver conflitos de sincronização (iCloud)
rm -rf "$SCRIPT_DIR/ios"
# rm -rf "$SCRIPT_DIR/android"

echo "Gerando prebuild pro iOS..."
# Prebuild sem instalar pacotes nativos automaticamente (evita erro de path com espaços no iCloud)
if npx expo prebuild --platform ios --no-install ; then
  echo "✅ Código nativo regenerado com sucesso."
else
  echo "❌ Erro ao regenerar código nativo. Verifique logs."
  exit 1
fi

# Instalação manual de Pods (mais resiliente a caminhos com espaços)
# echo "📦 Instalando dependências nativas (CocoaPods)..."
# cd "$SCRIPT_DIR/ios"
# if pod install ; then
#   cd "$SCRIPT_DIR"
#   echo "✅ CocoaPods concluído."
# else
#   echo "⚠️ Erro no pod install automático, tentando forçar com repo update..."
#   pod install --repo-update || {
#     echo "❌ Falha crítica no CocoaPods. Verifique o caminho iCloud para conflitos."
#     exit 1
#   }
#   cd "$SCRIPT_DIR"
# fi

rm -f "$TEMP_OUTPUT"

echo "🚀 Iniciando build iOS ($PROFILE) para v$APP_VERSION..."
# Build local via EAS - ignoramos o código de saída direto para checar o arquivo depois
# pois erros de cleanup (ENOTEMPTY) podem retornar 1 mesmo com build bem sucedida.
eas build --local --platform ios --profile "$PROFILE" --output "$TEMP_OUTPUT" --clear-cache || true

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

# 4.1 Extração automática para Simulador
# Só os perfis de SIMULADOR saem como tar.gz a extrair. `device` é .ipa assinado — extrair
# quebraria a assinatura, e antes esta condição era "tudo que não é production".
if { [ "$PROFILE" = "development" ] || [ "$PROFILE" = "preview" ]; } && [ -f "$FINAL_PATH" ]; then
  # Verifica se é um arquivo comprimido (tar.gz)
  if file "$FINAL_PATH" | grep -q "gzip compressed data"; then
    echo "📦 Detectado pacote comprimido. Iniciando extração para simulador..."
    
    # Criamos um diretório temporário para extração segura
    EXTRACT_TMP=$(mktemp -d)
    
    if tar -xvzf "$FINAL_PATH" -C "$EXTRACT_TMP" ; then
      # Identifica o bundle .app extraído
      EXTRACTED_APP=$(find "$EXTRACT_TMP" -name "*.app" -type d -maxdepth 1 | head -1)
      
      if [ -n "$EXTRACTED_APP" ]; then
        APP_NAME=$(basename "$EXTRACTED_APP")
        echo "📂 Bundle identificado: $APP_NAME"
        rm "$FINAL_PATH"
        mv "$EXTRACTED_APP" "$FINAL_PATH"
        echo "✅ Extração e renomeação concluídas em: $FINAL_PATH"
      else
        echo "⚠️ Nenhum bundle .app detectado. Usando fallback..."
        rm "$FINAL_PATH"
        mv "$EXTRACT_TMP" "$FINAL_PATH"
      fi
      rm -rf "$EXTRACT_TMP"
    else
      echo "❌ Erro ao extrair pacote."
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
    echo "⚠️ Falha na submissão, mas o build foi preservado em $FINAL_PATH"
    exit 1
  fi
fi

# R-307: marcar o commit que virou este binário. Depois do submit — iOS e Android do MESMO commit
# compartilham UMA tag, e create_release_tag é idempotente para o segundo a rodar.
if [ "$PROFILE" = "production" ]; then
  create_release_tag "$APP_VERSION"
fi

echo "✨ Processo finalizado com sucesso!"
echo "📂 Arquivo disponível em: $FINAL_PATH"
