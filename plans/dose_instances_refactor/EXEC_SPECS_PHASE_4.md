# EXEC SPEC — Fase 4: Timeline Event-Source-Agnóstica + Fechamento de tz (G1)

> **Objetivo:** transformar o histórico de saúde numa **linha do tempo contínua de eventos tipados**, ordenada por instante absoluto, **aberta a múltiplos tipos** (`dose` agora; `biomarker`/`note` depois sem reescrever) — realização do **FP-3** (ADR-050). É a fundação que os épicos de **líquidos** e **diabetes** reusam (ADR-052). Fecha também o gap **G1** (injeção de tz nos ~250 callers em SP-default).
> **Pré-requisitos:** Fase 3 (leitura ← `dose_instances`) ✅ mergeada. Adesão/hoje já consomem instâncias.
> **ADRs:** ADR-048 · ADR-049 (tz) · **ADR-050 FP-3** · ADR-052 (fundação compartilhada) · **ADR-053** (multi-tz expat: default→user-tz + enum curado Caminho B, ver S4.4b).
> **Status:** ⬜ planejada (não iniciada).

---

## 📊 Status de execução (atualizar ao entregar)

| PR | Sprints | Status | Ref |
|----|---------|--------|-----|
| **PR-F4.1** core event-model + read | S4.0–S4.2 | ⬜ pendente | puro + read service (sem UI) |
| **PR-F4.2** web timeline UI + tz | S4.3–S4.4 | ⬜ pendente | **muda UI** + fecha G1 |
| **PR-F4.3** mobile timeline | S4.5 | ⬜ pendente | paridade nativa |
| (testes S4.6) | distribuídos | ⬜ | dentro de cada PR |

---

## 🎯 Princípio da fase

O histórico hoje é centrado em **logs de dose** agrupados por dia. A F4 inverte: uma **stream de eventos** genéricos, cada um `{ type, occurred_at, payload }`, ordenada por `occurred_at` (instante absoluto UTC), renderizada no fuso do usuário, atravessando a meia-noite naturalmente.

```
Event = { type: 'dose' | 'biomarker' | 'note' | ..., occurred_at: timestamptz, payload: {...} }
Timeline = sort(events, by occurred_at)   // instante absoluto; tz só na exibição do wall-clock
```

Hoje a stream é populada só com `dose` (de `dose_instances` + `medicine_logs`). A interface fica **aberta** — adicionar `biomarker` (glicemia, diabetes) ou volume de líquido depois é plugar um produtor de eventos, **sem** tocar o builder nem a UI.

---

## ⚠️ Gaps e decisões desta fase

- **G1 — fechamento da injeção de tz.** A F1 deixou ~250 callers em SP-default (`getUserTime` com tz opcional, ADR-049/CON-022). A F4 fecha: o caminho de leitura/exibição da timeline injeta o tz do usuário ponta-a-ponta. **Não** é refactor dos 250 de uma vez — é injetar tz no fluxo da timeline (e nos leitores da F3 que ainda dependam de SP). Resto residual segue SP-default documentado.
- **G6 — views de adesão legadas (herdado da F3).** `v_daily_adherence` + `v_adherence_heatmap` (consumidas por Reports/PDF/Consultation/HealthHistory via `getDailyAdherenceFromView`/`getAdherencePatternFromView`) ainda inferem sobre `medicine_logs`. A F4 resolve junto da timeline (S4.2b).
  - ⚠️ **RESTRIÇÃO CRÍTICA:** essas views existem como **mitigação de OOM/loading em devices low-mid** — agregam **no servidor** (SQL), o client recebe ~28 linhas prontas, não N logs crus. A resolução **DEVE preservar a agregação server-side** (reescrever a FONTE da view `medicine_logs`→`dose_instances` em SQL, ou view materializada/RPC/`countByStatus`). **NUNCA** mover o cálculo long-range/heatmap pro client (classe AP-P03/AP-P14, R-249).
- **G7 — produtor de eventos desacoplado.** O builder de timeline NÃO conhece `dose_instances` diretamente; recebe uma lista de eventos já normalizados. Um *adapter* converte `dose_instances`/`medicine_logs` → eventos. Outro adapter (futuro) converte `biomarkers_log`. O builder é agnóstico. (FP-3.)
- **FP-3 realizado:** a partir desta fase, qualquer tipo novo de evento entra por adapter; UI itera sobre `event.type` com um registry de renderizadores.

### Future-proofing que esta fase entrega aos épicos
- **Líquidos:** evento `dose` já carrega `payload` com quantidade na `dosage_unit` (Seam A da F3) → exibir "2,5 ml (50 mg)" é formatação no renderizador, não mudança de modelo.
- **Diabetes:** `biomarker` (glicemia) entra como tipo de evento ao lado de `dose`; a correlação glicemia↔dose na timeline é só ordenação por instante (já pronta). `biomarkers_log` é trabalho do épico, não da F4.

---

## Sprints

### S4.0 — Preflight: data shape do histórico atual (investigator)
- **Agent:** `cavecrew-investigator` · **Modelo:** default
- **Objetivo:** mapear o histórico atual e seus consumidores, caminho canônico.
- **Alvos:**
  - `apps/web/src/views/redesign/history/HealthHistoryView.jsx` + `HistoryDayPanel.jsx`, `HistoryLogCard.jsx`, `HistoryKPICards.jsx`, `HistoryRedesign.css`.
  - `apps/web/src/views/redesign/HealthHistory.jsx` (wrapper) + `views/__tests__/HealthHistory.test.jsx`.
  - Quem fornece os dados (hook/service de histórico) e em que shape (logs por dia hoje).
  - Mobile: tela de histórico equivalente (`apps/mobile/src/features/...`).
  - Callers de `getUserTime`/dateUtils sem tz no caminho de histórico (escopo G1 desta fase).
- **Aceite:** inventário com shape atual + lista de consumidores + escopo G1 delimitado (quais callers a F4 injeta tz). Nenhum código alterado.
- **Deps:** —

### S4.1 — Core: modelo de evento + builder puro ⚠️ crítico
- **Agent:** `claude` · **Modelo:** **opus** (modelo de dados aberto + ordenação tz-aware, decisão de longo prazo)
- **Files:** `packages/core/src/utils/timeline.js` (novo) + testes; schema do evento em `packages/core/src/schemas/` se precisar validação.
- **Spec:**
  - Tipo `TimelineEvent = { id, type, occurred_at, payload }`. `type` é string aberta (enum extensível PT onde fizer sentido, R-021).
  - `buildTimeline(events, { tz })` puro → eventos ordenados por `occurred_at` (instante absoluto, desc/asc), com `localDay` derivado no `tz` (para agrupar visualmente sem quebrar cross-meia-noite). Reusar dateUtils tz-aware (CON-022); R-020 (nunca `new Date(str)`).
  - Agrupamento por dia local é **derivado** (não muda a ordem absoluta) — um evento 23:50 e outro 00:10 ficam em dias locais distintos mas adjacentes na stream.
- **Aceite:** builder puro, sem I/O; testes cobrem ordenação por instante, agrupamento cross-meia-noite, DST, tz ≠ SP, mix de tipos (`dose` + um tipo fake `note` para provar agnosticismo).
- **Deps:** S4.0

### S4.2 — Core/service: adapter `dose_instances` → eventos + read
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `packages/core/src/services/timelineService.js` (novo) ou estender planner; testes.
- **Spec:**
  - Adapter `doseInstancesToEvents(instances, logs)` → `TimelineEvent[]` de `type='dose'` (payload: medicine, dosagem na unidade, status taken/missed/pending, elo log). FP-3: adapter isolado.
  - `getTimeline({ userId, fromTs, toTs, tz })` → busca instâncias (repo `getWindow`, paginado AP-186) + logs avulsos (sem `dose_instance_id`, para não sumir do histórico) → adapter → `buildTimeline`. Lazy net (`ensureInstancesUpTo`) best-effort antes (R-245).
- **Aceite:** stream inclui taken/missed/pending + logs avulsos; ordenação correta; paginado; sem duplicar (instância taken + seu log = 1 evento, não 2).
- **⚠️ Interação com órfãos históricos (AP-193):** logs pré-fix sem `dose_instance_id` (mobile pré-0.7.0) aparecem na timeline como eventos `dose` avulsos (corretamente — não somem). Mas suas instâncias materializadas podem estar `missed` (falso) em paralelo → **risco de evento duplicado/contraditório** (1 log avulso "taken" + 1 instância "missed" no mesmo slot). O **reconcile histórico one-shot** (fatia própria pendente, todos usuários) deve rodar ANTES ou junto da F4 p/ a timeline não mostrar o mesmo slot 2×. Mínimo: o adapter deve dedupe por (protocol_id, slot-na-tolerância) preferindo o estado real.
- **Deps:** S4.1, Fase 3 (read API). **Pré-requisito recomendado:** reconcile histórico de órfãos.

### S4.2b — Resolver views de adesão legadas (G6) preservando server-agg ⚠️ migration
- **Agent:** `claude` · **Modelo:** **opus** (SQL + risco schema drift, decisão de fonte de verdade)
- **Files:** migration SQL (rewrite da fonte das views) + `apps/web/src/services/api/adherenceService.js` (`getDailyAdherenceFromView`/`getAdherencePatternFromView` — só se a forma mudar) + testes.
- **Spec:** reescrever a FONTE de `v_daily_adherence` e `v_adherence_heatmap` de `medicine_logs` (inferência ±2h) → `dose_instances` (status real), **mantendo a mesma interface de saída** (colunas/shape que Reports/PDF/Consultation/HealthHistory já consomem) e a **agregação no servidor** (R-249 — NUNCA mover pro client). Alinhar a semântica com a F3 (taken/missed real). Grants + RLS conforme CLAUDE.md. Sem caminho duplicado (lição Sprint 7).
- **Aceite:** views retornam de `dose_instances`; números batem com `adherenceService` core (F3); payload ao client inalterado (sem regressão OOM em low-mid); Reports/PDF/Consultation seguem funcionando.
- **🐞 BUG CONCRETO A MATAR (AP-191, descoberto F3.2b):** `v_daily_adherence` hoje calcula `expected` SÓ de `protocols WHERE active = true`, mas `taken` conta TODOS os logs (sem filtro de protocolo). Protocolo finalizado (ex: antibiótico 7d → `active=false`) some do denominador mas seus logs ficam no numerador → `taken > expected` → **`adherence_percentage > 100%`** em dias passados (visto no sparkline "Adesão 30 Dias": 118%↓). Além disso a view **não tem clamp 0-100**. Migrar p/ `dose_instances` corrige na raiz (expected = ocorrências materializadas reais, taken = `status='taken'`, simétrico) — **mas garantir clamp e simetria expected/taken** explicitamente no aceite. Validar especificamente um usuário com protocolo one-shot finalizado no meio da janela.
- **⏰ LIMITES DE JANELA EM UTC REAL (AP-194, descoberto F3.2 S3.7):** ao reescrever as views/RPCs, os limites de janela (`fromTs`/`toTs`, "últimos N dias", fronteira de dia) DEVEM usar UTC real — em SQL, `now()`/`date_trunc` no tz correto; **NUNCA** `getNow()`/`getSaoPauloTime().toISOString()` do JS (desloca 3h e omite doses recentes). Se algum caller JS montar a janela, usar `getServerTimestamp()` (UTC real) + `addDays`, 1 chamada de timestamp. Janelas adjacentes com limites inclusivos precisam de teto exclusivo (ms-1) p/ não double-contar boundary.
- **🎯 CONVERGÊNCIA (ADR-054) — itens obrigatórios desta sprint:**
  - **Migrar `consultationDataService`** (`features/consultation/services/`): hoje usa `calculateAdherenceStats(logs, protocols, 30/90)` legado (±2h) p/ o sumário do PDF/consulta. Trocar por `adherenceService`/core instances. **Confirmado pós-F3 como o ÚLTIMO consumidor JS real** do `calculateAdherenceStats` (F3 já migrou mobile `_useTodayDerived` e web `_useDashboardDerived`; as 2 menções remanescentes em `_useDashboardDerived`/`logService` são só comentários) → depois dele, **aposentar `calculateAdherenceStats`** do core (+ barrel `utils/index.js`).
  - **Consulta mistura 3 fontes hoje** (`Consultation.jsx`: legado em dataService + view `getDailyAdherenceFromView` + `stats` instances do contexto). Pós-migração: tudo da mesma fonte. Validar que PDF == anel do dashboard.
  - **TESTE DE PARIDADE (trava schema drift, lição Sprint 7):** mesmo conjunto de `dose_instances` → `compute*FromInstances` (JS core) **==** resultado da view SQL. Sem isso, anel e relatório voltam a divergir.
  - Cartão de emergência: **sem adesão** (verificado F3.2b) — não tocar.
- **Deps:** S4.2, Fase 3 (PR-F3.2a)

### S4.3 — Web: HealthHistoryView event-agnóstica + registry de renderizadores ⚠️ muda UI
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `views/redesign/history/HealthHistoryView.jsx`, `HistoryDayPanel.jsx`, `HistoryLogCard.jsx` (→ renderizador por tipo), `HistoryKPICards.jsx`, CSS.
- **Spec:**
  - View consome `getTimeline` (S4.2). Renderização por **registry** `{ dose: DoseEventCard, ... }` indexado por `event.type` — adicionar tipo futuro = registrar um card, sem tocar a view.
  - Cross-meia-noite visível: missed/taken/pending na ordem real; dose 22:30 de ontem aparece em ontem.
  - R-117 (lazy view) · R-137/R-138 (acessibilidade idosa: peso de fonte, ícone+label) · `react-virtuoso` se a lista passar de 30 itens (R-115).
- **Aceite:** histórico renderiza a stream; trocar/registrar um tipo de card não exige editar a view; KPIs (taken/missed/aderência) batem com a F3.
- **Deps:** S4.2

### S4.4 — Web: fechamento de tz (G1) no caminho da timeline
- **Agent:** `claude` · **Modelo:** **opus** (cross-callsite sutil, double-shift — mesma classe da S1.3)
- **Files:** os callers de histórico/leitura que o S4.0 delimitou (injeção de `tz` em `getUserTime`/dateUtils).
- **Spec:** injetar o tz do usuário (de `user_settings.timezone`, F1) no fluxo de leitura/exibição da timeline e nos leitores da F3 que ainda usem SP-default. Documentar o residual que permanece SP-default (fora do escopo da timeline). Cuidado com double-shift (instante absoluto já é UTC; tz só governa o wall-clock exibido). **Ver AP-194:** `getSaoPauloTime()`/`getNow()` retornam Date no wall-clock SP — usar `.toISOString()` deles p/ comparar com coluna UTC desloca 3h. Limite de query/janela = UTC real (`getServerTimestamp()`); o tz só entra na DERIVAÇÃO do dia local p/ agrupar exibição, nunca no limite da query.
- **Aceite:** usuário em fuso ≠ SP vê dias/horas corretos na timeline; nenhum double-shift; residual SP-default documentado no MASTER.
- **Deps:** S4.3

### S4.4b — Multi-timezone para expat (Caminho B, ADR-053)
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `packages/core/src/schemas/userSettingsSchema.js` (`TIMEZONE_OPTIONS`), testes do schema.
- **Spec:** SÓ depois que a injeção de tz (S4.4) estiver fechada — antes disso, adicionar fuso ao enum **não muda o lembrete** (display/geração ainda SP). Estender `TIMEZONE_OPTIONS` com um punhado de destinos expat reais (`Europe/London`, `America/New_York`, `America/Lisbon`, `America/Los_Angeles`) além das 17 BR. DST resolvido pelo nome IANA via `Intl` (nunca por offset — offset≠identidade). Armazenar SEMPRE IANA. Não dropar a enum (Caminho C/IANA completo fica gated em "base expat > nacional", ADR-053). Manter ordenação BR-first.
- **Aceite:** brasileiro em Londres/NY persiste o fuso real; lembrete e fronteira-de-dia corretos no fuso local; schema Zod ↔ DB sincronizados (R-082); cidades BR de mesmo offset seguem distintas.
- **Deps:** S4.4 (injeção de tz fechada)

### S4.5 — Mobile: timeline paridade
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** tela de histórico mobile (S4.0 aponta) + cards por tipo.
- **Spec:** mesma `getTimeline`/builder do core; registry de renderizadores nativo; cross-meia-noite; R-166 (texto espelha web); R-169 (ViewSkeleton/lazy); sem Realtime (R-240).
- **Aceite:** histórico mobile = stream de eventos, paridade com web.
- **Deps:** S4.3 · **Smoke PO** (R-234).

### S4.6 — Testes Fase 4 (distribuídos)
- **Agent:** `claude` · **Modelo:** sonnet
- **Spec:** builder puro (S4.1), adapter+read (S4.2), view com registry (S4.3, mock service), tz (S4.4). ≤300 linhas/arquivo, cleanup (R-078), sem paralelismo vitest. Mobile Jest separado.
- **Aceite:** `rtk npm run validate:agent` verde.

---

## Consolidação em PRs

| PR | Sprints | Racional | Branch |
|----|---------|----------|--------|
| **PR-F4.1** | S4.0 + S4.1 + S4.2 + **S4.2b** (+testes) | modelo de evento + adapter + read + **rewrite das views legadas G6 (SQL, server-agg)** — **sem UI nova** | `feature/wave-f4/core-timeline` |
| **PR-F4.2** | S4.3 + S4.4 (+testes) | UI event-agnóstica + fecha G1 (tz) — **muda histórico visível** | `feature/wave-f4/web-timeline` |
| **PR-F4.3** | S4.5 (+testes) | paridade mobile | `feature/wave-f4/mobile-timeline` |

**Ordem:** S4.0 → S4.1 → S4.2 → **[G2 → PR-F4.1 → merge]** → S4.3 → S4.4 → **[G2 → PR-F4.2 → merge + smoke PO]** → S4.5 → **[G2 → PR-F4.3 → merge + smoke PO mobile]** → G3 fecha o refactor.

---

## Mapa de modelos

| Sprint | Agent | Modelo | Por quê |
|--------|-------|--------|---------|
| S4.0 | cavecrew-investigator | default | localizar/inventariar |
| S4.1 | claude | **opus** | modelo de dados aberto + ordenação tz, decisão de longo prazo |
| S4.2 | claude | sonnet | adapter + read service |
| S4.2b | claude | **opus** | rewrite SQL das views G6 + risco schema drift |
| S4.3 | claude | sonnet | UI + registry |
| S4.4 | claude | **opus** | tz cross-callsite, double-shift sutil (classe S1.3) |
| S4.5 | claude | sonnet | paridade nativa |
| S4.6 | claude | sonnet | testes |

> Sub-agentes: R-218 (branch+gate+report, nunca commit main/PR sem aprovação) + R-230 (brief). Revisor = Gemini no PR.

---

## SQP (R-221) — por PR

| Campo | PR-F4.1 | PR-F4.2 | PR-F4.3 |
|-------|---------|---------|---------|
| Plataforma | Shared/Core | Web/PWA + Shared/Core | Mobile |
| SemVer | **Patch** (views mudam fonte; saída igual) | **Minor** (timeline nova + tz) | **Minor** (mobile visível) |
| Version bump | `apps/web/package.json` (patch) | `apps/web/package.json` | `apps/mobile/app.config.js` APP_VERSION (R-182) |
| CHANGELOG | Shared/Core + Backend/Infra (views) | Web/PWA | Mobile |
| Store note | n/a | n/a | **sim** (R-244) |
| Migration | **sim — rewrite SQL das views G6** (grants+RLS) | não | não |
| Gates | lint 0 · `validate:agent` · **hard stop** | idem + **smoke PO** | idem + **smoke PO mobile** (R-234) |

**Hard stop (R-221 gate):** cada PR PARA antes de commit/push p/ validação humana. Gemini review → aplicar → **humano mergeia** (R-060). C5 pós-merge. **`/devflow distill` ao fechar a Fase 4 = fecha o refactor `dose_instances` inteiro** → RETRO + planning dos épicos (líquidos → diabetes, ADR-052).

---

## DoD da Fase 4
- [ ] Histórico é stream de eventos tipados, ordenada por instante absoluto, cross-meia-noite correta.
- [ ] Renderização por registry — novo `event.type` = registrar um card, sem tocar a view (FP-3 provado com tipo fake no teste).
- [ ] Adapter `dose_instances`→eventos isolado; logs avulsos não somem do histórico.
- [ ] G6 resolvido (S4.2b): views legadas leem `dose_instances`, **agregação server-side preservada** (sem regressão OOM em low-mid, R-249); Reports/PDF/Consultation intactos; sem caminho duplicado.
- [ ] G1 fechado no caminho da timeline; residual SP-default documentado; sem double-shift.
- [ ] Multi-tz expat (S4.4b/ADR-053): enum curado estendido APÓS injeção de tz; brasileiro em Londres/NY com lembrete e dia corretos; IANA armazenado (sem offset).
- [ ] Paridade web/mobile; `validate:agent` verde; smoke PO.

---

## Riscos
- **Double-shift de tz** (S4.4) — classe da S1.3; mitigar com testes de fuso ≠ SP + revisão opus.
- **Performance da stream** (muitos eventos) — `react-virtuoso` (R-115) + paginação (AP-186); janela default limitada (ex: 90d) com carga incremental.
- **Regressão visual do histórico** — smoke PO obrigatório; comparar KPIs com a F3.

---

## Encerramento do refactor (pós-F4)
Com F1+F2+F3+F4 mergeadas: bug das 22:30 resolvido ponta-a-ponta (escrita ancora, leitura coerente, timeline real). Fundação pronta para os épicos **líquidos → diabetes** (parede de unidade compartilhada + timeline event-agnóstica, ADR-052). Rodar `/devflow distill` final + RETRO de refactor.
