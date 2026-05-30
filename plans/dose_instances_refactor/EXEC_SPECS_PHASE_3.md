# EXEC SPEC — Fase 3: Camada de Leitura (adesão/dashboard ← `dose_instances`)

> **Objetivo:** trocar a leitura de adesão e do "hoje" de **inferência** (`Σquantity_taken / expected`, casamento ±2h em runtime) para **consumo das ocorrências materializadas** (`dose_instances`: `taken`/`missed`/`pending`). É a fase que **torna o fix visível ao usuário** — a dose das 22:30 registrada após 00:00 aparece coerente na adesão e no histórico, sem slot fantasma.
> **Pré-requisitos:** Fase 1 (tz) + Fase 2 (schema·motor·âncora·backfill) ✅. **PR-F2.5** (sweep `pending→missed` no cron + missed re-ancorável) — **pré-requisito da F3.2a**: sem o writer #3, `missed` só existia no backfill e a adesão lida das instâncias degradava (AP-190). Passado materializado (backfill: 1665 taken / 308 missed / 1118 pending em 15 users).
> **ADRs:** ADR-048 (modelo) · ADR-049 (tz core) · ADR-050 (FP-1/FP-2/FP-4) · **ADR-052** (3 seams desta fase).
> **Status:** ⬜ planejada (não iniciada).

---

## 📊 Status de execução (atualizar ao entregar)

| PR | Sprints | Status | Ref |
|----|---------|--------|-----|
| **PR-F3.1** core reader + agregação | S3.0–S3.2 | ✅ merged #612 (`c4ed5531`) | `computeAdherence/StreakFromInstances` + `countByStatus`; R-248; Gemini perf (Promise.all) aplicado |
| **PR-F3.2a** adherenceService core | S3.3 (parcial) | ⬜ pendente | **muda leitura** dos escalares de adesão (calculate*/summary/streak/daily); views `*FromView` adiadas p/ F4 |
| **PR-F3.2b** dashboard "hoje" | S3.4 | ⬜ pendente | derived hook + fetch de `dose_instances` no contexto |
| **PR-F3.3** mobile + bot paridade | S3.6–S3.7 | ⬜ pendente | espelha web |
| (testes S3.8) | distribuídos | ⬜ | dentro de cada PR |

---

## 🎯 Princípio da fase

A adesão deixa de ser **calculada** (inferência sobre logs + expected) e passa a ser **consultada** (contagem de `dose_instances` por status numa janela). Cada ocorrência já carrega a verdade: `taken` (com elo a um log), `missed` (passou da tolerância sem tomada), `pending` (futura ou na janela), `skipped_*` (neutro para adesão).

```
Adesão(janela) = taken / (taken + missed)        ← modo "binário-evento" (default)
Exatidão(janela) = Σ quantity_taken / Σ expected_dose   ← modo "exatidão-de-dose" (opt-in por protocolo)
```

`skipped_paused`/`skipped_user` NUNCA entram no denominador (pausa/skip consciente não penaliza).

---

## ⚠️ Gaps e decisões desta fase

- **G1 — injeção de tz (parcial aqui, fechado na F4).** As leituras de "hoje"/janela precisam do fuso do usuário para fronteiras de dia corretas (`getUserTime`, CON-022). A F3 injeta tz **nas leituras de adesão/dashboard** (escopo controlado); a varredura completa dos ~250 callers fica na F4. Até lá, default SP onde tz não for injetado (ADR-049). **Risco:** boundary de dia errado em fuso ≠ SP → mitigado porque `scheduled_for` é `timestamptz` (instante absoluto) e a contagem por status independe de tz; só a *seleção da janela* "hoje" usa tz.
- **G5 — `adherenceLogic` duplicado.** ✅ **Já resolvido** (pré-F3): `apps/web/src/utils/adherenceLogic.js` é proxy `export * from '@dosiq/core'`; canônico = `packages/core/src/utils/adherenceLogic.js`. Nada a fazer.
- **G6 — views de adesão legadas → ADIADO PARA A F4.** `getDailyAdherenceFromView` (`v_daily_adherence`) e `getAdherencePatternFromView` (`v_adherence_heatmap`) inferem sobre `medicine_logs` e alimentam Reports/PDF/Consultation/HealthHistory — telas que a **F4 reescreve (timeline)**. **DECISÃO (2026-05-30):** não tocar essas views na F3; resolvê-las na F4 junto da timeline.
  - ⚠️ **RESTRIÇÃO CRÍTICA (motivo de existência das views):** foram criadas como **mitigação de OOM/loading em devices low-mid** — agregam **no servidor** (SQL), o client recebe ~28 linhas prontas, não N logs crus pra calcular (classe AP-P03/AP-P14, R-249). A resolução G6 na F4 **DEVE preservar a agregação server-side** (reescrever a FONTE da view `medicine_logs`→`dose_instances` em SQL, ou view materializada/RPC). **NUNCA** mover o cálculo long-range/heatmap para o client. `countByStatus` (head-count, server agrega) é o equivalente OOM-safe.

### Seams obrigatórios (ADR-052) — esta fase DEVE nascer com eles
- **Seam A — semântica de unidade:** `expected_dose`/`quantity_taken` são "quantidade na `medicines.dosage_unit`", **nunca** comprimidos. A matemática de adesão não pode cravar pill-centrismo (habilita líquidos/UI sem refactor-da-refactor).
- **Seam B — modo de adesão por protocolo:** `binário-evento` (default) vs `exatidão-de-dose` (opt-in). Coluna/flag por protocolo (ver S3.1). Bolus variável e refeição pulada quebram o denominador de exatidão — por isso o modo é seletável.
- **Seam C — cap Zod 100:** `quantity_taken ≤ 100` (R-022) é pill-specific; **não** propagar essa suposição para a leitura. Marcar para revisão por unidade (não alterar nesta fase).

---

## Sprints

### S3.0 — Preflight: inventário de leituras (investigator)
- **Agent:** `cavecrew-investigator` · **Modelo:** default
- **Objetivo:** mapear TODOS os pontos que leem/inferem adesão e "doses do dia", com caminho canônico (definição, não caller). Entregar tabela `arquivo:linha → o que lê → fonte atual (inferência) → fonte nova (instances)`.
- **Alvos a localizar (verificar definição vs caller):**
  - `apps/web/src/services/api/adherenceService.js` (13 métodos: `calculateAdherence`, `calculateProtocolAdherence`, `calculateAllProtocolsAdherence`, `getCurrentStreak`, `getLongestStreak`, `getAdherenceSummary`, `getDailyAdherence`, `getDailyAdherenceFromView`, `getAdherencePatternFromView`, `_*WithProtocols`).
  - `packages/core/src/utils/adherenceLogic.js` vs `apps/web/src/utils/adherenceLogic.js` (G5 — qual é canônico, quem importa).
  - `apps/web/src/features/dashboard/hooks/_useDashboardDerived.js` + `components/TreatmentAccordion.jsx` (doses do dia, `nextDose`, `urgentDoses`).
  - `apps/mobile/src/features/dashboard/services/dashboardService.js` + `components/AdherenceRing.jsx`, `AdherenceDayCard.jsx`.
  - `server/bot/_adherenceHelpers.js` (adesão no bot).
  - VIEW SQL de adesão (G6) — `list_tables`/migrations: nome + se lê `medicine_logs` por inferência.
  - `R-111`/`R-112`/`R-125` — regras de cálculo atuais a revisar.
- **Aceite:** inventário completo com caminhos canônicos confirmados por `find`/`grep`; decisão G5 (dedup) e G6 (view) registradas. **Nenhum código alterado.**
- **Deps:** —

### S3.2-prep relacionado — decisões do S3.0 a travar antes de codar
1. `adherenceLogic` canônico = core (web re-exporta). 2. View de adesão → ler `dose_instances` ou aposentar. 3. Onde mora a flag de **modo de adesão** (`protocols.adherence_mode`?).

### S3.1 — Core: leitor puro de adesão a partir de instâncias ⚠️ crítico
- **Agent:** `claude` · **Modelo:** **opus** (matemática de adesão + seam de modo, alto risco de regressão)
- **Files:** `packages/core/src/utils/adherenceLogic.js` (estender), testes em `__tests__/`.
- **Spec:**
  - `computeAdherenceFromInstances(instances, { mode })` puro → `{ taken, missed, pending, skipped, rate }`.
    - `mode='binary'` (default): `rate = taken / (taken + missed)` (pending e skipped fora do denominador).
    - `mode='dose_exactness'`: `rate = Σ quantity_taken / Σ expected_dose` (FP-1: não exige igualdade; clamp 0..1; Seam B).
  - `computeStreakFromInstances(instances)` → streak de dias consecutivos sem `missed` (dias só com `taken`/`skipped`/sem dose).
  - **Seam A:** somas em `dosage_unit`, sem suposição de comprimido. **Seam C:** não validar contra cap 100.
  - DST/tz: agrupamento por dia usa `scheduled_for` (instante absoluto) + tz do usuário só para fronteira de dia.
- **Aceite:** funções puras, sem I/O; testes cobrem binary, dose_exactness, skipped neutro, streak com `missed` quebrando, janela cross-meia-noite, denominador vazio → rate null (não NaN).
- **Deps:** S3.0

### S3.2 — Core/repo: API de leitura agregada + rede lazy
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `packages/core/src/repositories/createDoseInstanceRepository.js` (estender), `packages/core/src/services/doseInstancePlanner.js` (já tem `ensureInstancesUpTo`), testes.
- **Spec:**
  - `getWindow(userId, fromTs, toTs)` já existe → base. Adicionar `countByStatus({ userId, protocolId?, fromTs, toTs })` (agregação por status, usada pela adesão) — paginado se necessário (**AP-186**).
  - **Rede lazy:** leituras críticas chamam `ensureInstancesUpTo({ protocol, doseInstanceRepo, ts: now, tz })` **best-effort** antes de ler (cobre janela ainda não gerada pelo cron). Nunca bloquear a leitura por erro de geração (R-245).
- **Aceite:** agregação correta + paginada; lazy net invocada nos leitores; testes de contagem por status + idempotência da lazy.
- **Deps:** S3.1

### S3.3 — Web: `adherenceService` lê de instâncias ⚠️ muda comportamento → **PR-F3.2a**
- **Agent:** `claude` · **Modelo:** **opus** (superfície ampla, regressão de adesão é crítica)
- **Files:** `apps/web/src/services/api/adherenceService.js`; `packages/core/src/utils/adherenceLogic.js` (+`computeLongestStreakFromInstances` — streak math no core, fonte única) + barrel.
- **Spec (escopo PR-F3.2a):**
  - `calculateAdherence`/`calculateProtocolAdherence`/`calculateAllProtocolsAdherence`/`getCurrentStreak`/`getLongestStreak`/`getAdherenceSummary`/`getDailyAdherence` (+`_*WithProtocols`) passam a consultar `dose_instances` via core (S3.1+S3.2). **Assinaturas preservadas** (CON-011/CON-018 non-breaking; muda a SEMÂNTICA: `expected` = `taken+missed` real, não inferido).
  - **OOM-safe (R-249):** escalares usam `countByStatus` (head-count server-agg); summary/streak/daily usam `getWindow` com **colunas enxutas** sobre janelas curtas (7–90d, volume bounded < fetch de logs atual). Não puxar long-range cru pro client.
  - `getDailyAdherenceFromView`/`getAdherencePatternFromView`: **NÃO TOCAR** — views server-agg adiadas p/ F4 (G6).
  - Modo de adesão (Seam B): default `binary`. `protocols.adherence_mode` **não existe ainda** → `dose_exactness` fica como opt-in futuro (sem migration nesta PR).
  - Cache (R-125): assinaturas iguais → chaves de cache intactas (R-236; evitar AP-168).
- **Aceite:** métodos escalares/summary/streak/daily retornam de `dose_instances`; adesão de um protocolo conhecido bate com contagem SQL direta (validar via Supabase MCP num user real pós-merge — AP-187); sem schema drift Zod/SQL. **Smoke PO** (números mudam).
- **Deps:** S3.1, S3.2 (✅ PR-F3.1)

### S3.4 — Web: dashboard "hoje" ← instâncias ⚠️ muda comportamento → **PR-F3.2b**
- **Agent:** `claude` · **Modelo:** sonnet
- **Nota:** o derived hook hoje deriva de `logs`+`protocols` já no contexto; consumir `dose_instances` exige adicionar fetch da janela do dia ao `useDashboardContext` (janela curta, OOM-safe).
- **Files:** `apps/web/src/features/dashboard/hooks/_useDashboardDerived.js`, `components/TreatmentAccordion.jsx` (+ o que o S3.0 apontar).
- **Spec:** doses do dia (pendentes/tomadas, `nextDose`, `urgentDoses`) derivam de `dose_instances` (`pending`/`taken` na janela do dia no tz do usuário). A dose das 22:30 de ontem registrável às 00:05 aparece ancorada em ontem (não cria slot de hoje). Botão "Tomar" usa o `id` da instância (âncora direta, complementa o snap da F2.3).
- **Aceite:** cenário 22:30→00:05 visível correto; pendentes do dia = instâncias `pending` da janela; sem dupla-contagem.
- **Deps:** S3.3

### S3.5 — `dose_adherence_monthly` — ✅ DECISÃO TOMADA: ADIAR (Caminho b)
- **Decisão (2026-05-30):** **(b) adiar a tabela** — computar on-the-fly de `dose_instances`. Inventário S3.0 confirmou: **nenhuma tela varre >1 ano** (períodos máximos 7d/30d/90d). A tabela `dose_adherence_monthly` (criada vazia na F2.1) segue **reservada/virgem** até a leitura mensal pesar (YAGNI). Sem writer, sem reader, sem migration nesta fase.
- **Nota no MASTER:** tabela reservada; reavaliar (a) se surgir tela de histórico anual/multi-ano.

### S3.6 — Mobile: paridade de leitura
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `apps/mobile/src/features/dashboard/services/dashboardService.js`, `components/AdherenceRing.jsx`, `AdherenceDayCard.jsx`.
- **Spec:** consumir a mesma lógica core (S3.1) via `@dosiq/core`. Adesão/ring/day-card de `dose_instances`. R-166 (texto espelha web). Sem Realtime (R-240); throttled focus-refresh.
- **Aceite:** ring/day-card refletem instâncias; paridade numérica com web.
- **Deps:** S3.3 · **Smoke PO antes do PR** (R-234, `feedback_po_smoke_before_pr`).

### S3.6.1 — Mobile: garantir `taken_at` pretendido no registro retroativo (self-heal F2.5)
- **Nota (não esquecer):** o FAB de dose mobile permite selecionar **data/hora** → registro retroativo. Para o **self-heal** da F2.5 funcionar (reverter `missed→taken`), o registro DEVE enviar `taken_at` = horário **pretendido** (não `now()`). Se cair dentro da tolerância da instância `missed`, a âncora reverte pra `taken`; senão (genuinamente tardio) segue missed (E1). Validar no smoke mobile.

### S3.7 — Bot Telegram: paridade de leitura
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `server/bot/_adherenceHelpers.js` (+ comandos que mostram adesão: `/status`, `/hoje`, **relatório diário 23h**).
- **Spec:** adesão/streak do bot de `dose_instances` via core. Manter formatação MarkdownV2 (R-031). `escapeMarkdownV2`.
  - ⚠️ **Relatório 23h (E2/R-208):** ao migrar pra instances, o relatório das 23h lê o dia corrente ANTES do sweep das 3AM → doses vencidas cedo no dia ainda `pending`. **Rodar `sweepMissedInstances()` antes do relatório 23h** (idempotente) pra fechar o dia. Doses ainda na tolerância à noite (ex. 22:30) corretamente seguem pending.
- **Aceite:** `/status`, `/hoje` e relatório 23h refletem instâncias; números batem com web.
- **Deps:** S3.3

> ⚠️ **Divergência cross-plataforma (janela entre F3.2a e F3.3):** web já lê de `dose_instances` (missed real); mobile/bot ainda inferem ±2h até a F3.3. O **mesmo usuário pode ver % de adesão diferente entre web e mobile/bot** nesse intervalo. Avisar o PO no smoke — não é bug.

### S3.8 — Testes Fase 3 (distribuídos)
- **Agent:** `claude` · **Modelo:** sonnet
- **Spec:** unit do leitor core (S3.1), agregação repo (S3.2), adherenceService (S3.3, mock Supabase), derived dashboard (S3.4). ≤300 linhas/arquivo, cleanup obrigatório (R-078), sem paralelismo vitest (`feedback_no_parallel_vitest`). Mobile: Jest (jest-expo) — **nunca** misturar `vi`/`jest` entre workspaces.
- **Aceite:** `rtk npm run validate:agent` verde.

---

## Consolidação em PRs

| PR | Sprints | Racional | Branch |
|----|---------|----------|--------|
| **PR-F3.1** | S3.0 + S3.1 + S3.2 (+testes) | core puro + read API — **sem mudança de comportamento** (nada chama ainda) → merge seguro | `feature/wave-f3/core-reader` |
| **PR-F3.2a** | S3.3 (+testes) | `adherenceService` escalares/summary/streak/daily ← instâncias — **muda números** | `feature/wave-f3/web-adherence` |
| **PR-F3.2b** | S3.4 (+testes) | dashboard "hoje" ← instâncias (fetch no contexto) | `feature/wave-f3/web-dashboard` |
| **PR-F3.3** | S3.6 + S3.7 (+testes) | paridade mobile + bot | `feature/wave-f3/mobile-bot` |

> **Fatiamento (2026-05-30):** PR-F3.2 dividido em **F3.2a (service)** + **F3.2b (dashboard)** — superfície ampla (~8 consumidores), cada fatia com smoke/validação focada, menos blast-radius por merge. **S3.5 adiado** (não vira PR). **G6 adiado p/ F4.**

**Ordem:** ✅[PR-F3.1] → S3.3 → **[PR-F3.2a → merge + valid prod MCP]** → S3.4 → **[PR-F3.2b → merge + smoke PO]** → S3.6 ∥ S3.7 → **[PR-F3.3 → merge]**.

---

## Mapa de modelos

| Sprint | Agent | Modelo | Por quê |
|--------|-------|--------|---------|
| S3.0 | cavecrew-investigator | default | localizar/inventariar |
| S3.1 | claude | **opus** | matemática de adesão + seam de modo |
| S3.2 | claude | sonnet | repo agregação + lazy |
| S3.3 | claude | **opus** | 13 métodos, regressão crítica |
| S3.4 | claude | sonnet | wiring dashboard |
| S3.5 | claude | sonnet | decisão + agregação |
| S3.6, S3.7 | claude | sonnet | paridade espelhada |
| S3.8 | claude | sonnet | testes |

> Sub-agentes seguem R-218 (branch + gate + reportam; nunca commit na main/PR sem aprovação do principal) e R-230 (brief padrão). Revisor oficial = Gemini no PR (`feedback_no_cavecrew_review_gate`).

---

## SQP (R-221) — por PR

| Campo | PR-F3.1 | PR-F3.2a (service) | PR-F3.2b (dashboard) | PR-F3.3 |
|-------|---------|--------------------|----------------------|---------|
| Plataforma | Shared/Core | Web/PWA + Shared/Core | Web/PWA | Mobile + Backend/Infra |
| SemVer | `no-user-impact` ✅ | **Minor** (adesão muda de fonte) | **Minor** ("hoje" muda de fonte) | **Minor** (mobile/bot visível) |
| Version bump | Não ✅ | `apps/web/package.json` | `apps/web/package.json` | `apps/mobile/app.config.js` APP_VERSION (R-182) |
| CHANGELOG | Shared/Core ✅ | Web/PWA | Web/PWA | Mobile + Backend/Infra |
| Store note | n/a | n/a | n/a | **sim** (R-244) |
| Migration | não ✅ | não | não | não |
| Gates | lint 0 · `validate:agent` ✅ | idem + **smoke PO** + valid prod MCP | idem + **smoke PO** | idem + **smoke PO mobile** (R-234) |
| Contratos | CON-011/018 ✅ | CON-011/018 preservados (semântica muda) | idem | idem |

**Hard stop (R-221 gate):** cada PR PARA antes de commit/push aguardando validação humana. Pós-PR: Gemini review → aplicar → **humano mergeia** (R-060). C5 pós-merge (AP/R/ADR + journal + state). `/devflow distill` ao fechar a fase.

**Validação de prod (pós PR-F3.2):** via Supabase MCP, conferir que a adesão exibida bate com `count(*) FILTER (status='taken')/(taken+missed)` para um user real — o mesmo padrão de verificação do backfill (AP-187).

---

## DoD da Fase 3
- [ ] Adesão (web/mobile/bot) lida de `dose_instances`, não inferida.
- [ ] Dose 22:30→00:05 coerente no "hoje" e na adesão (fix visível).
- [ ] Modo de adesão: `binary` default operante; `dose_exactness` fica opt-in futuro (coluna `adherence_mode` não criada nesta fase).
- [x] `adherenceLogic` dedup (core canônico) — G5 já resolvido.
- [ ] Sem schema drift Zod/SQL. Views legadas (`v_daily_adherence`/`v_adherence_heatmap`) **adiadas p/ F4** (G6) preservando agregação server-side (R-249).
- [ ] Seams A/B/C honrados (sem pill-centrismo cravado).
- [ ] `validate:agent` verde; smoke PO web+mobile; validação prod via MCP.

---

## Riscos
- **Regressão de número de adesão** (usuários veem % diferente do histórico). Mitigar: comparar amostra pré/pós via MCP; comunicar que a adesão agora reflete a verdade ancorada (missed real vs inferido).
- **tz boundary** (G1 parcial) — mitigado por instante absoluto; fechado na F4.
- **Performance** de leitura por instâncias vs view agregada — medir; S3.5 decide tabela mensal se pesar.
