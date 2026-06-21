# Tasks: 031 — Rotação de sítio de aplicação (injetáveis)

Slice **031-A** (wedge) primeiro. 031-B (T20-T23) é follow-up — não bloqueia A.
PO refs → [spec.md](./spec.md) Proof Obligations.

## Slice 031-A — captura + rotação global + histórico + migração

### Schemas & Core (C3 ordem: schema → service → util)
- [ ] T01 [US1] `injectionSites.js` em `packages/core/src/utils/` — lista `{value,label,absorption}` (8 sítios, labels PT D/E) [PO-2,4]
- [ ] T02 [US1] `logSchema.js`: add `injection_site` enum core `.nullable().optional()`; sincroniza com CHECK [PO-1,7]
- [ ] T03 [US2] helper "último global" `getLastInjectionSite(userId)` — query sem filtro de med, `ORDER BY taken_at DESC NULLS LAST LIMIT 1` (em util ou repo) [PO-2,2a]

### Migração (DB)
- [ ] T04 `docs/migrations/20260621_injection_site.sql`: ADD COLUMN nullable + CHECK (8 valores) + índice `(user_id, taken_at DESC) WHERE injection_site IS NOT NULL` [PO-9]
- [ ] T05 ALTER `register_dose_atomic` — novo param `p_injection_site TEXT DEFAULT NULL` + coluna no INSERT [PO-1]
- [ ] T06 ALTER `update_dose_log_atomic` — `p_injection_site` + `p_has_injection_site BOOLEAN` (padrão COALESCE) [PO-8 → slice B usa]

### Write-path JS
- [ ] T07 [US1] `doseLogService.js` `callRegisterAtomic`: passa `p_injection_site` do log validado [PO-1]

### UI web
- [ ] T08 [P][US1] `LogForm.jsx`(+sections): dropdown de sítio renderiza **só** se `medicine.type==='injetavel'`; demais → NULL [PO-1]
- [ ] T09 [US2] LogForm exibe "última aplicação: <label>" (via T03) quando existir [PO-2]
- [ ] T10 [US3] LogForm: selecionar = último → alerta não-bloqueante; confirmar nunca travado [PO-3]
- [ ] T11 [US5] `logService.js`: selects do histórico/rotação incluem `injection_site` (enumerar QUAIS — não todos) [PO-5]
- [ ] T12 [US5] `HistoryDayPanel.jsx`: exibe sítio no detalhe; oculto se NULL (sem placeholder) [PO-5,6]
- [ ] T13 [US5] `timelineService.js` (history): select inclui `injection_site` — **C1.5 verificar path** [PO-5]

### UI mobile
- [ ] T14 [US1] mobile dose flow: captura sítio p/ injetável (paridade web) — **C1.5 path** [PO-1]
- [ ] T15 [US5] mobile history detail: exibe sítio — **C1.5 path** [PO-5]

### Guard / não-regressão
- [ ] T16 [C4] Telegram `doseActions.js`: confirma grava NULL sem quebrar [PO-6]
- [ ] T17 [C4] testes: `injectionSite` (paridade enum↔CHECK PO-7, round-trip write→read PO-1, último global PO-2, retroativo PO-2a) + negative-path (NULL/oral/legado PO-6) [PO-1,2,2a,6,7]

### C4/C5
- [ ] T18 [C4] gates: `rtk lint` · `rtk npm run test:critical` · `rtk npm run validate:agent` (FIFO+adesão verde); fechar PO-1,2,2a,3,5,6,7,9 com evidência colada
- [ ] T19 [C5] ADR accepted (coluna+rotação global) · CON-026 atualizado (param aditivo) · CHANGELOG [Unreleased] · README status `in-progress` · journal · state.json

## Slice 031-B — edição pós-log + hint absorção (follow-up)
- [ ] T20 [US6] `update_dose_log_atomic` exposto via service: editar sítio sem tocar `taken_at` [PO-8]
- [ ] T21 [US6] HistoryDayPanel: editar/adicionar sítio em dose injetável (web+mobile) [PO-8]
- [ ] T22 [US4] hint de absorção no seletor (texto educacional, não-SaMD) [PO-4]
- [ ] T23 quick-pick pós-1-click nos flows sem form (estratégia (b)) — urgent/alarme/bulk
