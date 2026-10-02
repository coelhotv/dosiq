#!/usr/bin/env bash
# lib-sentry-token.sh — carrega SENTRY_AUTH_TOKEN para o processo de build.
#
# POR QUE ISTO EXISTE
# O token mora nos arquivos `.env`, mas eles NÃO chegam ao build:
#   1. o `.easignore` ignora todo dotfile (`.*`), liberando só `/.easignore` e `/.gitignore` —
#      então `.env` não entra no pacote que o EAS monta;
#   2. o `.env` que o Expo CLI carrega vive no processo do `expo prebuild`, que morre antes do
#      gradle/xcodebuild rodar.
#
# Resultado medido em 2026-07-30 (API do Sentry, projeto dosiq-d4/dosiq-app): **zero** debug files
# e **zero** artifact bundles; a release `com.coelhotv.dosiq@0.30.0+3000` existe e recebeu evento,
# mas sem nenhum arquivo de simbolização. O upload nunca aconteceu — e o `SENTRY_ALLOW_FAILURE:
# "true"` do perfil de produção escondia isso desde sempre, exatamente o silêncio que a
# Constituição §IX proíbe em superfície que o time precisa enxergar.
#
# Com o R8 ligado a consequência deixa de ser cosmética: sem o `mapping.txt` no Sentry, todo stack
# trace Android de produção chega com nomes ofuscados — o crash reportado vira ruído justo no dia
# em que ele importa.
#
# ALTERNATIVA para build na nuvem: `eas secret:create --scope project --name SENTRY_AUTH_TOKEN`.
# Esta lib cobre o caminho `eas build --local`, que é como o PO builda hoje.

# load_sentry_auth_token <script_dir>
# Exporta SENTRY_AUTH_TOKEN se ainda não estiver no ambiente. Não sobrescreve valor já exportado
# (shell e CI mandam mais que arquivo). Nunca imprime o token — só de onde veio.
load_sentry_auth_token() {
  local script_dir="$1"

  if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then
    echo "🔐 SENTRY_AUTH_TOKEN já presente no ambiente"
    return 0
  fi

  local env_file token_line
  for env_file in \
    "$script_dir/.env.local" \
    "$script_dir/.env" \
    "$script_dir/../../.env.local" \
    "$script_dir/../../.env"; do
    [ -f "$env_file" ] || continue

    token_line=$(grep -m1 '^SENTRY_AUTH_TOKEN=' "$env_file" || true)
    [ -n "$token_line" ] || continue

    SENTRY_AUTH_TOKEN="${token_line#SENTRY_AUTH_TOKEN=}"
    # tolera valor entre aspas simples ou duplas
    SENTRY_AUTH_TOKEN=$(printf '%s' "$SENTRY_AUTH_TOKEN" | tr -d "\"'")
    export SENTRY_AUTH_TOKEN
    echo "🔐 SENTRY_AUTH_TOKEN carregado de ${env_file}"
    return 0
  done

  return 1
}

# require_sentry_auth_token_for_production <profile>
# Aborta ANTES do build (não depois de 20 minutos de compilação) quando o perfil é production e o
# token não existe.
require_sentry_auth_token_for_production() {
  local profile="$1"

  [ "$profile" = "production" ] || return 0
  [ -z "${SENTRY_AUTH_TOKEN:-}" ] || return 0

  echo "❌ SENTRY_AUTH_TOKEN ausente — abortando ANTES do build."
  echo "   Sem ele o mapping/dSYM não sobe, e o crash de produção chega ilegível ao Sentry."
  echo "   Defina em apps/mobile/.env.local, exporte no shell, ou use:"
  echo "     eas secret:create --scope project --name SENTRY_AUTH_TOKEN --type string --value <token>"
  exit 1
}
