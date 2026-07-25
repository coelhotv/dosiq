#!/usr/bin/env bash
# fleet-versions.sh — inventário das versões da app INSTALADAS em campo (ADR-088 / AP-314).
#
# Existe porque `git grep` responde "quem VAI usar esta coluna" e a pergunta que derruba produção é
# "quem ESTÁ usando". O código que quebra num DROP não está no repositório: está compilado dentro do
# aparelho do usuário. No outage de 2026-07-22, 21 das 25 instalações ativas foram quebradas por um
# DROP cujo gate provou, corretamente, zero leitores no repositório.
#
# Uso:
#   ./scripts/fleet-versions.sh                      # distribuição da frota ativa (30d)
#   ./scripts/fleet-versions.sh titration_status     # + veredito de DROP para uma coluna
#
# Com um nome de coluna, o script varre as versões ativas no histórico do git e diz quais delas
# referenciam a coluna — é o passo 2 do checklist de DDL destrutiva
# (docs/standards/SUPABASE_MIGRATIONS.md).
#
# FONTE ADITIVA (spec 057 / ADR-089): `device_activity` cruza usuários que nunca ativaram
# notificações (R-239 — push é contextual, nunca pedido no 1º load) e por isso eram invisíveis
# aqui. É union, nunca substitui `notification_devices` — o dedupe por (user_id, platform) abaixo
# já cobre o caso de um usuário aparecer nas duas fontes (mantém só a linha mais recente).

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_KEY:-}}"
URL="${SUPABASE_URL:-}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (.env)."
  exit 1
fi

COLUMN="${1:-}"
FLEET_TMP="$(mktemp -t fleet-versions)"
export FLEET_TMP
trap 'rm -f "$FLEET_TMP"' EXIT

echo "════════════════════════════════════════════════════════════════"
echo " FROTA ATIVA — instalações vistas nos últimos 30 dias"
echo "════════════════════════════════════════════════════════════════"

SINCE="$(date -u -v-30d +%Y-%m-%d 2>/dev/null || date -u -d '30 days ago' +%Y-%m-%d)"

FLEET_JSON=$(curl -sS \
  "$URL/rest/v1/notification_devices?select=app_version,platform,user_id,updated_at&updated_at=gte.$SINCE" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")

# device_activity (spec 057 / ADR-089): fonte ADITIVA, cruza quem nunca ativou push. Falha de
# leitura aqui não pode derrubar a medição principal (notification_devices segue valendo) —
# best-effort, com aviso explícito (nunca silencioso).
FLEET_JSON_ACTIVITY=$(curl -sS \
  "$URL/rest/v1/device_activity?select=app_version,platform,user_id,last_seen_at&last_seen_at=gte.$SINCE" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" || echo '[]')

if [ -z "$FLEET_JSON" ] || [ "$FLEET_JSON" = "[]" ]; then
  echo "⚠️  Nenhum device ativo retornado — confira as credenciais antes de concluir 'frota vazia'."
  exit 1
fi

if [ -z "$FLEET_JSON_ACTIVITY" ]; then
  echo "⚠️  device_activity não respondeu — frota medida só por notification_devices (piso, não retrato)."
  FLEET_JSON_ACTIVITY='[]'
fi

export FLEET_JSON_ACTIVITY

# Uma linha por (user_id, platform), mantendo o device mais recente: um usuário com 3 aparelhos
# antigos não pode pesar como 3 votos contra o DROP. Funde as duas fontes ANTES do dedupe — união,
# nunca substituição (FR-005): notification_devices usa `updated_at`, device_activity usa
# `last_seen_at`; normalizadas para o mesmo campo antes de comparar.
#
# 🔴 A LÓGICA NÃO MORA MAIS AQUI (spec 051 / RC3-2 F3): união, janela e dedupe vivem em
# `@dosiq/core/utils` (`dedupeFleetInstalls` / `summarizeFleetVersions`), e o handler admin do kill
# switch consome as MESMAS funções. O `acknowledge_affected_devices` compara *o número que o operador
# viu aqui* com *o que o servidor conta* — duas implementações significariam recusa falsa em plena
# emergência, ou confirmação sobre um conjunto diferente do que será bloqueado.
echo "$FLEET_JSON" | node -e '
const fs = require("fs")
const rows = JSON.parse(fs.readFileSync(0, "utf8"))
const activity = JSON.parse(process.env.FLEET_JSON_ACTIVITY || "[]")

import("@dosiq/core/utils").then(({ dedupeFleetInstalls, summarizeFleetVersions }) => {
  // O core faz o guard de "não-array" (PostgREST devolve objeto de erro em vez de array quando a
  // leitura falha) e ignora linha sem app_version — não repetir aqui.
  const installs = dedupeFleetInstalls(rows, activity)
  const s = summarizeFleetVersions(installs)
  const total = s.totalInstalls

  console.log("")
  console.log("  versão      instalações   usuários   % da frota")
  console.log("  ─────────────────────────────────────────────────")
  for (const b of s.byVersion) {
    const pct = total > 0 ? ((b.installs / total) * 100).toFixed(1) : "0.0"
    console.log(`  ${b.version.padEnd(11)} ${String(b.installs).padStart(6)}      ${String(b.users).padStart(6)}   ${pct.padStart(7)}%`)
  }
  console.log("  ─────────────────────────────────────────────────")
  console.log(`  TOTAL       ${String(total).padStart(6)}      ${String(s.totalUsers).padStart(6)}`)
  console.log("")
  console.log(`  Versão mais antiga ativa: ${s.oldestVersion}`)
  console.log(`  Piso de 5% (ADR-088): ${(total * 0.05).toFixed(1)} instalações`)
  fs.writeFileSync(process.env.FLEET_TMP, JSON.stringify(s.byVersion.map(b => b.version)))
}).catch(err => {
  // Falha ALTA e com instrução: um script de frota que devolve número errado é pior que um que não
  // roda — este número autoriza DROP e bloqueio de boot.
  console.error("❌ Não foi possível carregar @dosiq/core/utils: " + err.message)
  console.error("   Rode: npm run build --workspace @dosiq/core")
  process.exit(1)
})
'

[ -z "$COLUMN" ] && {
  echo ""
  echo "ℹ️  Passe um nome de coluna para o veredito de DROP: ./scripts/fleet-versions.sh <coluna>"
  exit 0
}

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " VEREDITO DE DROP — coluna \`$COLUMN\`"
echo "════════════════════════════════════════════════════════════════"
echo ""

VERSIONS=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.env.FLEET_TMP,"utf8")).join(" "))')
AFFECTED=0
UNKNOWN=0

for V in $VERSIONS; do
  # A tag/commit de cada release: o APP_VERSION vive em app.config.js (R-182).
  # `|| true` em toda busca: `git log`/`git grep` saem com 1 quando não encontram, e sob
  # `set -e` isso mataria o script EM SILÊNCIO — a mesma classe de falha muda que este script
  # existe para evitar.
  REF=$(git log --all --format="%H" -S"const APP_VERSION = '$V'" -- apps/mobile/app.config.js 2>/dev/null | head -1 || true)
  if [ -z "$REF" ]; then
    printf "  %-11s ❓ commit não localizado — verificar à mão\n" "$V"
    UNKNOWN=$((UNKNOWN + 1))
    continue
  fi
  # Só interessa referência EXECUTÁVEL. Menção em comentário ou em teste não vai ao PostgREST, e
  # um gate que bloqueia por comentário vira ruído — gate ruidoso é gate ignorado.
  # Filtra: arquivos de teste fora; linhas que começam com //, *, /*, # ou -- fora.
  MATCHES=$(git grep -n "$COLUMN" "$REF" -- apps/mobile packages/core 2>/dev/null \
    | grep -v -E '(__tests__|\.test\.|\.spec\.)' \
    | grep -v -E ':[0-9]+: *(//|\*|/\*|#|--)' || true)

  HITS=$(printf '%s' "$MATCHES" | grep -c . || true)
  [ -z "$HITS" ] && HITS=0

  if [ "$HITS" != "0" ]; then
    printf "  %-11s 🔴 REFERENCIA a coluna (%s ocorrência(s) executável(is))\n" "$V" "$HITS"
    # Mostra a evidência: quem lê o veredito precisa poder julgar sem reabrir o histórico.
    printf '%s\n' "$MATCHES" | head -2 | sed 's/^/                 ↳ /' | cut -c1-150
    AFFECTED=$((AFFECTED + 1))
  else
    printf "  %-11s ✅ limpa\n" "$V"
  fi
done

echo ""
if [ "$AFFECTED" -gt 0 ]; then
  echo "❌ DROP BLOQUEADO — $AFFECTED versão(ões) ativa(s) referenciam \`$COLUMN\`."
  echo "   Era 1 (ADR-088, até a spec 051 entregue e adotada): expand/contract é a única saída."
  echo "   Deixe a coluna inerte com DEFAULT que reproduza o valor lido hoje."
  exit 1
fi

if [ "$UNKNOWN" -gt 0 ]; then
  echo "⚠️  $UNKNOWN versão(ões) sem commit localizado — resolver ANTES de dropar."
  echo "   Versão não verificada conta como afetada (fail-safe)."
  exit 1
fi

echo "✅ Nenhuma versão ativa referencia \`$COLUMN\`."
echo "   Ainda assim: DROP é irreversível e a telemetria é PISO, não retrato."
