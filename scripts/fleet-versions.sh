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
# LIMITAÇÃO (não ignorar): `notification_devices` só enxerga quem ATIVOU notificações. O número é
# PISO, não retrato. Na dúvida, tratar a frota como maior do que a medição indica.

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

FLEET_JSON=$(curl -sS \
  "$URL/rest/v1/notification_devices?select=app_version,platform,user_id,updated_at&updated_at=gte.$(date -u -v-30d +%Y-%m-%d 2>/dev/null || date -u -d '30 days ago' +%Y-%m-%d)" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY")

if [ -z "$FLEET_JSON" ] || [ "$FLEET_JSON" = "[]" ]; then
  echo "⚠️  Nenhum device ativo retornado — confira as credenciais antes de concluir 'frota vazia'."
  exit 1
fi

# Uma linha por (user_id, platform), mantendo o device mais recente: um usuário com 3 aparelhos
# antigos não pode pesar como 3 votos contra o DROP.
echo "$FLEET_JSON" | node -e '
const rows = JSON.parse(require("fs").readFileSync(0, "utf8"))
const latest = new Map()
for (const r of rows) {
  if (!r.app_version) continue
  const key = `${r.user_id}|${r.platform}`
  const prev = latest.get(key)
  if (!prev || new Date(r.updated_at) > new Date(prev.updated_at)) latest.set(key, r)
}
const installs = [...latest.values()]
const byVersion = new Map()
for (const r of installs) {
  const e = byVersion.get(r.app_version) || { installs: 0, users: new Set() }
  e.installs++; e.users.add(r.user_id)
  byVersion.set(r.app_version, e)
}
const cmp = (a, b) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i]||0) !== (pb[i]||0)) return (pb[i]||0) - (pa[i]||0)
  return 0
}
const versions = [...byVersion.keys()].sort(cmp)
const total = installs.length
console.log("")
console.log("  versão      instalações   usuários   % da frota")
console.log("  ─────────────────────────────────────────────────")
for (const v of versions) {
  const e = byVersion.get(v)
  const pct = ((e.installs / total) * 100).toFixed(1)
  console.log(`  ${v.padEnd(11)} ${String(e.installs).padStart(6)}      ${String(e.users.size).padStart(6)}   ${pct.padStart(7)}%`)
}
console.log("  ─────────────────────────────────────────────────")
console.log(`  TOTAL       ${String(total).padStart(6)}      ${String(new Set(installs.map(r => r.user_id)).size).padStart(6)}`)
console.log("")
console.log(`  Versão mais antiga ativa: ${versions[versions.length - 1]}`)
console.log(`  Piso de 5% (ADR-088): ${(total * 0.05).toFixed(1)} instalações`)
require("fs").writeFileSync(process.env.FLEET_TMP, JSON.stringify(versions))
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
