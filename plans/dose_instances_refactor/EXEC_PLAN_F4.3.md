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

### F4.3d — Write-path bulk por `instance_id` + rewire HeroDoseCard → bulk
- **Plataforma:** Mobile · **SemVer:** Minor (mudança de UX no hero) · **Deps:** F4.3c (âncora individual por instanceId)
- **Deliverables:**
  - MOD `BulkDoseRegisterModal` + `registerDoseMany` — cada entrada aceita `instance_id` opcional → `markTaken` direto por entrada; fallback snap quando ausente (espelha F4.3c/web: se markTaken direto falhar, NÃO snap).
  - Mapear instâncias do plano/slot às entradas do bulk (a partir dos itens da timeline já instance-based).
  - **REWIRE `HeroDoseCard` → bulk** (novo, decisão PO): hoje o tap no hero abre a modal **single** com UM tratamento → com 3 prioritárias o usuário repete o fluxo 3×. Trocar para **abrir o bulk** com as doses instanciadas do hero (as `priorityDoses` PROXIMA/ATRASADA já carregam `instanceId`/`protocolId`/`scheduledTime`). Paridade com o web (clique no card de prioridade registra o grupo). O bulk recebe as ocorrências exatas do hero (não re-expandir todo o `time_schedule`) → registro **referenciado** por `instance_id`. Avaliar passar via `initialProtocols`/nova prop de itens instanciados em vez de `protocolIds` (que re-expande o schedule no `usePlanProtocols`).
  - `TodayScreen`: `HeroDoseCard.onPress` deixa de chamar `handleOpenRegister(single)` e passa a `setBulkModal({...})` com os itens do hero; remover o ramo single do hero (cards da lista seguem no single individual da F4.3c).
  - Testes mobile (Jest): bulk determinístico + fallback; hero abre bulk com as N prioritárias.
  - SQP: minor (`app.config` APP_VERSION) + CHANGELOG Mobile + store-note ("dose prioritária registra todas de uma vez").
- **Aceite (SC):** tap no hero com N prioritárias → bulk pré-selecionado com as N, 1 confirmação registra todas, cada uma ancorada à sua ocorrência (`instance_id`); registro em lote (plano/avulsos via FAB) ancora cada dose; fallback snap preservado (PRN/avulso).
- **Gates:** lint + jest. Smoke PO mobile (hero multi-dose + FAB).

### F4.3e — "Pendências de ontem" (carry-over cross-dia) — web + mobile
> **Origem:** requisito da MASTER (Fase 4, ln 204-211) — *"janela deslizante cross-dia … seção fixa 'Pendências de ontem' no topo … Simple: carry-over no topo + listão de hoje; Complex: carry-over acima dos períodos"*. Escorregou na F3.2b (web `useDoseZones` ficou day-bound) e foi herdado pela F4.3b (mobile copiou o day-bound). Esta sub-fase fecha a lacuna nas DUAS plataformas.
- **Plataforma:** Shared/Core + Web/PWA + Mobile · **SemVer:** Minor (web + mobile — comportamento visível novo)
- **Deliverables:**
  - CORE (CON-024, aditivo): helper de partição — ex. `splitDayTimeline(instances, protocols, { now, tz })` → `{ carryOver, today }`. **carry-over** = ocorrências cujo `scheduled_for` cai em dia(s) local(is) ANTERIOR(es) a hoje E ainda `pending`/`late` dentro da tolerância (`classifyDose != null` → actionável); **today** = janela do dia local atual (comportamento F3.2b/F4.3b). Doses de ontem já `missed`/pós-tolerância NÃO entram (não actionáveis).
  - WEB: `useDoseZones`/`Dashboard.jsx` (redesign) — seção "Pendências de ontem" no topo da lista de hoje; só renderiza se `carryOver.length > 0`.
  - MOBILE: `_useTodayDerived` expõe `carryOver`; `TodayScreen` renderiza seção "Pendências de ontem" — **Simple:** acima do listão; **Complex:** acima dos períodos (períodos de hoje inalterados, day-bound).
  - Testes core (vitest) da partição + web (vitest) + mobile (jest) das seções.
  - SQP: web minor + mobile minor (`app.config` APP_VERSION) + CHANGELOG ambos + store-note mobile.
- **Aceite (SC):** dose de ontem 22:30 ainda `pending`/`late` dentro da tolerância aparece em "Pendências de ontem" (web+mobile, Simple+Complex); sem carry-over → render idêntico ao atual; períodos complex inalterados; bug do slot-fantasma segue resolvido (carry-over é seção própria, não slot de hoje).
- **Gates:** lint 0 · vitest web+core · jest mobile · build web. Smoke PO web + mobile.

### F4.3f — Injeção de tz ponta-a-ponta (fecha G1 fora do Histórico) — core + write-path + "hoje" web/mobile + regen on tz-change
> **Origem:** princípio-mãe do refactor (MASTER §5 ln 132-134, ln 238 — *"tz antes de gerar — ordem não-negociável"*; Q-A/Q-I ln 220/228). Hoje o tz do perfil (`user_settings.timezone`) só é lido na timeline do **Histórico** (F4.2). **Geração** (`createProtocolRepository`→`planWindow`→`generateInstances`) e **"hoje"** (`useDoseZones` web + `_useTodayDerived` mobile) usam `'America/Sao_Paulo'` hardcoded (default de `planWindow`/`DEFAULT_TZ`). Resultado: usuário com tz ≠ SP (expat — habilitado na S4.4b/ADR-053) tem `scheduled_for` materializado no fuso errado E a virada-de-dia/HH:MM do "hoje" em SP. Sem isto, o refactor não cobre tz ≠ SP — esvazia o esforço.
- **Plataforma:** Shared/Core + Web/PWA + Mobile (+ Backend/Infra: cron `server/bot` se gerar instâncias) · **SemVer:** Minor (web + mobile) · **DADOS:** requer regen das `pending` futuras dos usuários tz ≠ SP
- **Deliverables:**
  - **Write-path passa o tz do usuário** (não default SP):
    - `createProtocolRepository.syncInstancesOnWrite` resolve `user_settings.timezone` (uma leitura) e passa `tz` a `planWindow`/`ensureInstancesUpTo` (web + mobile, mesma factory core — R-231).
    - Rede lazy (`ensureInstancesUpTo`) e cron de renovação (`renewProtocolWindow`, `server/bot/scheduler.js`) idem — geração due-only com o tz do dono do protocolo.
  - **tz-change → wipe + regen** (Q-I): `updateTimezone` (web `profileService` + mobile `profileService`) passa a, após persistir, disparar `wipeFuturePending` + `planWindow(fromTs=now, tz=novo)` das `pending` futuras de todos os protocolos ativos do usuário (reusa a mecânica do edit; passadas/`taken`/`missed` intactas — âncora travada Q-E). Best-effort (R-245/246).
  - **Leitura "hoje" usa o tz do perfil:** `useDoseZones` (web) e `_useTodayDerived` (mobile) recebem o `timezone` do contexto (já buscado em `useDashboard`/`useTodayData`) e passam a `buildDoseItemsFromInstances`/fronteiras de dia em vez de `DEFAULT_TZ`. Fallback SP quando ausente.
  - **Backfill one-shot** (se houver usuários tz ≠ SP em prod): script escopado por `userId` (R-179, `--dry-run`) que regenera `pending` futuras no tz correto. (Avaliar necessidade — base mínima; pode ser coberto pelo regen-on-change no próximo login/edição.)
  - Testes: core (tz não-SP muda `scheduled_for`/fronteira), web (vitest), mobile (jest); regen-on-change.
  - SQP: web minor + mobile minor + CHANGELOG ambos + store-note mobile.
- **Aceite (SC):** usuário em `Europe/London` cria/edita tratamento "08:00" → `scheduled_for` materializa 08:00 **Londres** (não SP); "hoje" web+mobile deriva a virada-de-dia e HH:MM no fuso de Londres; trocar o fuso regenera as `pending` futuras no novo offset; SP segue idêntico (zero regressão maioria). Fecha G1 fora do Histórico.
- **Gates:** lint 0 · vitest web+core · jest mobile · build web. Smoke PO web + mobile (cenário expat: setar Londres, conferir horários).
- **Riscos:** (1) regen ao trocar tz pode recriar muitas linhas — escopar a `pending` futura + best-effort; (2) consistência geração↔leitura (G2) — ambos no mesmo tz do perfil mata a divergência; (3) cron `server/bot` precisa do tz por protocolo (lookup) — confirmar fonte; (4) instâncias legadas SP de usuários que viraram expat — regen-on-change cobre no próximo write/login.

---

## Ordem & gates
`F4.3a → [smoke web + merge] → F4.3b → [smoke mobile + merge] → F4.3c → [smoke + merge] → F4.3d → [smoke + merge] → F4.3e (carry-over web+mobile) → [smoke + merge] → F4.3f (tz ponta-a-ponta) → [smoke web+mobile expat + merge]` → **Fase 4 fechada → distill final + RETRO do refactor**.

Cada PR: R-221 SQP, lint 0 + testes do workspace ANTES do commit, smoke PO ANTES do PR (constituição VII), Gemini review, merge humano (R-060). C5 pós-merge.

## Riscos
- **Rewire web (F4.3a)** quebrar o dashboard hoje → mitigar: mover puro + teste web inalterado deve passar; smoke web.
- **Mapeamento de status** (F4.3b) card visual → conferir paridade de rótulos com web (R-166).
- **tz mobile default SP** — residual G1 (auto-detecção/expat = follow-up); documentar, não é regressão.
- **Bulk→instância** (F4.3d) ambiguidade de slot → fallback snap garante segurança.
- **Carry-over (F4.3e)** corte da janela de ontem → usar `classifyDose != null` (dentro da tolerância) como critério de "actionável"; não puxar ontem já `missed` (vira ruído). Web e mobile precisam do MESMO helper core (R-231) p/ não divergir.

## Contratos / Memória
- **CON-024** (novo, F4.3a): API core de zonas de dose. Aditivo, sem ADR.
- R-231 (reuso core), R-248 (adesão instances), R-252 (FP-3), R-166 (texto espelha web), R-245/246 (âncora best-effort), R-234 (smoke), constituição II/IV/V/VII.

## DoD da F4.3 (todas as fases)
- [ ] Lógica de zonas no core, web reusa sem duplicata (CON-024).
- [ ] Timeline do Hoje mobile vem de `dose_instances` (status real, scheduled_for absoluto, tolerância dinâmica, cross-meia-noite correto).
- [ ] priorityCard + card refletem estado real.
- [ ] "Pendências de ontem" (carry-over cross-dia) no topo do "hoje" — web + mobile, Simple + Complex (MASTER ln 204-211, F4.3e).
- [ ] tz do perfil injetado ponta-a-ponta — geração (write-path + cron) + "hoje" web/mobile + regen on tz-change; tz ≠ SP correto (MASTER §5/Q-I, F4.3f). G1 fechado fora do Histórico.
- [ ] Write individual + bulk ancoram por `instanceId` (determinístico), snap como fallback PRN.
- [ ] HeroDoseCard abre o **bulk** com as N doses prioritárias instanciadas (1 confirmação registra todas, referenciado) — não mais single 1×N (F4.3d).
- [ ] Testes web+core (vitest) e mobile (jest) verdes; smoke PO por fase.
- [ ] SQP por PR; CHANGELOG; versões mobile bumpadas.
