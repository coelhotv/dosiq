#!/usr/bin/env bash
# 040 — Ratchet strict island (redesenho pós-gate F2; catraca por bucket desde F6 Bloco 0).
#
# Contrato: fonte dos domínios nível A DEVE estar strict-limpa. Arquivos nível B
# puxados transitivamente pro programa (utils/, chatbot/, storage, shared-data)
# são dívida tolerada (TODO(040-strict)) — contada CONTRA TETO POR BUCKET.
# Testes dos domínios A idem (bucket separado por território).
#
# CATRACA (F6): cada lote 6.x que queima dívida ABAIXA o teto do(s) seu(s)
# bucket(s) NO MESMO PR. Teto nunca sobe. Bucket separado por workspace de
# propósito: lote de um workspace não pode "pagar" dívida de outro.
# Pós-040: regra on-touch — épico que tocar domínio X triageia os testes de X
# antes de refatorar; .test.ts* novo nasce strict-limpo.
#
# Ratchet cresce em 2 eixos: adicionar dir ao include do tsconfig.strict.json
# e/ou ao filtro A_SRC abaixo quando um domínio for promovido a nível A.
set -uo pipefail
cd "$(dirname "$0")/.."

# ── Tetos por bucket (baseline 2026-07-06, F6 Bloco 0; lotes 6.x abaixam) ──
MAX_B_PACKAGES=444        # packages/* nível-B transitivo (core 381 + shared-data 44 + storage 15 + config 4)
MAX_B_WEB=37              # apps/web nível-B transitivo
MAX_B_MOBILE=18           # apps/mobile nível-B transitivo
MAX_B_SERVER=36           # server/* nível-B transitivo (utils 25 + bot 10 + services 1)
MAX_A_TESTS_CORE=353      # testes dos domínios A do core (lote 6.3 → ≤120)
MAX_A_TESTS_SERVER=119    # testes de server/notifications (lote 6.2 → 0)
MAX_A_TESTS_WEB=0         # testes hooks web (já zerado — trava)
MAX_A_TESTS_MOBILE=11     # testes hooks mobile (lote 6.4 → 0)
MAX_TESTS_PROG_API=0      # programa api/ (testes)
MAX_TESTS_PROG_SERVER=48  # programa server/ (testes; lote 6.2 → 0)
MAX_TESTS_PROG_MOBILE=86  # programa mobile (testes; lote 6.4 → ≤30)

A_SRC='^(packages/core/src/(types|repositories|services|schemas)|server/notifications|apps/web/src/shared/hooks|apps/mobile/src/shared/hooks)/'
TESTS='__tests__|\.test\.'
FAIL=0

check_ceiling() { # label count max
  if [ "$2" -gt "$3" ]; then
    echo "❌ CATRACA ESTOURADA — $1: $2 > teto $3"
    FAIL=1
  else
    echo "✅ $1: $2 (teto $3)"
  fi
}

OUT=$(npx tsc -p tsconfig.strict.json --noEmit 2>&1 | grep -E ': error TS' || true)

A_ERRORS=$(printf '%s\n' "$OUT" | grep -E "$A_SRC" | grep -vE "$TESTS" || true)
if [ -n "$A_ERRORS" ]; then
  echo "❌ RATCHET QUEBRADO — erros em fonte nível A:"
  printf '%s\n' "$A_ERRORS"
  exit 1
fi
echo "✅ fonte nível A strict-limpa"

# Buckets nível-B transitivo por workspace
B_OUT=$(printf '%s\n' "$OUT" | grep -vE "$A_SRC" || true)
check_ceiling "B packages/*" "$(printf '%s\n' "$B_OUT" | grep -c '^packages/' || true)" "$MAX_B_PACKAGES"
check_ceiling "B apps/web"   "$(printf '%s\n' "$B_OUT" | grep -c '^apps/web/' || true)" "$MAX_B_WEB"
check_ceiling "B apps/mobile" "$(printf '%s\n' "$B_OUT" | grep -c '^apps/mobile/' || true)" "$MAX_B_MOBILE"
check_ceiling "B server/*"   "$(printf '%s\n' "$B_OUT" | grep -c '^server/' || true)" "$MAX_B_SERVER"

# Buckets testes A por território
AT_OUT=$(printf '%s\n' "$OUT" | grep -E "$A_SRC" | grep -E "$TESTS" || true)
check_ceiling "testes A core"        "$(printf '%s\n' "$AT_OUT" | grep -c '^packages/core/' || true)" "$MAX_A_TESTS_CORE"
check_ceiling "testes A server/notifications" "$(printf '%s\n' "$AT_OUT" | grep -c '^server/notifications/' || true)" "$MAX_A_TESTS_SERVER"
check_ceiling "testes A hooks web"   "$(printf '%s\n' "$AT_OUT" | grep -c '^apps/web/' || true)" "$MAX_A_TESTS_WEB"
check_ceiling "testes A hooks mobile" "$(printf '%s\n' "$AT_OUT" | grep -c '^apps/mobile/' || true)" "$MAX_A_TESTS_MOBILE"

# Cross-program (lição gate F3): "strict-limpo" ≠ "limpo em todo programa que
# inclui o core". api/ e server/ compilam o core transitivamente sob flags
# non-strict (base) — a inferência muda (ex.: opcionalidade Zod) e revela erros
# invisíveis ao strict island. Erro de FONTE aqui é regressão observável no
# build/runtime Vercel — bloqueante. Testes: teto por programa.
# Guard de extensão (lição gate F3, 2ª ocorrência): imports relativos em api/ e
# server/ DEVEM ter extensão .js — tsx e vitest resolvem extensionless (smoke
# local passa), mas o Node ESM puro da Vercel quebra com ERR_MODULE_NOT_FOUND.
# O tsc local (moduleResolution bundler) não valida extensão; este grep valida.
EXTLESS=$(grep -rnE "from '\.\.?/[^']*'" server api --include='*.ts' \
  --exclude-dir=node_modules --exclude-dir=__tests__ 2>/dev/null \
  | grep -vE '\.test\.' | grep -vE "\.(js|json)';?\$" || true)
if [ -n "$EXTLESS" ]; then
  echo "❌ IMPORT EXTENSIONLESS em server/api (quebra Node ESM Vercel):"
  printf '%s\n' "$EXTLESS"
  exit 1
fi
echo "✅ server/api sem import relativo extensionless"

for P in api/tsconfig.json server/tsconfig.json apps/mobile/tsconfig.json; do
  [ -f "$P" ] || continue
  P_OUT=$(npx tsc -p "$P" --noEmit 2>&1 | grep -E ': error TS' || true)
  P_SRC=$(printf '%s\n' "$P_OUT" | grep -vE "$TESTS" || true)
  P_TEST_COUNT=$(printf '%s\n' "$P_OUT" | grep -cE "$TESTS" || true)
  if [ -n "$P_SRC" ]; then
    echo "❌ CROSS-PROGRAM QUEBRADO — erros de fonte no programa $P:"
    printf '%s\n' "$P_SRC"
    exit 1
  fi
  case "$P" in
    api/*)    check_ceiling "testes programa api"    "$P_TEST_COUNT" "$MAX_TESTS_PROG_API" ;;
    server/*) check_ceiling "testes programa server" "$P_TEST_COUNT" "$MAX_TESTS_PROG_SERVER" ;;
    *)        check_ceiling "testes programa mobile" "$P_TEST_COUNT" "$MAX_TESTS_PROG_MOBILE" ;;
  esac
done

[ "$FAIL" -eq 0 ] && echo "✅ ratchet OK (todos os buckets dentro dos tetos)" || exit 1
