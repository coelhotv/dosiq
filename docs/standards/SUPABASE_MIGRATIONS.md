---
title: "Migrações Supabase — template e regras obrigatórias"
description: "Template SQL obrigatório, grants, regras de DDL destrutiva e procedimento de aplicação de migrações no Supabase."
version: "2.0.0"
status: active
category: standard
audience:
  - dev
  - agent
tags:
  - supabase
  - migrations
  - sql
  - database
created_at: "2026-07-18"
updated_at: "2026-10-31"
---

> 🔴 **Migração escrita ≠ migração aplicada.** Quando uma migração (ou uma PARTE dela) fica no repo
> sem ser aplicada — rollout escalonado, espera de adoção de app, janela de manutenção — ela **DEVE**
> ganhar uma linha em [`docs/migrations/PENDING.md`](../migrations/PENDING.md) com o gatilho que
> libera a aplicação e o PO/gate que a fecha. Sem isso a pendência vira dívida invisível: o código
> assume um privilégio que o banco ainda concede, e ninguém lembra de fechar o ciclo.

# Migrações Supabase — template e regras obrigatórias

> Extraído do CLAUDE.md em 2026-07-18 (redução do arquivo). Fonte de verdade para
> qualquer `CREATE TABLE` / função nova. **Toda migração passa pelo QA (`dosiq-qa`) antes de prod**
> (CON-044 · [`QA_ENVIRONMENT.md`](../architecture/QA_ENVIRONMENT.md) §4). Aplicação em prod: via MCP, após aprovação.

## Grants obrigatórios — objeto novo nasce FECHADO (spec 108 · ADR-119)

**A partir de 2026-10-31 (migração `20261031_108_public_least_privilege.sql`)**, toda tabela, view,
sequência ou função criada pelo `postgres` no `public` nasce **sem grant nenhum** a `anon`,
`authenticated` ou `PUBLIC`. Sem `GRANT` explícito, o app recebe `42501` — no QA, alto e na hora.
Isso é proposital (falha fechada e barulhenta, ADR-119); a regra é **conceder o mínimo**, não lembrar
de revogar. `REVOKE … FROM PUBLIC/anon` em objeto novo vira opcional (não há o que revogar).

> Histórico: até a 108 o default ACL dava ALL (inclui TRUNCATE) a `anon`/`authenticated` e EXECUTE a
> `PUBLIC`; migrações de 2026-07 a 2026-10 trazem `REVOKE ALL … FROM anon, authenticated` por isso.
> Não as edite — são registro do que foi aplicado. Objetos criados pelo painel (`supabase_admin`) ainda
> nascem abertos: a varredura `docs/migrations/20261031_108_residual_scan.sql` acusa.

Templates (no MESMO arquivo do `CREATE` — o checador `lint:migration-grants` barra a falta):

```sql
-- Tabela
CREATE TABLE public.<tabela> (...);
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<tabela> TO authenticated;  -- só o que o app usa
GRANT ALL ON TABLE public.<tabela> TO service_role;
-- ou, se só o servidor toca:   -- grants: nenhum (só service_role)

-- View (sempre security_invoker; só leitura)
CREATE VIEW public.<view> WITH (security_invoker = on) AS ...;
GRANT SELECT ON public.<view> TO authenticated;

-- Sequência (só se authenticated insere direto numa tabela com serial/identity)
GRANT USAGE ON SEQUENCE public.<seq> TO authenticated;

-- Função / RPC
CREATE FUNCTION public.<fn>(...) ... SET search_path = '' ...;
GRANT EXECUTE ON FUNCTION public.<fn>(<tipos>) TO authenticated;   -- e/ou service_role
```

**`anon` só recebe o que está na allowlist do checador** (`scripts/migration-grants-gate.mjs`,
`ANON_ALLOWLIST`): `app_version_gate` (por coluna — gate de versão antes do login), `consent_policy` e
`access_hook.capture_access()` (pre-request do PostgREST). Fora disso, grant a `anon` falha o lint.

### DROP + CREATE apaga os grants

Mudança de assinatura (`DROP FUNCTION` + `CREATE FUNCTION`) nasce com o padrão novo — **sem** os
grants da versão anterior. Reemita todos no mesmo arquivo. `CREATE OR REPLACE` (mesma assinatura)
preserva a ACL; se for o caso, declare com o marcador `-- migration-grants: ok — <motivo>`.
🔴 `access_hook.capture_access()` recriada sem `GRANT EXECUTE … TO anon, authenticated` derruba
**toda** requisição (`permission denied for function capture_access` — provado no QA, spec 108 PO-9).

### Grant por coluna some com REVOKE de tabela

`REVOKE … ON TABLE` também revoga os grants **de coluna** (`app_version_gate`, `consent_log`), e
`has_table_privilege`/`relacl` não os mostram. Toda migração que revoga privilégio de tabela reemite
os de coluna depois e confere com `has_column_privilege`.

### Bloco padrão no `.test.sql` (FR-014 da 108 — copiar em toda migração)

```sql
DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'access_hook.capture_access()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'access_hook.capture_access()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FR-014: capture_access sem EXECUTE para anon/authenticated'; END IF;
  IF NOT has_column_privilege('anon', 'public.app_version_gate', 'min_supported_version', 'SELECT') THEN
    RAISE EXCEPTION 'FR-014: anon não lê app_version_gate'; END IF;
END $$;
```

### Checador `lint:migration-grants` (encadeado no `npm run lint`)

`.sql` de `docs/migrations/` com data ≥ 20261031 (fora `*.test.sql` e `*_acl_restore_*`). Falha em:
(a) `CREATE FUNCTION` sem `GRANT EXECUTE` da mesma; (b) `DROP`+`CREATE` sem re-GRANT; (c)
`capture_access` tocada sem `anon, authenticated`; (d) `CREATE TABLE/VIEW` em `public` sem GRANT nem
`-- grants: nenhum (só service_role)`; (e) grant a `anon` fora da allowlist. (a)/(b)/(d) aceitam o
marcador `-- migration-grants: ok — <motivo>`; (c)/(e) não.

## Funções SECURITY DEFINER — regras obrigatórias

- `SET search_path = ''` no cabeçalho (previne search path injection).
- Com `search_path = ''`, usar `public.<tabela>` (schema qualificado) no body.
- **Concedeu o mínimo?** `GRANT EXECUTE` só aos papéis que chamam (RPC do app → `authenticated`;
  job → `service_role`; chamada só por outra DEFINER → nenhum grant). Nunca `anon` (exceto o hook).
- Guarda interna de chamador quando a função é service-only: `auth.role()`, nunca `current_user`
  (dentro de DEFINER, `current_user` é sempre o OWNER — guarda inerte, AP-292).

## 🔴 DDL destrutiva: o gate da FROTA (ADR-088)

Vale para `DROP COLUMN`, `DROP TABLE`, `RENAME`, aperto de tipo e aperto de CHECK/NOT NULL.

**`git grep` no `HEAD` responde "quem VAI usar". A pergunta que derruba produção é "quem ESTÁ
usando".** O código que quebra num DROP não está no repositório — está compilado dentro do aparelho
do usuário, numa versão que você não controla e que não atualiza quando você quer. Foi assim que o
029 F6 quebrou 21 das 25 instalações ativas com um gate que, corretamente, provou zero leitores no
repositório (AP-314).

```bash
./scripts/fleet-versions.sh <coluna>   # exit 1 = DROP bloqueado
```

O script cruza a distribuição de versões instaladas (`notification_devices`) com o histórico do git,
versão a versão, e mostra a linha do `.select()` como evidência.

**Era 1 — hoje até a spec 051 (EAS Update) ser entregue E adotada: nenhum DROP.** Única exceção (emenda ao ADR-088, spec 108): tabela que **nenhum commit do cliente jamais referenciou** (`git log --all -S <tabela> -- apps/mobile` vazio) — prova mais forte que o veredito por versão. Não
existe mecanismo para alcançar a frota atual: nem OTA (só chega em binário que já embute
`expo-updates`), nem update forçado. A única saída é **expand/contract**:

- **Fase A** — o código para de ler/escrever; a coluna fica inerte com `DEFAULT` que **reproduza o
  valor que o cliente antigo lê hoje** (medir em produção antes, não supor).
- **Fase B** — o DROP, numa release futura, quando o gate liberar.

Épico que "fecha" com deprecação **não fecha**: fica com a Fase B agendada pela telemetria, não pela
vontade de fechar o épico. Essa pressão de fechamento foi ingrediente causal do 029 F6.

> ⚠️ `notification_devices` só enxerga quem ativou notificações — o número é **piso, não retrato**.
> E `git revert` não desfaz DDL: rollback recria estrutura, nunca conteúdo.

## Checklist de saída

0. **DDL destrutiva?** → `./scripts/fleet-versions.sh <coluna>` verde (ADR-088). Vermelho = Fase A.
1. `pg_get_constraintdef` / `information_schema` conferidos (R-295 — o banco é a verdade).
2. Grants + RLS no mesmo arquivo da tabela (nunca "depois").
3. Assinatura única por função (overload = AP-227; `DROP FUNCTION` da antiga na mesma migração).
4. Teste `BEGIN..ROLLBACK` **no QA** antes de aplicar (padrão PO-SEC); depois `apply_migration` no QA + curl R-295 no QA. Prod só no gatilho da spec (CON-044).
5. `npm run supabase:types` após aplicar (regen `database.types.ts` — R-289).
6. **Concedeu o mínimo?** `npm run lint:migration-grants` verde; bloco FR-014 no `.test.sql`; e a
   varredura `docs/migrations/20261031_108_residual_scan.sql` com 0 linhas no QA (e em prod após aplicar).
   Linha nova legítima = atualize a matriz/listas da varredura no mesmo PR. Política RLS se audita por
   `roles`/`qual`, nunca pelo nome.
