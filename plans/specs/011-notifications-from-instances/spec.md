# Spec: Notification stack ← `dose_instances` (+ `notified_at`)

**Feature Directory**: `plans/specs/011-notifications-from-instances`
**Created**: 2026-06-03
**Status**: delivered — PR #633 (reminder ← dose_instances; ADR-057)
**Tier**: 2 (Epic / High-Risk — toca o cron crítico de lembretes)
**Input**: "/devflow specifying 011 - Refactor Notifications + dose_instances"
**Pré-requisito de**: spec 010 (Alarme Nativo v2)

---

## Context

O refactor `dose_instances` (ADR-048, Fases 1-4) migrou **adesão, timeline e "hoje"** do modelo
inferido (expandir `time_schedule` + casar logs ±2h) para a **fonte única** `dose_instances`
(invariante DOSE_INSTANCES.md §11.1: "tudo lê dose_instances, nunca infere"). **Mas o stack de
notificações (lembretes de dose) ficou de fora** — é a **última ilha do modelo inferido**:

Evidência (repo real):
- `server/bot/_reminderHelpers.js:18` lê **`from('protocols')`** + re-expande o schedule via
  `partitionDoses` — **não** toca `dose_instances`.
- A coluna **`dose_instances.notified_at`** (DOSE_INSTANCES.md:57, desenhada para idempotência
  da notificação) está **100% ociosa** — zero leitura/escrita em todo o repo.
- A deduplicação atual é **heurística/temporal** (`notificationDeduplicator.js` +
  `shouldSendGroupedNotification`), não por-ocorrência.

**Consequências do débito:**
- **Inconsistência arquitetural** — o lembrete pode divergir do "hoje"/adesão (fontes diferentes).
- **Idempotência frágil** — overlap de cron / retry pode duplicar; a dedup é por janela de tempo,
  não pela ocorrência.
- **Sem herança de tz/cross-meia-noite** que `dose_instances` já resolve (instante absoluto).
- **Bloqueia a 010** — o alarme crítico v2 precisa de roteamento **per-dose**; sobre o stack atual
  (lê protocols, agrupa slots) isso vira um hack de duas fontes (ADR-056). Sobre `dose_instances`
  (com `critical_alarm`/`snoozed_until` já materializados), o gate é um read natural.

**Por que agora:** "arrumar a casa" antes de empilhar a v2. Pagar o débito que a v2 senão
contornaria. `notified_at`/`snoozed_until` já existem no schema — a fundação foi desenhada, só
nunca foi ligada.

> **Escopo desta spec:** SÓ o refactor do reminder p/ ler `dose_instances` + persistir
> `notified_at`. **NÃO** inclui `critical_alarm` nem o roteamento crítico (isso é a 010). Esta
> spec entrega a fundação limpa; a 010 sobe em cima.

---

## User Stories

### US1 — Lembrete a partir da ocorrência materializada (P1)
Como sistema, quero que o lembrete de dose **leia as ocorrências devidas** de `dose_instances`
(não re-expanda o schedule), para alinhar com o "hoje"/adesão e herdar tz/cross-meia-noite.

**Acceptance:**
- **Given** ocorrências `dose_instances` devidas no minuto (status `pending`, dentro da janela),
  **When** o cron de lembrete roda, **Then** os lembretes saem **dessas ocorrências** (mesma
  fonte do "hoje"), não de uma re-expansão de `protocols`.
- **Given** uma dose já registrada (`taken`) ou pulada (`skipped_*`), **When** o cron roda,
  **Then** **nenhum** lembrete é enviado para ela.

### US2 — Idempotência por ocorrência (`notified_at`) (P1)
Como sistema, quero marcar `notified_at` na ocorrência ao notificar, para **nunca** disparar o
mesmo lembrete duas vezes (overlap de cron, retry, reprocessamento).

**Acceptance:**
- **Given** uma ocorrência já notificada (`notified_at` setado), **When** o cron roda de novo,
  **Then** ela **não** gera novo lembrete.
- **Given** falha no envio, **When** o retry roda, **Then** a idempotência é coerente (definir:
  `notified_at` só após sucesso vs. otimista — ver Q1).

### US3 — Soneca/adiamento respeitados (P2)
Como sistema, quero respeitar `snoozed_until` ao decidir lembretes, para uma dose adiada não
re-disparar antes do tempo.

**Acceptance:**
- **Given** uma ocorrência com `snoozed_until` no futuro, **When** o cron roda, **Then** **não**
  envia lembrete antes de `snoozed_until`.

---

## Functional Requirements

- **FR-001** O reminder DEVE consultar `dose_instances` (ocorrências devidas: `status='pending'`,
  janela de tempo, `notified_at IS NULL`, `snoozed_until` respeitado) como fonte das doses a
  lembrar — substituindo a re-expansão de `protocols` via schedule.
- **FR-002** O reminder DEVE persistir `dose_instances.notified_at` ao notificar — setado
  **após sucesso de envio em ≥1 canal configurado** (Q1). Idempotência precisa por-ocorrência.
- **FR-003** O reminder DEVE respeitar `snoozed_until` (não notificar antes).
- **FR-004** O **agrupamento** em blocos (by_plan/misc/individual, R-191/AP-112 — 1 push/bloco)
  DEVE ser preservado — **mesmo modelo, troca o input** (linhas de `dose_instances` em vez de
  slots de schedule); kinds (`dose_reminder`/`_by_plan`/`_misc`) inalterados (Q3).
- **FR-005** A dedup heurística por janela (`shouldSendNotification`/`shouldSendGroupedNotification`,
  5 min em `notification_log`) é **aposentada para os kinds de lembrete de dose** — substituída
  pela idempotência precisa de `notified_at`. `notification_log` (auditoria/inbox L3) **fica**;
  a dedup temporal pode permanecer para tipos sem ocorrência (digest/stock) (Q1).
- **FR-005b** Canais que falharam após `notified_at` setado DEVEM ser tratados pelo **DLQ**
  (retry por-canal), sem re-disparar o lembrete inteiro da ocorrência (Q1).
- **FR-006** Rollout por **cutover + feature flag de rollback** (base pequena friends/family — Q2):
  a flag volta ao comportamento antigo sem deploy de código. (Sem shadow/paralelo.)
- **FR-007** A arquitetura 3-camadas (L1/L2/L3, R-200/R-220) e o dispatcher (CON-019) DEVEM ser
  preservados — muda a **fonte** das doses (L1), não o gate centralizado nem os canais.
- **FR-008** O tz do usuário DEVE governar a janela de "devidas" via instante absoluto
  (`scheduled_for` UTC), sem double-shift (AP-194); herda o tratamento de tz das `dose_instances`.

---

## Success Criteria

- **SC-001** Paridade: para um conjunto de protocolos/horários, os lembretes gerados pela nova
  via (`dose_instances`) batem com a via antiga (schedule) — mesmos blocos/kinds/destinatários
  (validado em teste antes do cutover).
- **SC-002** Zero duplicata: rodar o cron 2× no mesmo minuto (ou retry) não duplica lembrete
  (`notified_at` idempotente).
- **SC-003** Doses `taken`/`skipped_*`/`snoozed` não geram lembrete.
- **SC-004** Rollback seguro: a feature flag volta ao comportamento antigo sem deploy de código.
- **SC-005** Lint 0 erros, `validate:agent` verde, vitest server verde, smoke PO.
- **SC-006** A 010 consegue, em cima desta fundação, fazer o gate per-dose lendo
  `dose_instances.critical_alarm` (validação de habilitação — não implementa a 010 aqui).

---

## Edge Cases

- Ocorrência **devida mas ainda não materializada** (gap de geração) → `ensureInstancesUpTo`
  (rede lazy, ADR-051) antes da leitura, ou o cron de geração (~03:00) garante. Definir ordem.
- Cron envia mas **crasha antes** de gravar `notified_at` → no próximo tick **re-notifica**
  (at-least-once aceito — `notified_at` após sucesso, Q1). Risco pequeno e tolerável (base
  friends/family); preferível a perder lembrete (at-most-once otimista).
- Múltiplas doses no mesmo minuto/plano → agrupar (R-191), agora por linhas de instância.
- Telegram **e** push para o mesmo usuário (multicanal, CON-019) → `notified_at` é
  **por-ocorrência** (setado após sucesso em ≥1 canal), não por-canal. Canal que falhou → DLQ.
- Usuário **sem** `dose_instances` geradas (conta nova / protocolo recém-criado) → geração JIT.
- Backfill: ocorrências passadas com `notified_at NULL` não devem disparar lembrete retroativo
  (janela de "devidas" só pega o presente, não o passado — clamp como o gerador, §4 DOSE_INSTANCES).

---

## Key Entities

- **`dose_instances`** — passa a ser a **fonte do reminder** (já é fonte de adesão/timeline/hoje).
  Usa `status`, `scheduled_for`, `notified_at` (idempotência), `snoozed_until` (adiamento).
  **Nenhuma coluna nova** — `notified_at`/`snoozed_until` já existem (ociosas).
- **`notificationDeduplicator` / `shouldSendGroupedNotification`** — dedup heurística atual;
  candidata a aposentadoria/reconciliação (Q1).
- **`partitionDoses`** — agrupador; passa a receber linhas de `dose_instances` (Q3).
- **Dispatcher (CON-019)** — inalterado; recebe os blocos e roteia canais.
- **Feature flag** — rollout seguro (precedente `USE_NOTIFICATION_DISPATCHER`, ADR-030).

---

## Assumptions / Open Questions

**Assumptions:**
- `dose_instances` já tem cobertura de geração (cron 03:00 + JIT) suficiente para o reminder ler.
- O dispatcher (L2/L3) e a resolução de canais (`resolveChannelsForUser`) ficam intactos.
- Nenhuma migração de coluna (notified_at/snoozed_until já existem); pode haver backfill nulo.

## Clarifications (resolvidas pelo operador — 2026-06-03)

- **Q1 → A:** `notified_at` setado **após sucesso de envio em ≥1 canal configurado** (não otimista).
  É **por-ocorrência** (uma vez notificada, idempotente). Canais que falharam → **DLQ** (retry
  por-canal), sem re-disparar o lembrete. A dedup heurística por janela
  (`shouldSendNotification`/`shouldSendGroupedNotification`, 5 min) é **aposentada para os kinds de
  dose** (`notified_at` é estritamente melhor — preciso por-ocorrência). `notification_log`
  (auditoria/inbox L3) permanece; dedup temporal pode ficar para tipos sem ocorrência.

- **Q2 → A:** **Cutover + feature flag de rollback** (base pequena friends/family). Sem
  shadow/paralelo de paridade obrigatório (paridade vira teste, não runtime).

- **Q3 → A:** **Modelo de agrupamento se mantém, troca o input** (slots→linhas de `dose_instances`).
  Kinds inalterados. ⚠️ **Insumo p/ a 010:** o cenário complexo — 1 `treatment_plan` com 3
  protocolos disparando **no mesmo minuto**, só 1 com `critical_alarm` — exige, **na 010**, que o
  bloco `by_plan` consiga **separar** a dose crítica (1 → time-sensitive/alarme) das 2 normais
  (→ push normal). A 011 só agrupa (sem eixo crítico); a 010 adiciona o split per-instância dentro
  do bloco. Registrado como nota de design p/ a 010 (ADR-056 re-escopo).

---

## Out of Scope

- `critical_alarm` + roteamento crítico per-dose → **spec 010** (esta é a fundação).
- Mudança de canais/preferências (`resolveChannelsForUser`, ADR-035) — inalterado.
- Geração de `dose_instances` (ADR-051) — já existe; só consumimos.
- Telegram snooze (spec 021) — separado.
