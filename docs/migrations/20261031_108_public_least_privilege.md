# Migração 20261031_108 — privilégio mínimo no `public` + tabelas mortas da 099

> Spec 108 (`plans/specs/108-public-default-privileges/`, local-only, não versionado) · ADR-119 ·
> Tier 2 · CON-044 (QA antes de prod).

## O que faz

| Passo | Efeito |
|---|---|
| 0 | Pré-checks: as 4 tabelas com 0 linhas (INV-2); todo objeto do `public` com dono `postgres` (FM-11); snapshot do UPDATE de `authenticated` em `dose_instances` |
| 1 | `DROP` de `batch_update_review_status`, `push_notification_logs`, `push_subscriptions`, `dose_adherence_monthly`, `gemini_reviews` e da função de gatilho `update_push_subscriptions_updated_at` (sem `CASCADE`) |
| 2 | `_delete_user_account_core` sem os 3 DELETEs das tabelas apagadas (base = definição de prod) |
| 3 | Padrões A′: `IN SCHEMA public REVOKE ALL` de `anon`/`authenticated`; `REVOKE EXECUTE … FROM PUBLIC` **global**; `GRANT EXECUTE … TO PUBLIC` só `IN SCHEMA extensions` |
| 4 | `anon` perde tudo no `public`; `PUBLIC` perde EXECUTE; `authenticated` perde TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, tudo em `stock_adjustments`, `stock_consumptions`, `v_dose_critical_*` e sequências, e escrita nas views |
| 5-6 | Reemite grants de coluna (`app_version_gate`, `consent_log`) e `consent_policy` a `anon` |
| 7 | Pós-checks (RAISE): nada cita objeto apagado; anon/PUBLIC zerados fora da allowlist; INV-5, INV-6, INV-7; padrões do `public` fechados |

Matriz e decisões do PO: [`20261031_108_matrix.md`](20261031_108_matrix.md). Não muda UPDATE de
`dose_instances` — o §3 da 067 continua segurado ([`PENDING.md`](PENDING.md)).

## Frota (exceção ao ADR-088, FR-007a / PO-12)

`git log --all --oneline -S <tabela> -- apps/mobile` → **vazio** para as 4 tabelas (2026-10-31).
`./scripts/fleet-versions.sh <tabela>` (saídas em [`108_evidence/`](108_evidence/)): 0.34.0, 0.33.3,
0.30.1, 0.30.0 ✅ limpas; 0.33.48 e 0.33.29 ❓ "commit não localizado" — resolvidas pela prova de
histórico: nenhum commit do cliente, em nenhuma branch, jamais citou essas tabelas.
`stock_consumptions` (revogada de `authenticated`, não apagada): mesma saída do script; o commit que
tirou o uso do core (`1ad1fcff`, spec 035, 2026-06-19) é ancestral de `mobile-v0.30.0`, a versão de
loja mais antiga da frota.

## Prova (QA `ikcvwxyohmntncanclze`, 2026-10-31)

| Prova | Resultado |
|---|---|
| Corpo da migração + pós-checks, desfeito por RAISE | `MIGRATION_ONLY_OK` |
| Aplicação real (`apply_migration`) | `success` |
| `.test.sql` (FR-014, PO-SEC-3, PO-10, PO-SEC-1, PO-2 SQL, PO-5) | `RESULT 6/6` |
| R-295 por PostgREST — `node scripts/qa/108-privilege-probe.mjs` | `RESULT 40/40` (anon `401 42501` em toda tabela de saúde; `authenticated` 200 na matriz e `403 42501` fora dela; `select=*` em `app_version_gate`/`consent_log` negado, select do código 200) |
| PO-9 — `capture_access` recriada sem GRANT no QA | `{"code":"42501","message":"permission denied for function capture_access"}` HTTP 401 em `app_version_gate` como anon; ACL nasceu `{postgres=X/postgres}` (A′ funcionando); `GRANT` restaurado → HTTP 200; o checador acusa o SQL (regra c) |
| PO-6 — `20261031_108_residual_scan.sql` | 0 linhas |

## Prod (`kwqjtdsqkkbebfiaxubb`, aplicada 2026-11-01 após merge do #925 `f8bc4db6`)

| Prova | Resultado |
|---|---|
| Varredura ANTES | acusou o excesso (anon com tudo em 22 relações, 9 funções com EXECUTE a PUBLIC/anon, 24 padrões abertos, 3 sequências…) — varredura não é vazia |
| ACL antes = snapshot | md5 `4359a4b141d768b81a917e2c57fbc1df` (igual ao de 2026-10-31); 4 tabelas mortas com 0 linhas |
| `apply_migration` | `success` — todos os pós-checks (INV-5/6/7, SC-001/002, EXECUTE de authenticated/service_role preservado) passaram |
| Curl anon pós | `app_version_gate` (select do app) **200** · `consent_policy` **200** · `medicines` **401** |
| Varredura DEPOIS | **0 linhas** |
| Logs Postgres (24 h) | 1 `permission denied for table medicines` = o curl de teste acima; 0 `does not exist` |

`.test.sql` **não** roda em prod: insere usuário e dados fictícios (mesmo desfeitos) — manipulação de dados só no QA. Em prod a prova é só leitura (pós-checks + varredura + curl).
**PO-7 aberta:** 48 h de Sentry e logs (até 2026-11-03). Rollback de privilégio: `20261031_108_acl_restore_prod.sql`.
