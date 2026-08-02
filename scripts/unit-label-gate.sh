#!/usr/bin/env bash
# scripts/unit-label-gate.sh — 053 Slice A: farol anti-regressão (PO-5/FR-006).
#
# Acusa concatenação NOVA de rótulo de unidade (ml/mL) fora dos formatadores do
# core (packages/core/src/utils/). Grep frouxo (E1, plan.md 053) falso-positiva
# em 3 classes que NÃO são emissão de rótulo de apresentação:
#   1. comparação de VALOR — `dosage_unit.endsWith('/ml')` (isLiquidUnit e afins)
#   2. comentário/JSDoc citando a grafia como exemplo
#   3. copy estática já correta (não é concatenação dinâmica)
# Essas 3 classes são excluídas por PADRÃO (linha abaixo). O que sobra é
# checado contra a allowlist nomeada (053 Slice A→B: emissões AINDA não
# varridas pelo sweep do Slice B — cada entrada deve sumir quando o call site
# correspondente passar a chamar o formatador do core; não adicionar entrada
# nova sem justificativa documentada).
set -uo pipefail
cd "$(dirname "$0")/.."

# Baseline congelada 2026-07-19 (plan.md 053 §Baseline oficial do PO-3).
E1_HITS=$(grep -rEn "(['\"\`][^'\"\`]*[0-9)}][ ]?m[lL]\b[^'\"\`]*['\"\`])|(\\\$\{[^}]*\}[ ]?m[lL]\b)|(>[^<{]*\bm[lL]\b)" \
  apps/web/src apps/mobile/src server/bot --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -v __tests__ | grep -v '\.test\.')

# Allowlist "concatenação pendente" — vazia desde o Slice B (todas as 4 emissões
# reais do baseline E1 passaram a chamar o formatador do core). Mantida como
# array (não removida) para o padrão de allowlist nomeada continuar disponível
# caso um sweep futuro precise dela.
PENDING_SLICE_B=()

# Allowlist "copy estática já correta" — grafia certa, não é concatenação de
# unidade dinâmica (texto fixo de ajuda ao usuário).
#
# 🔴 ANCORAR EM LINHA NÃO FUNCIONA. Esta lista já teve
# `MedicineFormScreen.tsx:301`; o commit 249616d0 (#774, edge-to-edge) inseriu 5
# linhas ACIMA e a copy virou 306 — a âncora deixou de casar e o gate passou a
# reprovar a própria linha que ele existia para permitir. Pior: `npm run lint` só
# roda em push na main, então a main ficou VERMELHA de 2026-07-29 (merge #781) a
# 2026-08-02 sem ninguém ver.
#
# Preferir SEMPRE o marcador inline `unit-label-gate: ok` (classe 4 abaixo): ele
# viaja junto com a linha e não envelhece. Esta lista fica só para o caso em que
# o marcador não cabe (arquivo gerado, linha sem espaço para comentário).
STATIC_COPY_OK=()

is_allowlisted() {
  local key="$1"
  for entry in "${PENDING_SLICE_B[@]:-}" "${STATIC_COPY_OK[@]:-}"; do
    if [[ "$key" == "$entry" ]]; then
      return 0
    fi
  done
  return 1
}

violations=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file="${line%%:*}"
  rest="${line#*:}"
  lineno="${rest%%:*}"
  content="${rest#*:}"
  trimmed="$(echo "$content" | sed -E 's/^[[:space:]]*//')"

  # Classe 1: comparação de VALOR (endsWith('/ml') / endsWith("/ml")).
  if echo "$trimmed" | grep -qE "endsWith\(['\"]\/ml['\"]\)"; then
    continue
  fi
  # Classe 2: comentário/JSDoc.
  if echo "$trimmed" | grep -qE "^(//|\*|/\*\*)"; then
    continue
  fi
  # Classe 3: allowlist nomeada (pendente Slice B ou copy estática ok).
  if is_allowlisted "${file}:${lineno}"; then
    continue
  fi
  # Classe 4: marcador inline — na própria linha OU na anterior (padrão
  # `eslint-disable-next-line`, porque em JSX raramente cabe comentário na mesma
  # linha do atributo). Imune a deslocamento: viaja junto com o código, ao
  # contrário da âncora por número de linha (ver nota da STATIC_COPY_OK).
  # Escrever sempre com o porquê: `unit-label-gate: ok — <justificativa>`.
  prev_line=""
  [[ "$lineno" -gt 1 ]] && prev_line="$(sed -n "$((lineno - 1))p" "$file" 2>/dev/null)"
  if echo "$content$prev_line" | grep -qE "unit-label-gate:[[:space:]]*ok"; then
    continue
  fi

  violations+=("$line")
done <<< "$E1_HITS"

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "❌ unit-label-gate: concatenação de unidade fora do core detectada (053/PO-5):"
  printf '  %s\n' "${violations[@]}"
  echo ""
  echo "Emitir rótulo via formatador de packages/core/src/utils/doseUnit.ts (ou"
  echo "adicionar à allowlist deste script SOMENTE com justificativa — nunca pra"
  echo "silenciar uma emissão real)."
  exit 1
fi

echo "✅ unit-label-gate: nenhuma concatenação de unidade fora do core (além da allowlist documentada)."
exit 0
