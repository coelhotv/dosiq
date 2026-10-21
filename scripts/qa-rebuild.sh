#!/usr/bin/env bash
# qa-rebuild.sh — gera os scripts que montam o projeto Supabase dosiq-qa a partir do schema de prod.
# Contrato: CON-044 · Doc: docs/architecture/QA_ENVIRONMENT.md
#
# Uso (o PO roda; as URIs têm senha e nunca vão para o chat/agente):
#   scripts/qa-rebuild.sh "<URI_SESSION_POOLER_PROD>"            # só gera os arquivos
#   scripts/qa-rebuild.sh "<URI_PROD>" "<URI_SESSION_POOLER_QA>"  # gera e aplica no QA
#
# Saída em ~/local/dosiq-qa/ (FORA do repo e de plans/ — o 01 tem segredos só do QA).
# Pré-requisito: QA vazio (projeto recém-criado). Sem dados: --schema-only.
set -euo pipefail

PROD_URI="${1:?URI do session pooler de PROD}"
QA_URI="${2:-}"
BIN="${PG_BIN:-/opt/homebrew/opt/libpq/bin}"
OUT="${QA_OUT_DIR:-$HOME/local/dosiq-qa}"
PROD_REF="kwqjtdsqkkbebfiaxubb"
QA_REF="ikcvwxyohmntncanclze"

mkdir -p "$OUT"
umask 077

"$BIN/pg_dump" "$PROD_URI" --schema-only --schema=public --schema=private --schema=access_hook \
  --no-owner -f "$OUT/prod-schema.sql"

# Hook de acesso (CON-042) tem o host de prod no corpo — no QA ele gravaria log em PROD.
if ! grep -q "db\.$PROD_REF\.supabase\.co" "$OUT/prod-schema.sql"; then
  echo "AVISO: host de prod não encontrado no dump — conferir access_hook.capture_access à mão" >&2
fi

P_WRITER=$(openssl rand -hex 24)
P_PEPPER=$(openssl rand -hex 32)

cat > "$OUT/01-bootstrap.sql" <<EOF
-- dosiq-qa bootstrap (antes do schema). Segredos aleatórios, SÓ do QA — nunca os de prod.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists dblink with schema extensions;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'access_log_writer') then
    create role access_log_writer login password '$P_WRITER';
  end if;
end \$\$;
select vault.create_secret('$P_WRITER', 'ACCESS_LOG_WRITER_DSN_PASSWORD');
select vault.create_secret('$P_PEPPER', 'CONSENT_HASH_PEPPER');
EOF

sed -e '/^\\restrict/d' -e '/^\\unrestrict/d' -e '/^CREATE SCHEMA public;/d' \
    -e '/DEFAULT PRIVILEGES FOR ROLE supabase_admin/d' \
    -e "s/db\.$PROD_REF\.supabase\.co/db.$QA_REF.supabase.co/g" \
    "$OUT/prod-schema.sql" > "$OUT/02-schema.sql"

cat > "$OUT/03-post.sql" <<'EOF'
-- dosiq-qa pós-schema: o que vive fora de public/private/access_hook. pg_cron: NENHUM job.
create trigger on_auth_user_created_settings after insert on auth.users
  for each row execute function public.handle_new_user_settings();
alter role authenticator set pgrst.db_pre_request = 'access_hook.capture_access';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
EOF

# Default ACL do Supabase dá ALL a anon/authenticated/service_role em todo objeto criado; o pg_dump
# só emite ACL relativa ao acldefault. Sem este passo o QA fica MAIS aberto que prod e esconde 42501.
{
  cat <<'EOF'
-- dosiq-qa 04: alinha ACLs com prod (acldefault → reaplica GRANT/REVOKE do dump).
begin;
do $$ declare r record; begin
  for r in select c.oid::regclass::text o from pg_class c
           where c.relnamespace in ('public'::regnamespace, 'private'::regnamespace)
             and c.relkind in ('r','v','m','p','S') loop
    execute format('revoke all on %s from public, anon, authenticated, service_role', r.o);
  end loop;
  for r in select p.oid::regprocedure::text o, p.prokind k from pg_proc p
           where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace, 'access_hook'::regnamespace) loop
    execute format('revoke all on %s %s from public, anon, authenticated, service_role',
                   case r.k when 'p' then 'procedure' else 'function' end, r.o);
    execute format('grant execute on %s %s to public',
                   case r.k when 'p' then 'procedure' else 'function' end, r.o);
  end loop;
end $$;
EOF
  grep -E '^(GRANT|REVOKE) .* ON (TABLE|SEQUENCE|FUNCTION|PROCEDURE) ' "$OUT/02-schema.sql"
  echo 'commit;'
} > "$OUT/04-acl-sync.sql"

echo "Gerado em $OUT: 01-bootstrap 02-schema 03-post 04-acl-sync"

if [[ -n "$QA_URI" ]]; then
  for f in 01-bootstrap.sql 02-schema.sql 03-post.sql 04-acl-sync.sql; do
    echo "→ $f"
    "$BIN/psql" "$QA_URI" -v ON_ERROR_STOP=1 -q -f "$OUT/$f"
  done
  echo "Aplicado. Próximo: semente de config + paridade (QA_ENVIRONMENT.md §3)."
fi
