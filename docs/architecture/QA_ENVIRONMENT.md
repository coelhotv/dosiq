---
title: "Ambiente de QA (dosiq-qa)"
description: "Projeto Supabase de QA espelhando o schema de produção: para que serve, como montar, como manter paridade e o fluxo QA → prod de migrações."
version: "1.0.0"
status: active
category: architecture
audience:
  - dev
  - agent
tags:
  - supabase
  - qa
  - migrations
  - database
created_at: "2026-10-21"
updated_at: "2026-10-21"
---

# 🧪 Ambiente de QA (`dosiq-qa`)

> Contrato: **CON-044** (`.agent/memory/contracts/infra_and_deploy/CON-044.md`). Este doc é o "como"; o contrato é o "deve".

## 1. O que é

| | Produção | QA |
|---|---|---|
| Projeto Supabase | `dosiq` · `kwqjtdsqkkbebfiaxubb` | `dosiq-qa` · `ikcvwxyohmntncanclze` |
| Região | sa-east-1 (São Paulo) | us-west-2 (Oregon) — plano free não deu SP |
| Postgres | 17.11 | 17.11 (conferir a cada rebuild) |
| Dados | reais | **sintéticos** + config copiada (sem titular real) |
| `pg_cron` | 4 jobs de limpeza | **nenhum job** |
| Integrações (Telegram, Brevo, APNs, Groq, PostHog, Sentry) | ligadas | **desligadas** (env vazia) |
| Confirmação de e-mail no signup (Auth) | ligada | **desligada** (QA não envia e-mail) — fluxo `unconfirmed_signup` (spec 107) não se testa no QA |

Por que existe: branching do Supabase exige plano pago. O plano free permite 2 projetos; o segundo é o QA.
Ele é onde toda migração roda primeiro, onde o teste `BEGIN..ROLLBACK` acontece, e o banco do smoke web.

## 2. Montar do zero (rebuild)

Projeto novo e vazio, criado com **Data API ✅ · Automatically expose new tables ✅ · Automatic RLS ⬜**
(espelha prod: prod expõe tabelas novas via default ACL e não tem event trigger de RLS automática —
RLS automática no QA esconderia a migração que esquece `ENABLE ROW LEVEL SECURITY`).

```bash
# PO roda (as URIs têm senha — nunca vão para o agente). Session pooler, não Direct (IPv6).
scripts/qa-rebuild.sh "<URI_SESSION_POOLER_PROD>" "<URI_SESSION_POOLER_QA>"
```

O script (saída em `~/local/dosiq-qa/`, fora do repo — o bootstrap tem segredos):

| Arquivo | Faz |
|---|---|
| `01-bootstrap.sql` | extensões (`pgcrypto`, `uuid-ossp`, `dblink`, `pg_cron`, `supabase_vault`), role `access_log_writer`, segredos do Vault **gerados novos** |
| `02-schema.sql` | `pg_dump --schema-only` de `public`, `private`, `access_hook`; tira `\restrict`, `CREATE SCHEMA public`, defaults de `supabase_admin`; **troca o host de prod no `access_hook.capture_access`** |
| `03-post.sql` | trigger de signup em `auth.users`, `pgrst.db_pre_request` (CON-042), reload do PostgREST |
| `04-acl-sync.sql` | volta ACLs ao `acldefault` e reaplica os GRANT/REVOKE do dump |

Leva ~5 min (Oregon: ~1.500 instruções, cada uma com ida e volta).

### Armadilhas conhecidas
- **Default ACL abre tudo.** Toda tabela/função criada no `public` ganha ALL para anon/authenticated/service_role.
  O `pg_dump` emite só os GRANTs de prod, não revoga o que o default deu ⇒ sem o `04` o QA fica **mais
  aberto** que prod e um `42501` que prod daria passa no QA.
- **Host de prod hardcoded** no hook de acesso: sem a troca, toda request no QA grava `access_log` em prod.
- Triggers em `auth.users` não saem no dump por schema — o `03` recria.

## 3. Depois do rebuild (agente, via MCP)

1. **Semente de config** (sem titular): `consent_policy`, `consent_copy`, `app_version_gate` copiados de prod
   (`updated_by` → NULL).
2. **Paridade** — mesmos valores nos dois projetos:
   ```sql
   select
     (select md5(string_agg(c.oid::regclass::text||coalesce(c.relacl::text,'-'),'|' order by 1)) from pg_class c
       where c.relnamespace in ('public'::regnamespace,'private'::regnamespace) and c.relkind in ('r','v','m','p')) tbl_acl,
     (select md5(string_agg(p.oid::regprocedure::text||':'||has_function_privilege('anon',p.oid,'execute')
        ||has_function_privilege('authenticated',p.oid,'execute')||has_function_privilege('service_role',p.oid,'execute'),'|' order by 1))
       from pg_proc p where p.pronamespace in ('public'::regnamespace,'private'::regnamespace,'access_hook'::regnamespace)) fn_exec,
     (select md5(string_agg(pg_get_functiondef(p.oid),'' order by p.proname, p.oid::regprocedure::text))
       from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f') fn_body,
     (select count(*) from information_schema.columns where table_schema='public') cols,
     (select count(*) from pg_policies where schemaname in ('public','private')) pols;
   ```
3. Reaplicar no QA as migrações que estão no QA e ainda não em prod (`list_migrations` do QA).

## 4. Fluxo de migração QA → prod

```
escrever .sql + .test.sql
  → QA: migração + teste numa txn terminada em RAISE 'RESULT …' (desfaz)
  → QA: apply_migration (fica aplicada)
  → R-295 curl contra o QA
  → smoke web contra o QA
  → prod: só no gatilho da spec (Dia D / aprovação), mesmo arquivo, + curl R-295 em prod
```

Prod nunca vê uma migração que não passou pelo QA. Exceção só com pedido explícito do PO, declarada no PR.

## 5. Rodar o app contra o QA

- **Web:** `apps/web/.env.qa` (gitignored por `.env.*`) + `npm run dev --workspace @dosiq/web -- --mode qa`.
  O Vite carrega `.env.qa` **por cima** de `.env`/`.env.local` (prod): variável ausente no `.env.qa` vaza de
  prod — por isso as integrações estão declaradas vazias no arquivo.
- **Mobile:** ainda não ligado (dev build lê `EXPO_PUBLIC_*` de prod). Pendente.
- **Server/cron:** não roda contra o QA (sem `CRON_SECRET`, sem jobs).

## 6. Dados

QA não guarda dado de saúde de titular real (CON-044 §3). Contas de smoke são sintéticas
(`*@dosiq.test` ou contas de smoke do PO recriadas com dados inventados).

Contas de smoke do PO (dados inventados) vêm de prod com:

```bash
scripts/qa-copy-smoke-accounts.sh "<URI_PROD>" "<URI_QA>" doktorr@gmail.com eu@coelho.me
```

Copia `auth.users`/`identities` (mesma senha), `user_settings` (sem `telegram_chat_id`) e o domínio
clínico; não copia tokens de device, outbox, logs de notificação, bot, prune. Recusa a conta real do PO.
Relatório PDF/histórico com volume: semear as contas de smoke com dados fake, nunca copiar titular real.
