# Migrações escritas e AINDA NÃO aplicadas

> Uma linha por migração que existe no repo mas **não** está em produção, com o gatilho que libera
> a aplicação. Migração aplicada sai desta lista. **Lista vazia = nenhuma pendência** — se você
> chegou aqui por um backlog, começe por aqui.

| migração | parte | desde | gatilho para aplicar | gate |
|---|---|---|---|---|
| `20260820_consent_seq_and_controller_event.sql` | **inteira** (coluna `consent_log.seq` + `GRANT SELECT (seq)` a `service_role` + `consent_write` reordenada + RPC nova `consent_controller_event`) | 2026-08-20<br>(046 Slice C) | Aprovação do PO — é **aditiva e não destrutiva** (nenhum cliente publicado lê `seq`; `consent_write` mantém assinatura e comportamento). Aplicar ANTES de o deploy do job ir a prod: sem a coluna, a reconferência da trilha erra e o job pula todo candidato. | `PO-5` / `PO-SEC-3` da spec 046 |
| `20260818_skip_dose_atomic_and_status_privilege.sql` | **§3 apenas** (`REVOKE UPDATE (status) ON dose_instances FROM authenticated` + os 16 `GRANT UPDATE` por coluna). §1 e §2 (as duas RPCs) **já aplicadas**. | 2026-08-18<br>(PR #797, `65931d11`) | Adoção da `APP_VERSION 0.31.1` nas lojas acima do limiar (a definir com o PO no check), **com** a web nova já em produção | `PO-SEC-2` da spec 067 |

## Por que a §3 está segurada (spec 067 Slice B, Decisões 15/16 do PO)

O `REVOKE` tira de `authenticated` a escrita de `dose_instances.status`. As RPCs que substituem essa
escrita (`skip_dose_atomic`, `set_protocol_dose_state_atomic`) já existem no banco, mas **só o código
novo as usa**. Aplicar o REVOKE antes da base atualizar faz pausar/retomar tratamento e pular dose
falharem com `42501` em todo cliente já publicado — e o binário das lojas não atualiza na hora.
**Não se penaliza quem ainda não atualizou, nem com erro legível:** a paciente não teria como
resolver. Lança-se a versão, incentiva-se o update, e só então o privilégio é revogado.

**Custo declarado enquanto pendente:** a guarda de janela é usada por todo o código, mas continua
sendo **convenção, não privilégio** — escrita direta de `status` fora da RPC segue possível.
`ADR-092` só está cumprido quando a §3 for aplicada.

## Como aplicar

1. Conferir o gatilho: web nova em prod · `APP_VERSION >= 0.31.1` nas 2 lojas · adoção acima do
   limiar · `rtk grep -rn "from('dose_instances')" apps packages server api | grep -i update` sem
   nenhuma escrita de `status`.
2. Aplicar a §3 da migração (MCP `apply_migration`).
3. Fechar `PO-SEC-2`: `PATCH /dose_instances?id=eq.<dose própria>` com `{"status":"skipped_user"}`
   e token real ⇒ **42501**; guard: `PATCH` de `la_push_token` na mesma dose ⇒ **200**.
4. Smoke: pausar/retomar tratamento na web **e** no mobile; pular dose no app **e** no Telegram.
5. Atualizar: esta lista (remover a linha), `ADR-092` (marcar cumprido) e a linha do 067 em
   `plans/specs/README.md` (local-only).

**Rollback:** `GRANT UPDATE ON public.dose_instances TO authenticated;`

## Por que a `20260820_consent_seq_and_controller_event.sql` ainda não foi aplicada

Só falta a aprovação do PO — não há gatilho de frota aqui. A migração é **aditiva**: adiciona uma
coluna `IDENTITY`, um índice, um `GRANT` de coluna e uma função nova; a única função REESCRITA
(`consent_write`) mantém assinatura e comportamento, trocando `ORDER BY created_at DESC` por
`ORDER BY seq DESC` (desempate — T013e). Nenhum cliente publicado lê `seq`.

**Custo declarado enquanto pendente:** o job `runConsentPrune` já está no ciclo diário, mas em
`dry_run` (default) — não apaga nada. Sem a coluna, `confirmStillRevoked` recebe erro do PostgREST
e trata todo candidato como "não sei" ⇒ **pula**. Isso é o failure mode correto, e hoje é inócuo:
verificado em prod em 2026-08-20, não existe **nenhum** titular com o último evento igual a
`revoked` — o job não tem sequer um candidato para varrer.

## Como aplicar

1. `apply_migration` com o conteúdo de `docs/migrations/20260820_consent_seq_and_controller_event.sql`.
2. Rodar `docs/migrations/20260820_consent_seq_and_controller_event.test.sql` bloco a bloco e colar
   o output (guarda de chamador, hash derivado no banco, grants).
3. Regerar `packages/shared-data/src/database.types.ts` (R-289) — a RPC nova entra no tipo.
4. `PO-5` e `PO-SEC-3` **continuam abertos**: eles só fecham no modo ARMADO
   (`CONSENT_PRUNE_MODE=armed`), depois de um dry-run limpo em produção.

**Rollback:** `DROP FUNCTION public.consent_controller_event(uuid, text, text);` e reverter
`consent_write` para `ORDER BY created_at DESC`. A coluna `seq` pode ficar (é inerte se nada a lê).
