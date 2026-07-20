---
title: "Arquitetura de Dose Instances"
description: "Especificação da arquitetura e materialização de instâncias de doses persistidas (dose_instances) no Dosiq."
version: "1.0.0"
status: active
category: architecture
audience:
  - dev
  - agent
tags:
  - dose-instances
  - database
  - scheduler
created_at: "2026-06-01"
updated_at: "2026-06-02"
---

# 💊 Arquitetura — `dose_instances` (modelo de doses persistido)
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
  medicine_id     uuid NOT NULL            -- IDENTIDADE congelada (spec 052) — ver §3.1
                  REFERENCES medicines(id) ON DELETE CASCADE,
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

### 3.1 Identidade congelada: `medicine_id` (spec 052, ADR-084)

A tabela nasceu congelando a **dose** (`expected_dose`) e deixando a **identidade do medicamento**
para o join `protocol_id → protocols.medicine_id`, resolvido na LEITURA. Isso era correto enquanto
o medicamento de um tratamento não mudava. Deixou de ser: editar o tratamento sempre permitiu
trocá-lo, e a titulação (spec 029) tornou a troca rotina — cada `medicine_switch` aponta o
protocolo para outro medicamento.

Consequência do join: **mudar o medicamento reescrevia o passado**. Doses de junho que foram
Mounjaro 2,5 mg passavam a renderizar como 15 mg no histórico e no relatório do médico.
Falsificação clínica, medida em prod: 61% das instâncias (3.085 de 5.068) dependiam 100% do join.

A tabela já sabia disso pela metade. `expected_dose` existe porque alguém concluiu que a **dose**
varia no tempo e precisa ser congelada; faltava aplicar a mesma lógica ao **medicamento**.

**Regra de escrita.** O gerador congela o medicamento da **etapa vigente em `scheduled_for`**
(`titrationStage?.medicine_id ?? protocol.medicine_id`) — a mesma resolução temporal do
`expected_dose`, de modo que dose e medicamento saem sempre da MESMA etapa.

**Regra de leitura (SC-004).** Existe **um único** ponto autorizado a responder "que medicamento é
esta dose": `resolveInstanceMedicine` (`@dosiq/core/utils/instanceMedicine`). Ele lê a coluna e
**nunca pergunta ao protocolo qual é a identidade** — o protocolo entra só como fonte do registro,
e apenas quando aponta para o mesmo medicamento congelado. Sem o registro em mãos, devolve o id
correto com nome vazio: **não exibir o nome é melhor do que exibir o errado**.

```js
// ✅ leitura correta
const { medicineId, medicine } = resolveInstanceMedicine(instance, { protocol, medicinesById })

// ❌ o bug que a 052 existe para matar — o protocolo evolui, a dose passada não
const medicineName = instance.protocol.medicine.name
```

`createDoseInstanceRepository.getWindow` já traz o embed (`WINDOW_SELECT`), então toda ocorrência
lida por ele carrega o próprio medicamento — a identidade não depende de o consumidor ter
carregado o protocolo certo.

**Invalidação do futuro (FR-007).** Congelar protege o passado, mas inverte um acerto acidental: o
join deixava as doses futuras "certas de graça" quando o usuário trocava o medicamento. Por isso
`medicine_id` entra em `SCHEDULING_FIELDS` e as escritas na escada disparam `resyncProtocolWindow`
(wipe + regeneração das pendentes futuras). O passado é intocável por construção —
`wipeFuturePending` nunca alcança dose passada nem `taken`/`missed`.

> ⚠️ Escrever em tabela que alimenta o gerador **por embed** (ex.: `titration_steps`) é escrever no
> dado derivado, e escapa do `syncInstancesOnWrite` — foram 4 caminhos, não 1 (AP-308). O
> `ON CONFLICT DO NOTHING` do upsert converge **ausência**, nunca conserta linha errada.

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

**Caminho de produção (ADR-051):** endpoint serverless dedicado `api/generate-doses.ts`,
disparado por agendamento próprio (~03:00), com invoke/orçamento **isolados** dos reminders
(`api/notify.ts`) — geração não pode roubar tempo de notificação crítica. O `node-cron` em
`server/bot/scheduler.ts` é só paridade de DEV (AP-182).

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

> **Estado atual (G1 — FECHADO na F4.3f):** o tz do perfil é injetado **ponta-a-ponta**:
> - **Captura** (F4.3f.0): contas novas gravam o fuso real do device na confirmação do signup
>   (`Intl`, normalizado contra a lista suportada; fora dela → SP); convite passivo no Perfil
>   para usuários existentes. R-253.
> - **Geração + leitura** (F4.3f.1): write-path (`createProtocolRepository`) e cron
>   (`doseInstanceScheduler`) materializam `scheduled_for` no fuso do **dono** via
>   `resolveUserTz`/`resolveUserTzMap`; o "hoje" (web `useDoseZones` + mobile `_useTodayDerived`)
>   deriva virada-de-dia/HH:MM no fuso do perfil. Geração e leitura usam o **mesmo** fallback SP
>   (invariante G2, R-254).
> - **Troca de fuso** (F4.3f.2): com doses futuras pendentes, prompt de intenção —
>   *viagem* (persiste o tz, não mexe nas doses; só muda o render) × *mudança*
>   (`regenActiveProtocolsForTz`: wipe + re-ancora o wall-clock do `time_schedule` no fuso novo;
>   best-effort R-231/245/246; nunca toca passado/`taken`/`missed`, AP-203).
>
> Janelas de query em **UTC real**; o tz só governa a derivação do dia local (sem double-shift — AP-194).

---

## 7. Leitura — três superfícies

Tudo lê a **fonte única** `dose_instances` (R-248), nunca mais infere sobre logs.

1. **Adesão / streak** (`adherenceService` web, `AdherenceRing` mobile) — `computeAdherenceFromInstances`/
   `computeStreakFromInstances` (core, ADR-052), head-count por status. Views SQL de relatório
   (`v_daily_adherence`, `v_adherence_heatmap`) reescritas para agregação server-side a partir de
   `dose_instances`, clamp 0-100, `security_invoker` (G6).

2. **Timeline event-agnóstica (FP-3 / ADR-050, CON-023)** — `packages/core/src/utils/timeline.ts`
   (builder puro `buildTimeline(events, {tz, order})` + `groupByLocalDay` + `deriveLocalDay`;
   modelo `TimelineEvent = {id, type, occurred_at, payload}` com `type` string aberta) +
   `timelineService.doseInstancesToEvents(...)` (adapter puro `dose_instances`+`logs`→eventos
   `dose`, dedupe instância-ancorada=1 evento, AP-193). Plugar `biomarker`/`note` no futuro = um
   adapter + um card, **sem tocar o builder nem a UI**. Consumido pelo Histórico web (registry por
   `event.type`).

3. **Zonas de dose / "hoje" (CON-024)** — `packages/core/src/utils/doseZones.ts` (puro,
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
| Geração (puro) | `packages/core/src/utils/doseInstanceGenerator.ts` |
| Orquestração | `packages/core/src/services/doseInstancePlanner.ts` |
| Repo I/O | `packages/core/src/repositories/createDoseInstanceRepository.ts` |
| Lifecycle protocolo | `packages/core/src/repositories/createProtocolRepository.ts` (`syncInstancesOnWrite`) |
| Adesão (puro) | `packages/core/src/utils/adherenceLogic.ts` (`computeAdherenceFromInstances`, `computeStreakFromInstances`) |
| Timeline FP-3 | `packages/core/src/utils/timeline.ts` + `packages/core/src/services/timelineService.ts` |
| Zonas de dose | `packages/core/src/utils/doseZones.ts` |
| Endpoint geração | `api/generate-doses.ts` |
| Web — hoje | `apps/web/src/features/dashboard/hooks/useDoseZones.ts` |
| Web — histórico | `apps/web/src/features/.../HealthHistory*` + `eventCardRegistry` |
| Web — escrita | `apps/web/src/shared/services/api/logService.ts` |
| Mobile — hoje | `apps/mobile/src/features/dashboard/hooks/_useTodayDerived.ts` |
| Mobile — escrita | `apps/mobile/src/features/dose/services/doseService.ts` + modais |

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
| 4.3e | Carry-over cross-dia "Pendências de ontem"/"Em breve" (web+mobile) | ✅ |
| 4.3f.0 | Captura de tz no signup + nudge no Perfil (R-253) | ✅ |
| 4.3f.1 | Geração no fuso do dono (write-path + cron) + "hoje" no fuso (R-254) | ✅ |
| 4.3f.2 | Troca de fuso: prompt viagem × mudança + regen das doses — **fecha G1 / Fase 4** | ✅ |

> **Fase 4 concluída** (épico F4.3f: PRs #628/#629/#630). Web 4.0.0 · Mobile 0.8.0 (loja).
> O refactor de `dose_instances` está completo: adesão/timeline/hoje são query, não cálculo,
> e o fuso do usuário é respeitado ponta-a-ponta (captura → geração → leitura → troca).

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
