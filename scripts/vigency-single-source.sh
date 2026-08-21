#!/usr/bin/env bash
# scripts/vigency-single-source.sh — 064 PR 2: farol de FONTE ÚNICA de vigência (SC-004/PO-5).
#
# O bug do 064 foi um filtro de vigência solto: `p.active` e nada mais, replicado em 8 sítios,
# cada um esquecendo um eixo diferente. A correção só se sustenta se o predicado canônico
# (`isProtocolVigentOn`, packages/core/src/utils/adherenceLogic.ts) continuar sendo o único
# lugar que decide "este tratamento vale nesta data".
#
# Este gate acusa filtro de vigência de protocolo escrito À MÃO em JS/TS:
#   .filter(p => p.active)            .filter(p => p.active !== false)
#   .find(p => ... && p.active)       .some(p => ... && p.active !== false)
#
# FORA DE ESCOPO por construção (não são predicado JS reusável):
#   - QUERIES Supabase (`.eq('active', true)`, `.or('end_date.is.null…')`, `.is('paused_at', null)`)
#     — filtro SQL redundante por performance; ver o comentário em createProtocolRepository.getActive
#     e `server/bot/_reminderHelpers.ts` (predicado no SELECT, entregue pela spec 050).
#   - `stock_paused_at` / `paused_at` de PERFIL ou de dose_instance: outro domínio.
#
# LIBERAÇÃO pontual: marcador inline `vigency-gate: ok — <motivo>` na própria linha ou na
# anterior. Marcador viaja junto com o código; âncora por número de linha apodrece (a lição
# cara do unit-label-gate.sh, main vermelha por 5 dias).
set -uo pipefail
cd "$(dirname "$0")/.."

# ESCOPO: o read-path de CONSUMO/ESTOQUE (o que o 064 corrigiu). Filtros de LISTAGEM e de
# rótulo fora destes módulos (log form, emergência, histórico) têm semântica própria e não
# entram — ampliar o escopo aqui é decisão de spec, não deste gate.
HITS=$(grep -rEn "\.(filter|find|some|every)\((\([^)]*\)|[A-Za-z_]+) =>[^)]*\b[A-Za-z_]+\??\.active\b" \
  packages/core/src/utils packages/core/src/chatbot packages/core/src/services \
  apps/web/src/features/stock apps/web/src/features/dashboard \
  apps/web/src/views/Stock.tsx \
  apps/web/src/features/reports/services/consultationPdfDataBuilder.ts \
  server/bot/commands \
  --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -v __tests__ | grep -v '\.test\.')

# DÍVIDA DECLARADA (não é liberação): sítios de CONSUMO que ficaram FORA do escopo
# declarado do PR 2 do 064 e foram reportados ao PO. Entrada aqui é para sumir — cada uma
# vira task de spec, não vira permanente.
#   - refillPredictionService.ts: previsão de recompra do card de tratamento; filtra
#     `p.active === true` (perde o eixo end_date E descarta `active NULL`). Reportado como
#     candidato a 9º sítio; corrigir exige tocar `_treatmentListUtils`, fora do PR 2.
PENDING_064=(
  "apps/web/src/features/stock/services/refillPredictionService.ts"
)

is_pending() {
  local file="$1"
  for entry in "${PENDING_064[@]:-}"; do
    [[ "$file" == "$entry" ]] && return 0
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

  # Comentário/JSDoc citando o padrão (inclusive este cabeçalho quando citado em doc).
  if echo "$trimmed" | grep -qE "^(//|\*|/\*)"; then
    continue
  fi
  # Marcador inline (linha atual ou anterior), sempre com o porquê.
  # Até 2 linhas acima: justificativa boa costuma não caber em uma linha só.
  prev_line=""
  [[ "$lineno" -gt 1 ]] && prev_line="$(sed -n "$((lineno - 2)),$((lineno - 1))p" "$file" 2>/dev/null)"
  if echo "$content$prev_line" | grep -qE "vigency-gate:[[:space:]]*ok"; then
    continue
  fi
  # Dívida declarada do 064 (reportada ao PO, com task própria).
  if is_pending "$file"; then
    continue
  fi

  violations+=("$line")
done <<< "$HITS"

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "❌ vigency-single-source: filtro de vigência solto fora de isProtocolVigentOn (064/SC-004):"
  printf '  %s\n' "${violations[@]}"
  echo ""
  echo "Use isProtocolVigentOn(protocol, dateStr) de @dosiq/core: 'active' é NULLABLE no banco"
  echo "e a vigência tem eixo de DATA (end_date inclusiva). Se o filtro for de LISTAGEM/rótulo"
  echo "e não de consumo, marque a linha com 'vigency-gate: ok — <motivo>'."
  exit 1
fi

echo "✅ vigency-single-source: nenhum filtro de vigência solto (064/SC-004)."
exit 0
