# EXEC SPEC — Fase 3: Camada de Leitura (adesão/dashboard ← `dose_instances`)

> **Objetivo:** trocar a leitura de adesão e do "hoje" de **inferência** (`Σquantity_taken / expected`, casamento ±2h em runtime) para **consumo das ocorrências materializadas** (`dose_instances`: `taken`/`missed`/`pending`). É a fase que **torna o fix visível ao usuário** — a dose das 22:30 registrada após 00:00 aparece coerente na adesão e no histórico, sem slot fantasma.
> **Pré-requisitos:** Fase 1 (tz) + Fase 2 (schema·motor·âncora·backfill) ✅ fechadas e verificadas em prod. Passado materializado (backfill: 1665 taken / 308 missed / 1118 pending em 15 users).
> **ADRs:** ADR-048 (modelo) · ADR-049 (tz core) · ADR-050 (FP-1/FP-2/FP-4) · **ADR-052** (3 seams desta fase).
> **Status:** ⬜ planejada (não iniciada).

---

## 📊 Status de execução (atualizar ao entregar)

| PR | Sprints | Status | Ref |
|----|---------|--------|-----|
| **PR-F3.1** core reader + agregação | S3.0–S3.2 | ⬜ pendente | sem mudança de comportamento (puro + read API) |
| **PR-F3.2** web adesão + dashboard | S3.3–S3.5 | ⬜ pendente | **muda leitura** (visível ao usuário) |
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
- **G5 — `adherenceLogic` duplicado.** Existe em `packages/core/src/utils/adherenceLogic.js` **e** `apps/web/src/utils/adherenceLogic.js`. A F3 consolida no core (fonte única, R-231/R-082); web passa a re-exportar. Verificar no S3.0 qual é o canônico e quem importa cada um.
- **G6 — view de adesão legada.** `adherenceService` já tem `getDailyAdherenceFromView`/`getAdherencePatternFromView` (lê de uma VIEW SQL de inferência). Decidir no S3.0: substituir a view por leitura de `dose_instances`, ou apontar a view para a nova tabela. **Não** manter dois caminhos divergentes (schema drift, lição Sprint 7).

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

### S3.3 — Web: `adherenceService` lê de instâncias ⚠️ muda comportamento
- **Agent:** `claude` · **Modelo:** **opus** (13 métodos, superfície ampla, regressão de adesão é crítica)
- **Files:** `apps/web/src/services/api/adherenceService.js`; consolidar `apps/web/src/utils/adherenceLogic.js` → re-export do core (G5).
- **Spec:**
  - `calculateAdherence`/`calculateProtocolAdherence`/`calculateAllProtocolsAdherence`/`getCurrentStreak`/`getDailyAdherence`/`getAdherenceSummary` passam a consultar `dose_instances` via core (S3.1+S3.2) em vez de inferir. **Assinaturas preservadas** (CON — non-breaking; consumidores não mudam).
  - `getDailyAdherenceFromView`/`getAdherencePatternFromView` (G6): apontar para `dose_instances` ou aposentar — sem caminho duplicado.
  - Modo de adesão (Seam B): default `binary`; respeitar `protocols.adherence_mode` quando presente.
  - Cache (R-125): manter a estratégia de cache existente; invalidar nas chaves certas (matriz explícita, R-236; evitar AP-168).
- **Aceite:** todos os métodos retornam valores de `dose_instances`; adesão de um protocolo conhecido bate com a contagem SQL direta (validar via Supabase MCP num user real pós-merge); sem schema drift Zod/SQL.
- **Deps:** S3.1, S3.2

### S3.4 — Web: dashboard "hoje" ← instâncias ⚠️ muda comportamento
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `apps/web/src/features/dashboard/hooks/_useDashboardDerived.js`, `components/TreatmentAccordion.jsx` (+ o que o S3.0 apontar).
- **Spec:** doses do dia (pendentes/tomadas, `nextDose`, `urgentDoses`) derivam de `dose_instances` (`pending`/`taken` na janela do dia no tz do usuário). A dose das 22:30 de ontem registrável às 00:05 aparece ancorada em ontem (não cria slot de hoje). Botão "Tomar" usa o `id` da instância (âncora direta, complementa o snap da F2.3).
- **Aceite:** cenário 22:30→00:05 visível correto; pendentes do dia = instâncias `pending` da janela; sem dupla-contagem.
- **Deps:** S3.3

### S3.5 — `dose_adherence_monthly` (decisão + wiring)
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** writer (hook de escrita de dose / cron) + reader no `adherenceService`; migration só se faltar índice.
- **Spec:** a tabela existe (F2.1) mas está **virgem**. Decidir no S3.0/planning:
  - **(a)** popular agregação mensal (writer no cron `generate-doses` ou no markTaken) + reader rápido para telas de histórico longo; **ou**
  - **(b)** computar on-the-fly de `dose_instances` e **adiar** a tabela (YAGNI até a leitura mensal pesar).
  - Recomendação: **(b)** salvo se o S3.0 achar tela que varre >1 ano (aí (a)). Registrar a decisão.
- **Aceite:** decisão documentada; se (a), agregação idempotente + paginada (AP-186); se (b), nota no MASTER de que a tabela segue reservada.
- **Deps:** S3.3

### S3.6 — Mobile: paridade de leitura
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `apps/mobile/src/features/dashboard/services/dashboardService.js`, `components/AdherenceRing.jsx`, `AdherenceDayCard.jsx`.
- **Spec:** consumir a mesma lógica core (S3.1) via `@dosiq/core`. Adesão/ring/day-card de `dose_instances`. R-166 (texto espelha web). Sem Realtime (R-240); throttled focus-refresh.
- **Aceite:** ring/day-card refletem instâncias; paridade numérica com web.
- **Deps:** S3.3 · **Smoke PO antes do PR** (R-234, `feedback_po_smoke_before_pr`).

### S3.7 — Bot Telegram: paridade de leitura
- **Agent:** `claude` · **Modelo:** sonnet
- **Files:** `server/bot/_adherenceHelpers.js` (+ comandos que mostram adesão: `/status`, `/hoje`).
- **Spec:** adesão/streak do bot de `dose_instances` via core. Manter formatação MarkdownV2 (R-031). `escapeMarkdownV2`.
- **Aceite:** `/status` e `/hoje` refletem instâncias; números batem com web.
- **Deps:** S3.3

### S3.8 — Testes Fase 3 (distribuídos)
- **Agent:** `claude` · **Modelo:** sonnet
- **Spec:** unit do leitor core (S3.1), agregação repo (S3.2), adherenceService (S3.3, mock Supabase), derived dashboard (S3.4). ≤300 linhas/arquivo, cleanup obrigatório (R-078), sem paralelismo vitest (`feedback_no_parallel_vitest`). Mobile: Jest (jest-expo) — **nunca** misturar `vi`/`jest` entre workspaces.
- **Aceite:** `rtk npm run validate:agent` verde.

---

## Consolidação em PRs

| PR | Sprints | Racional | Branch |
|----|---------|----------|--------|
| **PR-F3.1** | S3.0 + S3.1 + S3.2 (+testes) | core puro + read API — **sem mudança de comportamento** (nada chama ainda) → merge seguro | `feature/wave-f3/core-reader` |
| **PR-F3.2** | S3.3 + S3.4 + S3.5 (+testes) | web passa a ler de instâncias — **comportamento visível muda** | `feature/wave-f3/web-read` |
| **PR-F3.3** | S3.6 + S3.7 (+testes) | paridade mobile + bot | `feature/wave-f3/mobile-bot` |

**Ordem:** S3.0 → S3.1 → S3.2 → **[G2 → PR-F3.1 → merge]** → S3.3 → S3.4 → S3.5 → **[G2 → PR-F3.2 → merge + validação prod via MCP]** → S3.6 ∥ S3.7 → **[G2 → PR-F3.3 → merge]**.

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

| Campo | PR-F3.1 | PR-F3.2 | PR-F3.3 |
|-------|---------|---------|---------|
| Plataforma | Shared/Core | Web/PWA + Shared/Core | Mobile + Backend/Infra |
| SemVer | `no-user-impact` (read API sem consumidor) | **Minor** (adesão/hoje mudam de fonte; sem breaking) | **Minor** (mobile/bot visível) |
| Version bump | Não | `apps/web/package.json` | `apps/mobile/app.config.js` APP_VERSION (R-182 paridade) |
| CHANGELOG | entrada Shared/Core | entrada Web/PWA | entradas Mobile + Backend/Infra |
| Store note | n/a | n/a (web) | **sim** — derivar do changelog (R-244) |
| Migration | não (ou índice no S3.5a) | não | não |
| Gates | lint 0 · `validate:agent` · **hard stop humano** antes de commit | idem + **smoke PO** (UI) | idem + **smoke PO mobile** (R-234) |
| Contratos | CON de `adherenceService` preservado (non-breaking) | idem | idem |

**Hard stop (R-221 gate):** cada PR PARA antes de commit/push aguardando validação humana. Pós-PR: Gemini review → aplicar → **humano mergeia** (R-060). C5 pós-merge (AP/R/ADR + journal + state). `/devflow distill` ao fechar a fase.

**Validação de prod (pós PR-F3.2):** via Supabase MCP, conferir que a adesão exibida bate com `count(*) FILTER (status='taken')/(taken+missed)` para um user real — o mesmo padrão de verificação do backfill (AP-187).

---

## DoD da Fase 3
- [ ] Adesão (web/mobile/bot) lida de `dose_instances`, não inferida.
- [ ] Dose 22:30→00:05 coerente no "hoje" e na adesão (fix visível).
- [ ] Modo de adesão por protocolo operante (binary default; dose_exactness opt-in).
- [ ] `adherenceLogic` dedup (core canônico).
- [ ] Sem schema drift Zod/SQL; sem caminho de leitura duplicado (view legada resolvida).
- [ ] Seams A/B/C honrados (sem pill-centrismo cravado).
- [ ] `validate:agent` verde; smoke PO web+mobile; validação prod via MCP.

---

## Riscos
- **Regressão de número de adesão** (usuários veem % diferente do histórico). Mitigar: comparar amostra pré/pós via MCP; comunicar que a adesão agora reflete a verdade ancorada (missed real vs inferido).
- **tz boundary** (G1 parcial) — mitigado por instante absoluto; fechado na F4.
- **Performance** de leitura por instâncias vs view agregada — medir; S3.5 decide tabela mensal se pesar.
