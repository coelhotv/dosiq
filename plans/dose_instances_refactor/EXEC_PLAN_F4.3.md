# EXEC PLAN — PR-F4.3: Timeline do Hoje (mobile) ← `dose_instances` + extração core + write-path por `instanceId`

> **Escopo ajustado (decisão PO):** mobile NÃO tem tela de histórico — só a aba **Hoje** com a timeline do dia. F4.3 deixa de ser "paridade de histórico" e vira: **migrar a timeline do Hoje mobile do modelo inferido (logs+protocolos) para `dose_instances`** (paridade com o web `useDoseZones`/F3.2b), extraindo a lógica compartilhada para o **core** (R-231 / constituição V), e fasear as superfícies de escrita.
> **Status:** ⬜ planejado (aguardando coding por fase).
> **Deps:** F3.3 (mobile já busca `data.doseInstances` + write ancora via snap). F4.2 (web fechou tz no caminho da timeline).
> **ADRs:** ADR-050 (FP-3) · ADR-052 (seams) · ADR-054 (fonte única `dose_instances`). Sem ADR novo.

---

## Por que (problema concreto)

A aba Hoje monta a lista de doses via `calculateDosesByDate(todayLogs, protocols)` (core `adherenceLogic`) — **inferência ±matching sobre logs + slots do `time_schedule`**. Isso reintroduz, só na EXIBIÇÃO mobile, os bugs que o refactor já matou no resto:
- **cross-meia-noite**: dose de ontem 22:30 registrada 00:05 vira slot fantasma de hoje;
- **sem estado real**: não há `missed`/`pending` materializado; status é derivado;
- **tolerância fixa**: não honra `tolerance_minutes` por ocorrência;
- **âncora não-determinística**: registro snap-only (web já ancora por `instanceId` direto).

A adesão/anel mobile JÁ consome `dose_instances` (F3.3) — só a timeline e o write-path ficaram pela metade.

---

## Estado atual (inventário verificado)

| Item | Caminho | Estado |
|------|---------|--------|
| Lógica de zonas (web) | `apps/web/src/features/dashboard/hooks/useDoseZones.js` | `classifyDose` + `buildDoseItemsFromInstances` vivem AQUI (não no core) |
| Consumidores web | `Dashboard.jsx`, `CronogramaDoseItem.jsx`, `logService.js`, teste | importam de `useDoseZones` |
| Timeline mobile | `apps/mobile/src/features/dashboard/hooks/_useTodayDerived.js` | usa `calculateDosesByDate` (logs+protocolos) ❌ |
| Instâncias mobile | `apps/mobile/src/features/dashboard/hooks/useTodayData.js` | já busca `doseInstances` do dia ✅ |
| Card | `apps/mobile/src/features/dashboard/components/DoseTimelineCard.jsx` | status `TOMADA/PERDIDA/ATRASADA/PROXIMA` (próprio) |
| priorityCard | `HeroDoseCard.jsx` (via `priorityDoses` da timeline) | downstream — herda |
| FAB | entrypoint em `TodayScreen.jsx` | só abre modais — nada a migrar |
| Write individual | `doseService.registerDose` | ancora via **snap** (`findAnchorInstance`→`markTaken`, F3.3/AP-193) |
| Write bulk | `doseService.registerDoseMany` | idem snap |

---

## Sub-fases (1 PR + smoke + merge cada — "faseando cada um")

### F4.3a — Extração da lógica de zonas para o core (fundação, **CON-024**)
- **Plataforma:** Shared/Core + Web/PWA · **SemVer:** Patch (web, sem mudança de comportamento)
- **Deliverables:**
  - CRIAR `packages/core/src/utils/doseZones.js` — mover `classifyDose`, `buildDoseItemsFromInstances` (+ helpers `createDoseItem`/`getPlanBadge`/`toLocalHHMM`) puros, tz-injetável (param `tz`, default SP).
  - Barrel `packages/core/src/utils/index.js` — exportar.
  - REWIRE `apps/web/src/features/dashboard/hooks/useDoseZones.js` — importar do core (deletar cópia local), **zero mudança de comportamento**.
  - Testes core (vitest) p/ `classifyDose`/`buildDoseItemsFromInstances` (cross-meia-noite, tolerância, skipped_*).
  - **CON-024** (CONTRACTS_INDEX + detalhe): `classifyDose(...)` + `buildDoseItemsFromInstances(instances, protocols, tz)` como API core compartilhada.
- **Aceite (SC):** web Dashboard "hoje" idêntico (testes web `useDoseZones` verdes sem alteração de asserção); core testa a lógica; nenhuma duplicata (R-231).
- **Gates:** lint 0 · vitest web+core · build web. Smoke PO web (regressão dashboard hoje).

### F4.3b — Mobile: timeline do Hoje ← `dose_instances`
- **Plataforma:** Mobile · **SemVer:** Minor (comportamento visível muda — estados reais)
- **Deliverables:**
  - MOD `_useTodayDerived.js` — trocar `calculateDosesByDate(...)` por `buildDoseItemsFromInstances(data.doseInstances, protocols, tz)` + classificação por `classifyDose` (zonas late/now/upcoming/later/done). tz default SP (residual G1 mobile, documentado).
  - MOD `DoseTimelineCard.jsx` — mapear status real (`taken/missed/pending` + zona) ao visual atual; exibir hora de `scheduledTime` (derivada de `scheduled_for`).
  - priorityCard (`HeroDoseCard`) herda (itens agora carregam `instanceId`/status).
  - Testes mobile (Jest) do hook/card.
  - SQP: `app.config.js` APP_VERSION minor + CHANGELOG Mobile + store-note.
- **Aceite (SC):** lista do dia vem de instâncias; cross-meia-noite correto; `missed`/`pending` reais; tolerância dinâmica honrada; KPIs batem com adesão (F3.3).
- **Gates:** mobile lint + jest. **Smoke PO mobile (R-234)** — fluxo crítico.

### F4.3c — Write-path determinístico por `instanceId` (individual)
- **Plataforma:** Mobile (+ Shared/Core se repo precisar) · **SemVer:** Patch
- **Deliverables:**
  - Plumbar `instanceId`: `DoseTimelineCard.onRegister(dose)` / `HeroDoseCard.onPress` → `handleOpenRegister(protocol, scheduledTime, instanceId)` → `DoseRegisterModal` → `registerDose({ ..., instance_id })`.
  - MOD `doseService.registerDose` — se `instance_id` presente → `markTaken(instance_id, logId)` direto (determinístico); senão mantém **snap** (PRN/avulso). Best-effort (R-245/246).
  - Testes mobile (Jest) do caminho determinístico vs snap.
  - SQP: patch + CHANGELOG Mobile.
- **Aceite (SC):** registro de dose passada/cross-meia-noite ancora na ocorrência certa (sem depender de tolerância de snap); PRN sem `instance_id` ainda funciona via snap.
- **Gates:** lint + jest. Smoke PO mobile.

### F4.3d — Write-path bulk por `instance_id`
- **Plataforma:** Mobile · **SemVer:** Patch
- **Deliverables:**
  - MOD `BulkDoseRegisterModal` + `registerDoseMany` — cada entrada aceita `instance_id` opcional → `markTaken` direto por entrada; fallback snap quando ausente.
  - Mapear instâncias do plano/slot às entradas do bulk (a partir dos itens da timeline já instance-based).
  - Testes mobile (Jest) bulk determinístico + fallback.
  - SQP: patch + CHANGELOG Mobile.
- **Aceite (SC):** registro em lote (plano/avulsos) ancora cada dose à sua ocorrência; fallback snap preservado.
- **Gates:** lint + jest. Smoke PO mobile.

---

## Ordem & gates
`F4.3a → [smoke web + merge] → F4.3b → [smoke mobile + merge] → F4.3c → [smoke + merge] → F4.3d → [smoke + merge]` → **Fase 4 fechada → distill final + RETRO do refactor**.

Cada PR: R-221 SQP, lint 0 + testes do workspace ANTES do commit, smoke PO ANTES do PR (constituição VII), Gemini review, merge humano (R-060). C5 pós-merge.

## Riscos
- **Rewire web (F4.3a)** quebrar o dashboard hoje → mitigar: mover puro + teste web inalterado deve passar; smoke web.
- **Mapeamento de status** (F4.3b) card visual → conferir paridade de rótulos com web (R-166).
- **tz mobile default SP** — residual G1 (auto-detecção/expat = follow-up); documentar, não é regressão.
- **Bulk→instância** (F4.3d) ambiguidade de slot → fallback snap garante segurança.

## Contratos / Memória
- **CON-024** (novo, F4.3a): API core de zonas de dose. Aditivo, sem ADR.
- R-231 (reuso core), R-248 (adesão instances), R-252 (FP-3), R-166 (texto espelha web), R-245/246 (âncora best-effort), R-234 (smoke), constituição II/IV/V/VII.

## DoD da F4.3 (todas as fases)
- [ ] Lógica de zonas no core, web reusa sem duplicata (CON-024).
- [ ] Timeline do Hoje mobile vem de `dose_instances` (status real, scheduled_for absoluto, tolerância dinâmica, cross-meia-noite correto).
- [ ] priorityCard + card refletem estado real.
- [ ] Write individual + bulk ancoram por `instanceId` (determinístico), snap como fallback PRN.
- [ ] Testes web+core (vitest) e mobile (jest) verdes; smoke PO por fase.
- [ ] SQP por PR; CHANGELOG; versões mobile bumpadas.
