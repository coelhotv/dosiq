# Plano — Refatoração para `dose_instances` (Schedule-Anchored Doses)

> **Status:** Em execução — **Fases 1–2 completas · Fase 3 em fechamento · Fase 4 web pronta** (PR-F4.1 ✅ #620 + PR-F4.2 ✅ #621 mergeadas; falta PR-F4.3 timeline mobile).
> **Origem:** bug reportado pós-lançamento App Store — dose das 22:30 deixa de ser registrável após meia-noite.
> **Decisão arquitetural-mãe:** **ADR-048** (accepted) — tabela `dose_instances` materializada, modelo híbrido. **ADR-049** (accepted) — core tz-aware, fundação da Fase 1. **ADR-050** (accepted) — future-proofing diabetes (4 FPs). **ADR-051** (accepted) — motor em endpoint serverless dedicado isolado + geração due-only.
>
> **Progresso (2026-05-29):**
> - ✅ **Fase 1 / PR-F1.1** — core tz-aware (`getUserTime` + param tz default SP, non-breaking ~250 callers) · `user_settings.timezone` (migration em prod) · CON-022. Merged #597.
> - ✅ **Fase 1 / PR-F1.2** — seletor de fuso UI web+mobile + revalidação no launch mobile. Merged #598.
> - ✅ **Fase 2 / PR-F2.1** — schema `dose_instances` + motor de geração (`doseInstanceGenerator`) + repository (`createDoseInstanceRepository`). Migration aplicada em prod. Merged #599 (`b7d26b3f`). ADR-048 accepted.
> - ✅ **Fase 2 / PR-F2.2** — `doseInstancePlanner` (orquestração) + scheduler node-cron (dev) + lifecycle hooks em `createProtocolRepository` (pause/resume/scheduling-change, best-effort R-245). Merged #603 (`a6dc9a52`).
> - ✅ **Fase 2 / PR-F2.2.1** — endpoint serverless dedicado `api/generate-doses.js` (cron-job.org 1×/dia, isolado dos reminders) + geração due-only no DB + auth fail-closed. Merged #604 (`f8b207a7`). ADR-051.
> - ✅ **Hotfix** — `zodSetup.js` import ESM com extensão `.js` (motor prod-down `ERR_MODULE_NOT_FOUND`). Merged #605 (`1f6f933d`). AP-184.
> - ✅ **Validação de prod (29/05)** — cron-job.org → `200 {processed:34, generated:1140, cleaned:0, durationMs:2352}`. Supabase confirma: 1140 instâncias `pending` (janela 30d), 34/34 protocolos ativos com `generated_through`, 0 dupes. Motor materializando `dose_instances` end-to-end em prod.
> - ✅ **Fase 2 / PR-F2.3** — âncora de log: toda tomada (web `logService.create` + bot `<Tomar>`) liga `medicine_logs.dose_instance_id` via snap por tolerância (escopo protocol_id, nearest, cross-meia-noite) → instância vira `taken`. Best-effort (R-246), FP-1. Review Gemini: race no-op→elo órfão corrigido (AP-185). Merged #609 (`9b4857f5`). **Raiz do bug das 22:30 fechada na escrita.**
> - ✅ **Fase 2 / PR-F2.4** — backfill one-shot (#610, `46379b70`) + fix paginação (#611). **Executado em prod nos 15 usuários** (sub-agente Haiku + verificação MCP, AP-187): 1665 taken, 308 missed, 1118 pending, 0 dupes, taken===logs-com-elo. **Fase 2 fechada end-to-end.**
> - ⬜ **PR-F2.5** (writer #3) — sweep `pending→missed` no cron diário + `missed` re-ancorável (self-heal de registro retroativo). Fecha gap crítico AP-190 (missed só existia no backfill → adesão inflada). **Pré-requisito da F3.2a.**
> - 🔄 **Fase 3** — leitura: adesão/dashboard/bot ← `dose_instances`. Spec: [EXEC_SPECS_PHASE_3.md](./EXEC_SPECS_PHASE_3.md). **PR-F3.1 ✅ merged #612** (core reader). PR-F3.2 fatiado → **F3.2a (service)** + **F3.2b (dashboard)**. S3.5 (tabela mensal) **adiado** (nenhuma tela >1 ano). G6 (views legadas) **adiado p/ F4**.
> - 🔄 **Fase 4** — timeline event-agnóstica (FP-3) + fecha G1 (tz). Spec: [EXEC_SPECS_PHASE_4.md](./EXEC_SPECS_PHASE_4.md). Fundação dos épicos líquidos/diabetes. **PR-F4.1 ✅ merged #620 (2026-05-31, `0b035305`)** — core event-model (`timeline.js` builder puro) + adapter `doseInstancesToEvents` + `timelineService.getTimeline` + **rewrite SQL das views G6** (`v_daily_adherence`/`v_adherence_heatmap` ← `dose_instances`, server-agg preservada, clamp 0-100, `security_invoker`). R-252, CON-023, AP-200/201. **G6 fechado.** **PR-F4.2 ✅ merged #621 (2026-05-31, `f9747e96`)** — Histórico web (`HealthHistory`) consome `timelineService.getMonthTimeline` (estados taken/missed/pending), registry por `event.type` (`DoseEventCard`/`eventCardRegistry` — FP-3), dots acumulados por status no calendário, navegação clampada (piso jan/2026, teto m+1), **G1 (tz) fechado no caminho da timeline** (`user_settings.timezone` ponta-a-ponta, hora do card no fuso do user — AP-194), unidade FP-4. web 3.6.3→3.7.0. **Falta PR-F4.3 (timeline mobile).**
>
> **Gaps abertos** (detalhe em EXEC_SPECS §Gaps): **G1** injeção de tz — **fechado no caminho da timeline (PR-F4.2/S4.4)**: leitura do histórico (`timelineService.getMonthTimeline`) resolve `user_settings.timezone` e injeta ponta-a-ponta; janela em UTC real, tz só na derivação do dia local (sem double-shift, AP-194). **Residual SP-default documentado:** os ~250 callers de `getUserTime`/dateUtils fora do fluxo da timeline (notificações, dashboard secundário, etc.) seguem em SP-default (CON-022, non-breaking) — refactor amplo NÃO faz parte da F4; multi-tz expat real (enum estendido) fica na S4.4b/ADR-053 · **G2** consistência tz geração↔leitura (mitigado por `timestamptz` absoluto) · **G3** frequência DB com acento (resolvido F2.1) · **G5** `adherenceLogic` duplicado core/web (✅ já era proxy core) · **G6** views de adesão legadas (`v_daily_adherence`/`v_adherence_heatmap`) — **✅ resolvido na F4 (S4.2b, PR-F4.1 #620)**: rewrite SQL `medicine_logs`→`dose_instances` preservando agregação server-side (R-249, motivo OOM low-mid), clamp 0-100 + simetria expected/taken (mata AP-191), `security_invoker` (AP-201) · **G7** produtor de eventos desacoplado (F4) · **G8** `packages/core` fora do pipeline vitest (sem config/script de teste próprio; `doseUnit.test.js` depende de globals e falha sob runner root; testes core rodam só por invocação explícita, **não** no `validate:agent`). **Decisão arquitetural (config de teste do core + integração ao gate) adiada para depois do refactor** — não bloqueia F3/F4; mitigar rodando `npx vitest run packages/core/...` explícito em todo PR que tocar core.
>
> **Future-proofing diabetes (ADR-050):** o refactor já constrói o esqueleto planned/applied que insulina bolus exige. 4 decisões baratas (FP-1..FP-4) deixam a arquitetura preparada **sem fundir o épico de diabetes aqui** — ver **§11**. Diabetes = épico próprio pós-refactor.

---

## 1. Problema

`medicine_logs` não tem âncora de schedule. Colunas: `taken_at`, `quantity_taken`, `protocol_id`, `medicine_id`, `notes`. Todo o sistema de adesão **infere** a qual slot uma dose pertence, casando `taken_at` contra `protocol.time_schedule` via janela ±2h.

Sintoma reportado: a dose das 22:30 some do dashboard e dos botões `<Tomar>` (web + mobile + PriorityCard) por volta da meia-noite.

Causa raiz: `classifyDose` (`useDoseZones.js:100`) e `expandProtocolsToDoses` constroem a dose ancorada em `getTodayLocal()` via `setHours`, sem cruzar meia-noite. A janela ±2h só existe no calendário (`adherenceLogic.evaluateDoseTimelineState`), não no dashboard. `isDoseInToleranceWindow` e `isProtocolFollowed` também quebram cross-day.

O bug é o sintoma mais visível de um modelo de dados que reconstrói intenção a partir do efeito.

---

## 2. Decisão arquitetural

**Tabela `dose_instances`** (materializa cada ocorrência agendada como linha, exista log ou não) — escolhida sobre coluna simples em `medicine_logs` pelo upside médio/longo prazo:

- Dose perdida vira **dado real** (`status='missed'`) — adesão é query, não cálculo.
- Notificação aponta `dose_instance.id` → **idempotente** (resolve acoplamento notificação↔dose).
- Estado por-ocorrência: pausada, pulada-de-propósito, notificada.
- `expected_dose` congelado por instância = versionamento de schedule **de graça** (instância passada é o snapshot histórico — dispensa audit table de protocolo para fins de adesão).

Trade-off aceito: maior raio de impacto e necessidade de motor de geração (mitigado por high-water-mark + geração JIT).

---

## 3. Schema

```sql
CREATE TABLE dose_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  protocol_id     uuid NOT NULL,
  scheduled_for   timestamptz NOT NULL,   -- instante absoluto (depende do tz do usuário)
  expected_dose   numeric NOT NULL,       -- dosagem esperada no momento (congela schedule)
  status          text NOT NULL DEFAULT 'pending',
                  -- pending | taken | missed | skipped_paused | skipped_user
  medicine_log_id uuid,                   -- FK p/ medicine_logs quando tomada
  tolerance_minutes int NOT NULL DEFAULT 120,  -- janela dinâmica (§6), computada na geração
  notified_at     timestamptz,            -- idempotência notificação
  snoozed_until   timestamptz,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT uq_instance UNIQUE (protocol_id, scheduled_for)  -- habilita upsert idempotente
);

-- Grants obrigatórios (CLAUDE.md — pós 30/10/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_instances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dose_instances TO service_role;
ALTER TABLE public.dose_instances ENABLE ROW LEVEL SECURITY;
-- + policy user_id = auth.uid()

-- medicine_logs ganha o elo (nullable p/ avulsas/PRN)
ALTER TABLE medicine_logs ADD COLUMN dose_instance_id uuid;

-- Rollup mensal (cold) — construído desde a v1, podar raw depois é não-destrutivo
CREATE TABLE dose_adherence_monthly (
  user_id      uuid NOT NULL,
  protocol_id  uuid NOT NULL,
  month        date NOT NULL,            -- 1º dia do mês
  expected     int NOT NULL,
  taken        int NOT NULL,
  missed       int NOT NULL,
  PRIMARY KEY (user_id, protocol_id, month)
);
```

**Status semântico para adesão:**
- `taken` → numerador + denominador
- `missed` → denominador
- `skipped_paused` → **neutro** (fora do denominador — pausa não penaliza)
- `skipped_user` → **neutro** (pulei de propósito ≠ esqueci)
- `pending` futuro → ainda não conta

---

## 4. Motor de geração

> **Caminho de produção (ADR-051):** o motor roda num **endpoint serverless dedicado** `api/generate-doses.js`, disparado por agendamento próprio do cron-job.org (1×/dia ~03:00), com invoke e orçamento de 60s **isolados** dos reminders (`api/notify.js`). O `node-cron` em `server/bot/scheduler.js` é **só paridade de DEV** — não dispara em prod serverless (AP-182). Isolamento porque notificação de dose é crítica/prioritária e não pode perder tempo para o motor.

Lógica de geração compartilhada (`@dosiq/core` — `doseInstancePlanner` + `doseInstanceGenerator`). Reusa `isProtocolActiveOnDate` + `FREQUENCY_MATCHERS` do core (já tratam `diario/dias_alternados/semanal/personalizado` — `personalizado` = weekday setting sobre `semanal`, PR #592). **Sem caso especial de frequência.**

Cada protocolo guarda `generated_through timestamptz` (high-water-mark).

| Gatilho | Ação |
|---------|------|
| Criar protocolo c/ `end_date` | Gera todas instâncias até `end_date` |
| Criar protocolo contínuo | Gera até `now+30d`; seta `generated_through` |
| Cron diário | Varre ativos cujo `generated_through` se aproxima do fim; **renova** a janela de 30d (upsert `ON CONFLICT DO NOTHING`). **Não** regera 30d pra todos todo dia |
| Editar protocolo (`time_schedule`, `dosage`, `frequency`) | Wipe `status='pending' AND scheduled_for > now()` → regera |
| Pausar (toggle `active=false`) | Marca pendentes próximas 24h como `skipped_paused`; grava `paused_at`. **Toggle não faz trabalho pesado.** |
| Pausado > 1 dia (detectado pelo cron) | Wipe future pending restante |
| Religar | High-water-mark regenera JIT na próxima leitura |
| Leitura crítica (dashboard / scheduler notif) | Se `generated_through < now` → gera o gap on-the-fly (**rede de segurança v1**) |
| Backfill (one-shot, só o usuário-histórico) | Gera instâncias passadas dos protocolos ativos/pausados/finalizados + casa logs ±2h; órfão sem schedule = round-down (21:58→21:00) |
| Rollup mensal (cron mensal) | Agrega mês fechado em `dose_adherence_monthly` |

**Regras invioláveis do wipe:**
```sql
DELETE FROM dose_instances
WHERE protocol_id = $1
  AND status = 'pending'        -- nunca toca taken/missed/skipped
  AND scheduled_for > now();    -- nunca toca passado
```

---

## 5. Política de timezone (pré-requisito — Fase 1)

`scheduled_for` é instante absoluto → depende do fuso do usuário. Adicionar `user_settings.timezone` (Brasil multi-fuso: 2-3 zonas). **Tem que entrar antes de gerar qualquer instância** — senão grava no fuso errado e tudo precisa regerar. Substitui o hardcode `America/Sao_Paulo` (`dateUtils.js:165,201`).

---

## 6. Janela de tolerância dinâmica (recomendação clínica — Q-G)

Pesquisa valida: ±2h é o padrão de pesquisa clínica (MEMS). Adotar janela **derivada do intervalo de dosagem** (regra metade-do-intervalo, FDA), **teto em 2h**.

`tolerance_minutes = min(metade_do_menor_intervalo_adjacente, 120)` para protocolos diários multi-dose; janela fixa de 120min para não-diários (semanal/dias_alternados) e dose única.

| Frequência | Intervalo | Janela final (cap 2h) |
|-----------|-----------|----------------------|
| 1-4x/dia (≥4h entre doses) | ≥4h | **2h** (inalterado) |
| 3/3h | 3h | 1h30 |
| 2/2h | 2h | 1h |

**Ganho real não é afrouxar** — pra 99% dos casos (1-4x/dia) segue 2h. O dinâmico **impede sobreposição de janelas** entre doses adjacentes (hoje fixo ±2h com doses a cada 3h faz uma tomada casar com 2 slots — ambiguidade). Metade-intervalo elimina por construção.

**Complexidade baixa:** função pura sobre `time_schedule` ordenado. **Computa na geração e grava `tolerance_minutes` na própria `dose_instance`** — zero custo em runtime. Adicionar coluna:

```sql
ALTER TABLE dose_instances ADD COLUMN tolerance_minutes int NOT NULL DEFAULT 120;
```

Entra na fase de adesão (Fase 3); não bloqueia as anteriores.

### Follow-up (fora de escopo v1) — Strict tier por classe terapêutica → **FP-2 (ADR-050)**
Adiado: aguarda opinião médica (usuário buscando contato na rede pessoal). Base ANVISA tem `therapeuticClass` (6807 meds, 410 classes, texto livre) — sinal **ruidoso**: `Antiretroviral` vem limpo (28 meds), mas imunossupressor espalhado em ~6 variantes e **insulina não é separável por classe** (enterrada em `Antidiabeticos`, misturada com orais flexíveis). Quando houver validação clínica: seed curado pequeno (allowlist por classe + princípio ativo) → janela estrita ±30-60min, **override por medicamento**, classe como sugestão nunca aplicação silenciosa.

**FP-2 (ADR-050) — insulina basal é o caso de uso do strict tier.** A coluna `tolerance_minutes` já é **por instância** (não global) → o strict tier vira apenas uma regra de cálculo na geração, plugável depois **sem tocar schema**. Regra de ouro nas Fases 3/4: **nunca hardcodar 120 em runtime de leitura** — sempre ler `dose_instances.tolerance_minutes`.

---

## 7. Retenção / Archiving

Volume por usuário é **linear e pequeno** (~16k linhas em 3 anos). Eixo de escala real = usuários × tempo.

- **Hot:** `dose_instances` raw — **18 meses** (folga sobre os 365d que o streak exige, `adherenceLogic.js:137`).
- **Cold (rollup):** `dose_adherence_monthly` — agregados, **pra sempre** (linhas minúsculas), powers tendência longa + PDF médico.
- **Construir o rollup desde a v1** mesmo sem podar — poda futura de raw vira non-destructive.
- **Não deletar histórico** em app de medicação (risco clínico/legal). Particionamento por mês quando virar problema de escala.

---

## 8. Faseamento (4 Fases sequenciais)

### Fase 1 — Timezone (fundação)
- `user_settings.timezone` + UI de seleção
- Refatorar `dateUtils` para usar tz do usuário em vez de SP hardcoded
- **Revalidar tz a cada app launch:** lê tz do device → compara com setting. Mudou (ex: viagem Manaus↔SP) → atualiza + dispara wipe/regen das instâncias `pending` futuras (mecânica do edit de protocolo). Passadas/tomadas intactas.
- `taken_at` permanece instante absoluto (UTC); tz só dá referência de interpretação — não grava offset no log
- Sem mudança de comportamento visível ainda; pré-req de tudo
- **Entregável/testável isolado**

### Fase 2 — Tabela `dose_instances` + motor
- Migration: `dose_instances`, `dose_adherence_monthly`, `medicine_logs.dose_instance_id`, `protocols.generated_through`, `protocols.paused_at`
- Motor de geração em `server/bot/scheduler.js` (gatilhos da §4)
- Rede de segurança lazy (high-water-mark JIT)
- Backfill one-shot (script, só usuário-histórico)
- Escrita de log popula `dose_instance_id` (web LogForm, mobile, bot `doseActions.js`, FAB web, bulk)
- FAB flexível: snap em runtime → null se fora da janela (avulsa)

### Fase 3 — Adesão / streak por scheduled-time
- `isProtocolFollowed`, `calculateAdherenceStats`, `getCurrentStreak`, `isDoseInToleranceWindow` passam a ler `dose_instances`
- Janela clínica dinâmica derivada do intervalo (§6) — **ler `tolerance_minutes` por instância, nunca 120 hardcoded (FP-2)**
- Recálculo histórico muda scores já vistos — **risco baixo**: adesão já é dinâmica (muda ao longo do dia em multi-protocolo) e base é mínima (app recém-lançada). Sem necessidade de freeze/comunicação elaborada
- Rollup mensal ligado
- **FP-1 (ADR-050) — contrato planned↔applied:** a adesão compara `expected_dose` (planejada) vs `quantity_taken` (aplicada) **sem assumir igualdade**. Para v1 dos atuais (dose fixa) são iguais; para bolus futuro divergem. Não escrever lógica que pressuponha `aplicada == planejada`.
- **FP-4 (ADR-050) — semântica de unidade:** dose é expressa na unidade de administração (`medicines.dosage_unit`). A matemática de adesão **não pode cravar "comprimido"** — manter agnóstica à unidade (um "evento de dose" é tomado ou não; a quantidade é secundária à adesão binária e fica na unidade do medicamento).

### Fase 4 — UI timeline contínua (mata o bug visível)
- `useDoseZones` (web) + `_useTodayDerived` (mobile) → janela deslizante cross-dia
- Doses passam a ordenar/agrupar por `scheduled_for` (instante absoluto), não por string HH:mm
- **Padrão único nos dois modos:** seção fixa **"Pendências de ontem"** no topo da lista quando o relógio vira 0h, com as doses de ontem ainda dentro da janela
  - **Simple** (listão): seção carry-over no topo, depois o listão de hoje ordenado por `scheduled_for`
  - **Complex** (períodos Madrugada/Manhã/Tarde/Noite, day-bound): seção carry-over acima dos períodos; períodos de hoje inalterados
- Seção só aparece se houver dose de ontem na janela — caso comum (sem carry-over) renderiza idêntico ao dashboard de hoje
- Bug da meia-noite resolvido por construção
- **FP-3 (ADR-050) — timeline event-source-agnóstica:** modelar a lista como **eventos tipados** (`{ type: 'dose', occurred_at, payload }`) com a interface aberta a outros tipos (`'biomarker'`, `'note'`), ordenados por instante absoluto. Popular só `dose` agora; plugar `biomarkers_log` (glicemia) no épico de diabetes **sem reescrever** a timeline. **FP de maior valor/menor custo** — decidir o shape do evento agora custa ~nada e evita refactor da timeline depois.

---

## 9. Questões resolvidas no design

| # | Tema | Resolução |
|---|------|-----------|
| Q-A | Timezone | `user_settings.timezone`, pré-req Fase 1 |
| Q-B | Backfill histórico | One-shot, só usuário-histórico; órfão = round-down |
| Q-C | PRN (`quando_necessario`) | Não gera instância; log `dose_instance_id=null` |
| Q-D | Doses extras/avulsas | `dose_instance_id=null`; timeline renderiza sem quebrar |
| Q-E | Registro retroativo/manual | **Âncora original sempre travada** — editar `taken_at` não re-ancora. Reavalia status (fora da janela → `missed`). Alerta inline antes de salvar |
| Q-F | Versionamento schedule | `expected_dose` congelado por instância — sem audit table |
| Q-G | Janela tolerância | **v1:** dinâmica metade-intervalo (cap 2h), `tolerance_minutes` por instância. **Strict tier por classe adiado** (aguarda médico) |
| Q-H | Idempotência notificação | `dose_instances.id` + `notified_at` |
| Q-I | Offline / clock skew / tz | Revalidar tz no app launch (Fase 1); tz change → regen futuras. Server timestamp confiável a validar na Fase 2 |
| Q-J | Performance rollover | High-water-mark + query por janela; refetch à meia-noite |

---

## 10. Riscos / pontos de atenção

- **Motor de geração** vira infra com responsabilidade clínica — rede lazy é obrigatória, não opcional.
- **Wipe amplo demais** destrói histórico — regra `pending AND > now()` é inviolável.
- **Pausa** não pode gerar "missed" falsa — `skipped_paused` neutro desde a v1.
- **tz antes de gerar** — ordem não-negociável.

---

## 11. Future-proofing para diabetes (ADR-050) — preparar, não construir

O refactor `dose_instances` já constrói, por acaso, o esqueleto que insulina exige: `expected_dose` (planejada) ↔ `quantity_taken` (aplicada), ligados por `medicine_logs.dose_instance_id`. Para não pagar um "refactor do refactor" quando o épico de diabetes chegar, as fases restantes adotam **4 decisões baratas**. Detalhe e contexto em [ADR-050](../../.agent/memory/decisions/data_and_schema/ADR-050.md). **Diabetes em si NÃO é construído aqui** — é épico próprio, depois do refactor (ver draft corrigido em [draft_plan_diabetic_support.md](./draft_plan_diabetic_support.md)).

| FP | Decisão | Onde entra | Custo |
|----|---------|-----------|-------|
| **FP-1** | Contrato planned↔applied: `expected_dose` é sugestão editável, não valor fixo; adesão compara planejada vs aplicada sem assumir igualdade | Fase 3 (adesão) + já no LogForm | ~zero (campos já existem) |
| **FP-2** | Tolerância por protocolo: `tolerance_minutes` por instância; nunca hardcodar 120 em runtime. Basal de insulina = caso do strict tier (§6) | Fases 3/4 (leitura) | ~zero (coluna já existe) |
| **FP-3** | Timeline event-source-agnóstica: lista de eventos tipados (`dose`\|`biomarker`\|`note`) ordenados por instante absoluto; popular só `dose` agora | Fase 4 (timeline) | baixo (decisão de shape) |
| **FP-4** | Semântica de unidade: dose na unidade de administração (`medicines.dosage_unit`); adesão e estoque NÃO cravam suposição pill-cêntrica | Fase 3 (adesão) | baixo (disciplina) |

**Regra única para lembrar nas Fases 3 e 4:** uma dose é um **evento agendado, com tolerância própria e quantidade na unidade do medicamento, cuja aplicação pode divergir do plano**. Quem escrever a adesão/timeline assumindo "comprimido fixo, ±2h, aplicada=planejada" reintroduz as 3 paredes do diabetes.

### O que o épico de diabetes ainda terá de construir de verdade (não coberto pelos FPs)
- **Parede de unidades (UI/volume):** estoque por UI/volume (não contagem de cp), `formatDoseUnit` por unidade (hoje ADR-046 retorna sempre "unidade(s)"), limite Zod de `quantity_taken` revisto.
- **`biomarkers_log` (glicemia):** tabela + input fast-logging + render na timeline (habilitado por FP-3).
- **Validade biológica:** `stock.opened_at` + TTL (28-30d) + alerta dedicado (distinto de `expiration_date`).
- **(Opcional) CGM** via HealthKit/Google Fit — alto valor, alto custo nativo.
- **Linha SaMD:** registro passivo + relatório apenas; **nunca** calculadora de bolus (vira dispositivo médico regulado).
