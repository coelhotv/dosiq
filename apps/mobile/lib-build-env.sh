#!/bin/bash
# lib-build-env.sh — ambiente e utilitários comuns dos scripts de build (build-ios.sh / build-android.sh)
#
# Sourced. Não executar direto.

# isolate_npm_userconfig
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
#
# ⚠️ Instala um `trap ... EXIT` global para apagar o arquivo: o script chamador NÃO pode definir
# outro trap de EXIT depois (sobrescreveria este e vazaria o arquivo temporário).
# Só os builds nativos precisam disso — o `eas update` (publish-ota.sh) não roda `npm ci`.
isolate_npm_userconfig() {
  BUILD_NPMRC="$(mktemp -t dosiq-build-npmrc)"
  : > "$BUILD_NPMRC"
  export npm_config_userconfig="$BUILD_NPMRC"
  trap 'rm -f "$BUILD_NPMRC"' EXIT
}

# parse_build_args "$@"
# Define PROFILE (primeiro argumento posicional; padrão development) e NO_INSTALL (flag --no-install).
# shellcheck disable=SC2034  # PROFILE e NO_INSTALL são lidos pelo script chamador
parse_build_args() {
  PROFILE="development"
  NO_INSTALL=0
  local arg
  for arg in "$@"; do
    case "$arg" in
      --no-install) NO_INSTALL=1 ;;
      -*) echo "❌ Flag desconhecida: '$arg' (use --no-install)"; exit 1 ;;
      *) PROFILE="$arg" ;;
    esac
  done
}

# get_app_version <script_dir>
# Versão do app (fonte canônica: app.config.js).
get_app_version() {
  node -p "require('$1/app.config.js').expo.version"
}

# build_log_path <diretório> <rótulo> <perfil|canal> <versão>
# Caminho do log de uma execução. O diretório temporário do EAS é apagado ao fim do build, então
# o log é a única evidência de uma falha.
build_log_path() {
  echo "$1/$2-$3-v$4-$(date +%Y%m%d-%H%M%S).log"
}
