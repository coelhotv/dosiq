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
STATIC_COPY_OK=(
  "apps/mobile/src/features/medications/screens/MedicineFormScreen.tsx:301"
)

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
