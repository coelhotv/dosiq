#!/usr/bin/env bash
# 040 — Ratchet strict island (redesenho pós-gate F2).
#
# Contrato: fonte dos domínios nível A DEVE estar strict-limpa. Arquivos nível B
# puxados transitivamente pro programa (utils/, chatbot/, storage, shared-data)
# são dívida tolerada (TODO(040-strict)) — contada, não bloqueante. Testes dos
# domínios A idem (dívida separada, apertar no F6).
#
# Ratchet cresce em 2 eixos: adicionar dir ao include do tsconfig.strict.json
# e/ou ao filtro A_SRC abaixo quando um domínio for promovido a nível A.
set -uo pipefail
cd "$(dirname "$0")/.."

A_SRC='^(packages/core/src/(types|repositories|services|schemas)|server/notifications|apps/web/src/shared/hooks|apps/mobile/src/shared/hooks)/'
TESTS='__tests__|\.test\.'

OUT=$(npx tsc -p tsconfig.strict.json --noEmit 2>&1 | grep -E ': error TS' || true)

A_ERRORS=$(printf '%s\n' "$OUT" | grep -E "$A_SRC" | grep -vE "$TESTS" || true)
A_TEST_COUNT=$(printf '%s\n' "$OUT" | grep -E "$A_SRC" | grep -cE "$TESTS" || true)
B_COUNT=$(printf '%s\n' "$OUT" | grep -vE "$A_SRC" | grep -c ': error TS' || true)

echo "strict island — dívida tolerada: ${B_COUNT} erros nível-B transitivo, ${A_TEST_COUNT} em testes A"

if [ -n "$A_ERRORS" ]; then
  echo "❌ RATCHET QUEBRADO — erros em fonte nível A:"
  printf '%s\n' "$A_ERRORS"
  exit 1
fi
echo "✅ fonte nível A strict-limpa"

# Cross-program (lição gate F3): "strict-limpo" ≠ "limpo em todo programa que
# inclui o core". api/ e server/ compilam o core transitivamente sob flags
# non-strict (base) — a inferência muda (ex.: opcionalidade Zod) e revela erros
# invisíveis ao strict island. Erro de FONTE aqui é regressão observável no
# build/runtime Vercel — bloqueante. Testes seguem como dívida contada.
# Adicionar tsconfigs consumidores conforme F4/F5 os criarem.
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

CONSUMERS="api/tsconfig.json server/tsconfig.json apps/mobile/tsconfig.json"
for P in $CONSUMERS; do
  [ -f "$P" ] || continue
  P_OUT=$(npx tsc -p "$P" --noEmit 2>&1 | grep -E ': error TS' || true)
  P_SRC=$(printf '%s\n' "$P_OUT" | grep -vE "$TESTS" || true)
  P_TEST_COUNT=$(printf '%s\n' "$P_OUT" | grep -cE "$TESTS" || true)
  if [ -n "$P_SRC" ]; then
    echo "❌ CROSS-PROGRAM QUEBRADO — erros de fonte no programa $P:"
    printf '%s\n' "$P_SRC"
    exit 1
  fi
  echo "✅ $P fonte limpa (dívida em testes: ${P_TEST_COUNT})"
done
