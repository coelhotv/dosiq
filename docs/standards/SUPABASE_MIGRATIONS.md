---
title: "Migrações Supabase — template e regras obrigatórias"
description: "Template SQL obrigatório, grants, regras de DDL destrutiva e procedimento de aplicação de migrações no Supabase."
version: "1.0.0"
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
updated_at: "2026-10-21"
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

## Grants obrigatórios

⚠️ **Corrigido 2026-10-21 (verificado em `pg_default_acl`):** em prod as default privileges do schema
`public` (donos `postgres` e `supabase_admin`) dão **ALL — inclusive TRUNCATE — a `anon`, `authenticated`
e `service_role`** em toda tabela/função nova. O texto anterior ("novas tabelas não recebem grants
automáticos") estava errado. Consequência: toda tabela nova precisa de **REVOKE explícito** do que não
deve existir (TRUNCATE ignora RLS) + GRANT do mínimo. Endurecer o default é dívida aberta.

Template obrigatório após `CREATE TABLE`:

```sql
REVOKE ALL ON public.<tabela> FROM anon, authenticated;  -- default ACL deu ALL (inclui TRUNCATE)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO service_role;
-- anon: apenas se a tabela tiver dados verdadeiramente públicos (raro no dosiq)
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;
```

Esquecer o grant = tabela invisível pro app com RLS ligada — falha silenciosa em prod
(classe AP-275: default privileges legados exigem REVOKE explícito ao mexer em objeto antigo).

## Funções SECURITY DEFINER — regras obrigatórias

- `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;` **antes** de qualquer `GRANT` explícito
  (default do Postgres é PUBLIC — AP-278/FR-019 do 046).
- `REVOKE EXECUTE ON FUNCTION ... FROM anon;` sempre — não autenticado não chama RPC privilegiada.
- `SET search_path = ''` no cabeçalho (previne search path injection).
- Com `search_path = ''`, usar `public.<tabela>` (schema qualificado) no body.
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

**Era 1 — hoje até a spec 051 (EAS Update) ser entregue E adotada: nenhum DROP, sem exceção.** Não
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
6. Varredura de DEFINER aberta (AP-278, emenda 098) — em TODA migração, não só na que cria função:
   `SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef AND (p.proacl IS NULL OR array_to_string(p.proacl, ',') ~ '(^|,)(=|anon=)X');`
   → 0 linhas, ou cada uma justificada no PR. Política RLS se audita por `roles`/`qual`, nunca pelo nome.
