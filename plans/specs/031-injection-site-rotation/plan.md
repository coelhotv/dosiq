# Implementation Plan: 031 — Rotação de sítio de aplicação (injetáveis)

**Spec**: [spec.md](./spec.md) · **Tier**: 2 · **Created**: 2026-06-21 · **Goal type**: feature
**Ceremonies**: eng-review (RC3, 6 findings) — ver `## Ceremony: eng-review` na spec.

## Summary

Adicionar `injection_site` (enum corporal PT, 8 sítios, nullable) como metadado da tomada de
**injetáveis**, persistido em `medicine_logs`. Rotação **global por query** (sem filtro de
medicamento, `ORDER BY taken_at`). Captura inline no form, "último local global", alerta
não-bloqueante, exibição no histórico (web+mobile). Edição pós-log + hint de absorção = slice B.

## Technical Context (evidência real — file:line)

- **Escrita NÃO é INSERT direto** (RC3-F1): vai por RPC atômica
  `register_dose_atomic(p_user_id, p_protocol_id, p_medicine_id, p_taken_at, p_quantity_taken,
  p_notes, p_dose_instance_id, p_strict_anchor)` —
  [20260619_atomic_dose_logging.sql:32-40](docs/migrations/20260619_atomic_dose_logging.sql#L32-L40);
  `INSERT INTO public.medicine_logs (...)` em [:58-62](docs/migrations/20260619_atomic_dose_logging.sql#L58-L62).
- **Update** via `update_dose_log_atomic` — padrão `p_has_*` + `COALESCE`
  ([:151-156](docs/migrations/20260619_atomic_dose_logging.sql#L151-L156)). Para FR-011 (editar só
  o sítio) seguir o mesmo padrão: `p_injection_site` + `p_has_injection_site BOOLEAN`.
- **JS write-path**: [doseLogService.js:43-54](packages/core/src/services/doseLogService.js#L43-L54)
  monta os `p_*` — `callRegisterAtomic` precisa do novo param (senão silent drop, AP-214).
- **Zod**: [logSchema.js:12-58](packages/core/src/schemas/logSchema.js#L12-L58) — `logSchema`
  define os campos; `safeParse` corta desconhecido → `injection_site` PRECISA entrar no schema.
  `logUpdateSchema = logSchema.partial()` já cobre o update.
- **Detecção de injetável**: `medicine.type === 'injetavel'` (MEDICINE_TYPES, CLAUDE.md). Read-path
  do form — verificar coluna exata em C1.5 (UNVERIFIED: `type` vs `form`).
- **doseZones** (precedente do util, RC3-F4): [doseZones.js](packages/core/src/utils/doseZones.js)
  em `core/src/utils/` — `injectionSites` mora ao lado, MESMO padrão de import web↔mobile. NÃO é
  R-231 (factory de repos). CON-024/doseZones = zona de HORÁRIO, não corporal.

## Constitution Check

- SaMD: registro + lembrete educacional, **zero recomendação de sítio** (herda ADR-062/T026). Hint
  de absorção = texto educacional. "Sugerir próximo sítio" FORA de escopo. ✅
- Datas: ordenação por `taken_at` usa coluna no banco; sem `new Date('YYYY-MM-DD')`. ✅
- Migração: grants + RLS já existem em `medicine_logs` (coluna aditiva herda). ✅

## Architecture / Approach

```
ESCRITA (US1)                          LEITURA (US2 rotação / US5 histórico)
LogForm (injetável?) → injection_site   getLastInjectionSite():
  → logService/doseService (web/mobile)    SELECT injection_site FROM medicine_logs
  → doseLogService.registerDose            WHERE user_id=$1 AND injection_site IS NOT NULL
  → register_dose_atomic(... p_injection_site)   ORDER BY taken_at DESC NULLS LAST LIMIT 1
  → INSERT medicine_logs(injection_site)   (SEM filtro medicine_id/protocol_id = global)
```

### Plano de migração (aditiva, reversível)
1. `ALTER TABLE public.medicine_logs ADD COLUMN injection_site TEXT;` (nullable, sem default)
2. `CHECK (injection_site IS NULL OR injection_site IN ('abdomen_e','abdomen_d','coxa_e','coxa_d','braco_e','braco_d','gluteo_e','gluteo_d'))` — domínio finito estável → CHECK apropriado (RC3-F5; alinha R-271; contrasta ADR-070 que era domínio extensível).
3. Índice: avaliar `(user_id, taken_at DESC) WHERE injection_site IS NOT NULL` **MAS** ORDER BY usa
   `taken_at` direto (NÃO COALESCE) p/ casar índice (RC3-F3). Decisão: novos logs sempre têm
   `taken_at` (NOT NULL no write-path) → ordenar por `taken_at`, COALESCE só fallback p/ legado.
4. Editar as 3 RPCs (`register`/`update`; delete não muda — coluna acompanha a row).
5. **Reversão**: `DROP COLUMN injection_site` (sem backfill, sem dado órfão). Sem efeito em FIFO
   (consume_stock_fifo independe do sítio) nem em adesão (`dose_instances`, ADR-054).

## Target Files

| # | Arquivo | Path-status | Mudança | PO |
|---|---------|-------------|---------|-----|
| **WRITE PATH** ||||
| 1 | `docs/migrations/20260621_injection_site.sql` (novo) | a criar | ADD COLUMN + CHECK + índice + ALTER das 3 RPCs | PO-9 |
| 2 | `packages/core/src/schemas/logSchema.js` | ✅ verif | `injection_site` enum `.nullable().optional()` no `logSchema` | PO-1,7 |
| 3 | `packages/core/src/services/doseLogService.js` | ✅ verif | `callRegisterAtomic` passa `p_injection_site`; `callUpdate*` passa `p_injection_site`+`p_has_*` | PO-1,8 |
| 4 | `packages/core/src/utils/injectionSites.js` (novo) | a criar | lista canônica `{value,label,absorption}` (8) + `getLastInjectionSite` helper de query (ou no repo) | PO-2,4 |
| **READ PATH** ||||
| 5 | `apps/web/src/shared/services/api/logService.js` | ✅ existe (12 selects) | selects do histórico/rotação incluem `injection_site`; novo método "último global" | PO-2,5 |
| 6 | `apps/web/src/shared/components/log/LogForm.jsx` (+sections) | ✅ verif | campo dropdown só p/ injetável; "última: X"; alerta = último | PO-1,3 |
| 7 | `apps/web/src/views/redesign/history/HistoryDayPanel.jsx` | ✅ verif | exibe sítio no detalhe (oculto se NULL) | PO-5,6 |
| 8 | `…/history/timelineService.js` (views/redesign/history) | UNVERIFIED (C1.5) | select inclui `injection_site` | PO-5 |
| 9 | mobile: dose flow + history detail | UNVERIFIED (C1.5) | captura (injetável) + exibição detalhe | PO-1,5 |
| 10 | `server/bot/callbacks/doseActions.js` | ✅ existe | Telegram grava NULL (sem captura v1) — só garantir que não quebra | PO-6 |

> R-267: write-path (1-4) + read-path (5-10) ambos enumerados. UNVERIFIED resolve no C1.5 (find/grep
> a DEFINIÇÃO, não o caller).

## Contracts & ADRs

- **CON-026** (doseLogService/RPC atômica): muda assinatura das RPCs (param aditivo opcional com
  DEFAULT) → **não-breaking** (callers antigos omitem; default NULL). Atualizar CON-026 no C5.
- **ADR novo** (P2): "injection_site como coluna em `medicine_logs` + rotação global por query"
  (status: proposed) — documenta escolha vs. tabela dedicada / biomarkers_log; contrasta ADR-070
  (CHECK aqui SIM, domínio finito). Aprovação humana antes do coding.

## Slicing (RC3-F6)

- **031-A** (este plano, wedge): migração + RPCs + logSchema + doseLogService + `injectionSites`
  util + captura US1 + "último global" US2 + alerta US3 + exibição histórico US5. POs 1,2,2a,3,5,6,7,9.
- **031-B** (follow-up): editar sítio pós-log (US6/FR-011 → `update_dose_log_atomic`) + hint
  absorção US4 + quick-pick pós-1-click. POs 4,8. A migração de A já habilita B sem re-migrar.

## Risks + Quality Gates

- **R1 silent drop (CRÍTICO)**: campo no Zod/coluna mas não na RPC → não grava. Mitiga: PO-1 testa
  round-trip insert→select; C1.5 failure-mode table.
- **R2 índice não usado**: ORDER BY COALESCE ≠ índice → seq scan. Mitiga: ordenar por `taken_at` direto.
- **R3 read-path UNVERIFIED**: timeline/mobile paths. Mitiga: C1.5 canonical verification bloqueia.
- **Gates**: `rtk lint` · `rtk npm run test:critical` (injectionSite specs) · `rtk npm run validate:agent`
  (guard full: FIFO+adesão). SQP: Web minor + Mobile patch + Core; CHANGELOG [Unreleased]; migração.

## Clarifications (P1.5)
- Q: Telegram/voz capturam sítio na v1? → A: NÃO; gravam NULL (spec FR-010). Edição pós-log (B) cobre.
- Q: bulk multidose ganha sítio por-item? → A: v1 NULL; reavaliar em B (quick-pick).
- Q: CHECK ou Zod-only (à la ADR-070)? → A: CHECK (domínio finito estável; RC3-F5).
