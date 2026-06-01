# 💊 Arquitetura — `dose_instances` (modelo de doses persistido)

**Status:** Ativo (Fase 4 em curso) · **Criado:** 2026-06-01
**ADRs:** ADR-048, ADR-049, ADR-050, ADR-051, ADR-052, ADR-053, ADR-054
**Contratos:** CON-022, CON-023, CON-024
**Plano-mãe:** [`plans/dose_instances_refactor/MASTER_PLAN_REFACTOR_DOSE_INSTANCE.md`](../../plans/dose_instances_refactor/MASTER_PLAN_REFACTOR_DOSE_INSTANCE.md)

> Mudança arquitetural grande: a adesão, a timeline e os lembretes deixam de **inferir**
> doses a partir de `medicine_logs` + `time_schedule` e passam a **ler** ocorrências
> materializadas (`dose_instances`). Este documento descreve a solução, seus invariantes e
> os pontos de extensão.

---

## 1. Por quê (o problema do modelo inferido)

Antes, "que doses existem hoje" era derivado em runtime: para cada protocolo ativo, expandir
o `time_schedule` em slots e **casar** logs por proximidade (±2h). Esse modelo inferido tinha
bugs estruturais que reapareciam em cada superfície (web, mobile, bot):

- **Dose perdida não era dado** — era a ausência de um log dentro de uma janela; toda métrica
  recalculava por casamento, divergindo entre telas.
- **Cross-meia-noite** — uma dose de ontem 22:30 registrada às 00:05 casava com um slot de
  **hoje** (slot-fantasma), inflando/duplicando a agenda.
- **Tolerância fixa de 120min** — doses adjacentes (gap < 4h) faziam uma tomada casar com dois
  slots ao mesmo tempo (ambiguidade).
- **Acoplamento notificação↔dose** — o lembrete não tinha um identificador estável da
  ocorrência → idempotência frágil.
- **Sem versionamento de schedule** — editar horários reescrevia a base de cálculo do passado.

## 2. A solução

**Materializar cada ocorrência agendada como uma linha** em `dose_instances`, exista log ou
não. A dose perdida vira `status='missed'` (dado real); a adesão vira **query**, não cálculo;
a notificação aponta `dose_instance.id` (idempotente); cada instância congela sua
`expected_dose` (versionamento de schedule "de graça" — a instância passada é o snapshot
histórico, dispensando audit table para fins de adesão).

Trade-off aceito (ADR-048): maior raio de impacto + necessidade de um **motor de geração**,
mitigado por high-water-mark + geração JIT.

---

## 3. Schema

```sql
CREATE TABLE dose_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  protocol_id     uuid NOT NULL,
  scheduled_for   timestamptz NOT NULL,   -- instante absoluto (depende do tz do usuário)
  expected_dose   numeric NOT NULL,       -- dosagem congelada no momento da geração
  status          text NOT NULL DEFAULT 'pending',
                  -- pending | taken | missed | skipped_paused | skipped_user
  medicine_log_id uuid,                   -- elo p/ medicine_logs quando tomada
  tolerance_minutes int NOT NULL DEFAULT 120,  -- janela dinâmica (§6), computada na geração
  notified_at     timestamptz,            -- idempotência da notificação
  snoozed_until   timestamptz,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT uq_instance UNIQUE (protocol_id, scheduled_for)  -- habilita upsert idempotente
);
-- RLS user_id = auth.uid(); grants authenticated + service_role.

ALTER TABLE medicine_logs ADD COLUMN dose_instance_id uuid;   -- elo (nullable p/ avulsa/PRN)

CREATE TABLE dose_adherence_monthly (                          -- rollup mensal (cold)
  user_id uuid, protocol_id uuid, month date,
  expected int, taken int, missed int,
  PRIMARY KEY (user_id, protocol_id, month)
);

ALTER TABLE protocols ADD COLUMN generated_through timestamptz; -- high-water-mark
ALTER TABLE protocols ADD COLUMN paused_at timestamptz;
```

### Semântica de status para adesão (ADR-054)

| status | adesão |
|--------|--------|
| `taken` | numerador + denominador |
| `missed` | denominador |
| `skipped_paused` | **neutro** (pausa não penaliza) |
| `skipped_user` | **neutro** (pulei de propósito ≠ esqueci) |
| `pending` (futuro) | ainda não conta |

**Adesão = `taken / (taken + missed)`** — head-count server-side, imune ao truncamento do
PostgREST (`countByStatus`).

---

## 4. Motor de geração

**Caminho de produção (ADR-051):** endpoint serverless dedicado `api/generate-doses.js`,
disparado por agendamento próprio (~03:00), com invoke/orçamento **isolados** dos reminders
(`api/notify.js`) — geração não pode roubar tempo de notificação crítica. O `node-cron` em
`server/bot/scheduler.js` é só paridade de DEV (AP-182).

Lógica pura compartilhada em `@dosiq/core`:
- `doseInstanceGenerator.generateInstances(protocol, fromTs, toTs, tz)` — expande o schedule
  em instantes absolutos (`scheduled_for`) no `tz`, computa `tolerance_minutes` (§6) e
  `expected_dose`. Reusa `isProtocolActiveOnDate` + matchers de frequência (sem caso especial).
- `doseInstancePlanner` — orquestra geração ↔ persistência idempotente (`upsertMany` com
  `ON CONFLICT DO NOTHING`), high-water-mark e janela:
  - `planWindow({protocol, repo, fromTs, toTs, tz})` — gera + persiste + seta `generated_through`.
  - `renewProtocolWindow(...)` — cron: renova a janela de 30d quando o HWM se aproxima do fim.
  - `ensureInstancesUpTo(...)` — rede de segurança lazy: gera o gap até `ts` se descoberto.

`createDoseInstanceRepository` (core, factory web↔mobile) encapsula o I/O: `getWindow`,
`countByStatus`, `findAnchorInstance`, `markTaken`, `wipeFuturePending`, `getGeneratedThrough`,
`setGeneratedThrough`, `setPausedAt`, `markSkippedPaused`, `reactivateFuturePaused`.

### Gatilhos

| Gatilho | Ação |
|---------|------|
| Criar protocolo com `end_date` | Gera todas as instâncias até `end_date` |
| Criar protocolo contínuo | Gera até `now+30d`; seta `generated_through` |
| Cron diário | Renova janela de 30d só dos protocolos cujo HWM se aproxima do fim |
| Editar (`time_schedule`/`dosage`/`frequency`) | **Wipe** `pending AND scheduled_for > now` → regera de `now` p/ frente |
| Pausar (`active=false`) | Marca pendentes das próximas 24h como `skipped_paused` + `paused_at` (trabalho leve) |
| Pausado > 1 dia (cron) | Wipe do future pending restante |
| Religar | HWM regenera JIT na próxima leitura |
| Leitura crítica (dashboard/scheduler) | Se `generated_through < now` → gera o gap on-the-fly |
| Backfill (one-shot, escopado por `userId`) | Materializa o passado + casa logs; órfão = round-down |

**Regra inviolável do wipe** (e da geração): nunca toca `taken/missed/skipped` nem o passado.
A geração **clampa `fromTs = max(hwm, now)`** — não cria `pending` retroativo (evita
falso-missed). Consequência prática: adicionar um horário **já passado hoje** não materializa o
slot do dia corrente (reaparece amanhã); slots do mesmo dia ainda no futuro **são** gerados.

---

## 5. Janela de tolerância dinâmica (§6 / Q-G)

`tolerance_minutes = min(metade_do_menor_intervalo_adjacente, 120)` para diários multi-dose;
fixo 120 para não-diários e dose única. Computado **na geração** e gravado na própria instância
(zero custo em runtime). Não afrouxa o caso comum (1-4×/dia segue 2h) — **impede a sobreposição
de janelas** entre doses adjacentes (mata a ambiguidade do ±2h fixo). É o cutoff usado por
`classifyDose` para decidir quando uma pendente sai do actionável (espelha o sweep
`markMissedDueInstances`).

---

## 6. Timezone (ADR-049/053) — pré-requisito

`scheduled_for` é instante absoluto → depende do fuso do usuário. `user_settings.timezone`
(IANA, enum curado BR + expat — ADR-053) é a fonte de verdade; o core é tz-aware (CON-022,
`getUserTime`/`parseISO` param `tz`, default São Paulo). Armazenar **sempre o IANA** — DST
resolvido pelo nome via `Intl`, nunca por offset.

> **Estado atual (G1):** o tz do perfil já é injetado ponta-a-ponta no **Histórico** (timeline
> web, F4.2). A **geração** e o **"hoje"** (web `useDoseZones` + mobile `_useTodayDerived`)
> ainda usam São Paulo hardcoded (default) — fechamento pendente na sub-fase **F4.3f** (injeção
> no write-path + leitura do hoje + regen on tz-change). Janelas de query em **UTC real**; o tz
> só governa a derivação do dia local (sem double-shift — AP-194).

---

## 7. Leitura — três superfícies

Tudo lê a **fonte única** `dose_instances` (R-248), nunca mais infere sobre logs.

1. **Adesão / streak** (`adherenceService` web, `AdherenceRing` mobile) — `computeAdherenceFromInstances`/
   `computeStreakFromInstances` (core, ADR-052), head-count por status. Views SQL de relatório
   (`v_daily_adherence`, `v_adherence_heatmap`) reescritas para agregação server-side a partir de
   `dose_instances`, clamp 0-100, `security_invoker` (G6).

2. **Timeline event-agnóstica (FP-3 / ADR-050, CON-023)** — `packages/core/src/utils/timeline.js`
   (builder puro `buildTimeline(events, {tz, order})` + `groupByLocalDay` + `deriveLocalDay`;
   modelo `TimelineEvent = {id, type, occurred_at, payload}` com `type` string aberta) +
   `timelineService.doseInstancesToEvents(...)` (adapter puro `dose_instances`+`logs`→eventos
   `dose`, dedupe instância-ancorada=1 evento, AP-193). Plugar `biomarker`/`note` no futuro = um
   adapter + um card, **sem tocar o builder nem a UI**. Consumido pelo Histórico web (registry por
   `event.type`).

3. **Zonas de dose / "hoje" (CON-024)** — `packages/core/src/utils/doseZones.js` (puro,
   compartilhado web↔mobile, R-231):
   - `classifyDose(scheduledFor, now, …, toleranceMinutes)` → `done|late|now|upcoming|later|null`
     pelo **instante absoluto** (mata o cross-meia-noite), cutoff = tolerância da ocorrência.
   - `buildDoseItemsFromInstances(instances, protocols, tz)` → `DoseItem[]` (carrega `instanceId`,
     `status`, `scheduledFor`, HH:MM local, `toleranceMinutes`).
   - Web: `useDoseZones`/Dashboard. Mobile: `_useTodayDerived`/TodayScreen (timeline + turnos +
     card prioritário), filtrando à janela do dia local antes de montar a lista (AP-202).

---

## 8. Escrita — âncora log ↔ ocorrência

Ao registrar uma tomada, o `medicine_log` (fonte de verdade da tomada) é **ancorado** à
ocorrência: marca a instância `taken` + grava o elo bidirecional. Sem isso o log fica avulso →
instância segue `pending` → sweep marca `missed` → **falso-missed** (AP-193).

- **Determinístico por `instanceId`** (web `logService.create(log,{instanceId})`, mobile
  `registerDose(log,{instanceId})` / `registerDoseMany` com `instance_id` por entrada): quando a
  tomada parte de uma ocorrência conhecida (timeline/bulk), `markTaken(instanceId, logId)` direto.
  Se a marcação direta falhar (já `taken`/duplo-clique/id inválido) **não** cai no snap — ancorar
  noutra pendente legítima seria pior que ficar avulso.
- **Snap por tolerância** (fallback PRN/avulso): `findAnchorInstance({protocolId, takenAt})` por
  proximidade dentro da janela. Best-effort (R-245/246) — falha de âncora nunca bloqueia o
  registro nem o estoque.

A âncora original fica **travada** (Q-E): editar `taken_at` não re-ancora; reavalia status.

---

## 9. Mapa de código

| Camada | Arquivo |
|--------|---------|
| Geração (puro) | `packages/core/src/utils/doseInstanceGenerator.js` |
| Orquestração | `packages/core/src/services/doseInstancePlanner.js` |
| Repo I/O | `packages/core/src/repositories/createDoseInstanceRepository.js` |
| Lifecycle protocolo | `packages/core/src/repositories/createProtocolRepository.js` (`syncInstancesOnWrite`) |
| Adesão (puro) | `packages/core/src/utils/adherenceLogic.js` (`computeAdherenceFromInstances`, `computeStreakFromInstances`) |
| Timeline FP-3 | `packages/core/src/utils/timeline.js` + `packages/core/src/services/timelineService.js` |
| Zonas de dose | `packages/core/src/utils/doseZones.js` |
| Endpoint geração | `api/generate-doses.js` |
| Web — hoje | `apps/web/src/features/dashboard/hooks/useDoseZones.js` |
| Web — histórico | `apps/web/src/features/.../HealthHistory*` + `eventCardRegistry` |
| Web — escrita | `apps/web/src/shared/services/api/logService.js` |
| Mobile — hoje | `apps/mobile/src/features/dashboard/hooks/_useTodayDerived.js` |
| Mobile — escrita | `apps/mobile/src/features/dose/services/doseService.js` + modais |

---

## 10. Roadmap das fases

| Fase | Entrega | Status |
|------|---------|--------|
| 1 | Core tz-aware + `user_settings.timezone` + seletor UI (CON-022) | ✅ |
| 2 | Tabela + motor de geração + âncora de log + backfill | ✅ |
| 3 | Adesão/streak ← instâncias (core + web + mobile) | ✅ |
| 4.1 | Timeline FP-3 (modelo/builder/adapter) + views SQL G6 (CON-023) | ✅ |
| 4.2 | Histórico web ← timeline + estados reais + tz | ✅ |
| 4.3a | Zonas de dose extraídas p/ core (CON-024) | ✅ |
| 4.3b | Timeline do Hoje mobile ← instâncias | ✅ |
| 4.3c | Registro individual mobile ancora por `instanceId` | ✅ |
| 4.3d | Registro em lote por `instance_id` + Hero→bulk | ✅ |
| 4.3e | Carry-over "Pendências de ontem" (web+mobile) | ⬜ |
| 4.3f | Injeção de tz ponta-a-ponta (geração + hoje + regen) — fecha G1 | ⬜ |

---

## 11. Invariantes (não quebrar)

1. **Fonte única**: adesão/timeline/hoje leem `dose_instances`, nunca inferem sobre logs (R-248).
2. **Instante absoluto**: classificar/ordenar por `scheduled_for`, nunca por string HH:MM (AP-194).
3. **Wipe/geração** nunca tocam passado nem `taken/missed/skipped`; sem `pending` retroativo.
4. **Âncora best-effort**: log é a verdade; falha de âncora não bloqueia (R-245/246). Direto-por-id
   não cai no snap se falhar (AP-193).
5. **Builder/adapter/zonas são puros** (sem I/O); só services tocam o client. Reuso core (R-231).
6. **Janela em UTC real**; tz só deriva dia local. Armazenar IANA, DST por nome.

---

*Relacionados: [`ARQUITETURA.md`](../ARQUITETURA.md) · ADRs em `.agent/memory/DECISIONS_INDEX.md` ·
Contratos em `.agent/memory/CONTRACTS_INDEX.md`.*
