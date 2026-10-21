#!/usr/bin/env bash
# qa-copy-smoke-accounts.sh — copia CONTAS DE SMOKE (dados inventados) de prod para o dosiq-qa.
# Contrato: CON-044 §3 — NUNCA incluir conta de titular real (inclusive a do PO).
#
# Uso (PO roda; URIs com senha não vão para o agente):
#   scripts/qa-copy-smoke-accounts.sh "<URI_SESSION_POOLER_PROD>" "<URI_SESSION_POOLER_QA>" email1 [email2 ...]
#
# Copia auth (users + identities) e o domínio clínico. NÃO copia: devices/push tokens, outbox/logs de
# notificação, bot_sessions, prune_*, feedbacks — e zera telegram_chat_id (QA não fala com o bot).
# Idempotente por conta: apaga a conta no QA antes de recopiar (cascade das FKs).
set -euo pipefail

PROD_URI="${1:?URI prod}"; QA_URI="${2:?URI QA}"; shift 2
[[ $# -ge 1 ]] || { echo "informe ao menos 1 e-mail de smoke" >&2; exit 1; }
BIN="${PG_BIN:-/opt/homebrew/opt/libpq/bin}"
OUT="${QA_OUT_DIR:-$HOME/local/dosiq-qa}/smoke-data"
mkdir -p "$OUT"; umask 077; rm -f "$OUT"/*.csv


EMAILS=$(printf "'%s'," "$@"); EMAILS="${EMAILS%,}"
IDS_SQL="select id from auth.users where email in ($EMAILS)"

# CON-044 §3: conta de titular real nunca vai ao QA. A conta real do PO é barrada pelo id (sem e-mail no repo).
REAL_ACCOUNT_ID_PREFIXES=("b0c9746c")
ids=$("$BIN/psql" "$PROD_URI" -v ON_ERROR_STOP=1 -Atq -c "$IDS_SQL")
for p in "${REAL_ACCOUNT_ID_PREFIXES[@]}"; do
  if grep -q "^$p" <<<"$ids"; then echo "conta real (id $p…) — proibido (CON-044 §3)" >&2; exit 1; fi
done

# ordem respeita FKs (o load roda em session_replication_role=replica — ciclos medicine_logs↔dose_instances)
TABLES=(medicines treatment_plans protocols titrations titration_steps purchases stock medicine_logs
        dose_instances stock_consumptions stock_adjustments biomarkers_log dose_adherence_monthly
        dose_critical_events consent_log)

# Colunas GERADAS (ex.: auth.users.confirmed_at) não entram em COPY — exporta só as graváveis.
cols_of() {
  "$BIN/psql" "$PROD_URI" -v ON_ERROR_STOP=1 -Atq -c "select string_agg(quote_ident(column_name), ',' order by ordinal_position)
    from information_schema.columns where table_schema = '$1' and table_name = '$2' and is_generated = 'NEVER'"
}
# ex <schema> <tabela> <coluna-do-user> <arquivo>
ex() {
  local cols; cols=$(cols_of "$1" "$2")
  "$BIN/psql" "$PROD_URI" -v ON_ERROR_STOP=1 -q \
    -c "\\copy (select $cols from $1.$2 where $3 in ($IDS_SQL)) to '$OUT/$4.csv' with (format csv, header)"
}

ex auth users id auth_users
ex auth identities user_id auth_identities
ex public user_settings user_id user_settings
for t in "${TABLES[@]}"; do ex public "$t" user_id "$t"; done
echo "exportado: $(wc -l "$OUT"/*.csv | tail -1)"

{
  echo "begin;"
  echo "set session_replication_role = replica;"
  echo "delete from auth.users where email in ($EMAILS);"
  # colunas pelo header do CSV: tolera coluna nova só de um lado (ex.: versão de GoTrue diferente)
  for f in auth_users:auth.users auth_identities:auth.identities user_settings:public.user_settings \
           $(for t in "${TABLES[@]}"; do printf "%s:public.%s " "$t" "$t"; done); do
    file="${f%%:*}"; table="${f#*:}"
    cols=$(head -1 "$OUT/$file.csv")
    echo "\\copy $table ($cols) from '$OUT/$file.csv' with (format csv, header)"
  done
  echo "update public.user_settings set telegram_chat_id = null where user_id in ($IDS_SQL);"
  echo "select setval(pg_get_serial_sequence('public.consent_log','seq'), coalesce((select max(seq) from public.consent_log), 1));"
  echo "set session_replication_role = origin;"
  echo "commit;"
} > "$OUT/load.sql"

"$BIN/psql" "$QA_URI" -v ON_ERROR_STOP=1 -q -f "$OUT/load.sql"
echo "copiado para o QA: $*"
