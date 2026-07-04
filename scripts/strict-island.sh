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

A_SRC='^packages/core/src/(types|repositories|services|schemas)/'
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
