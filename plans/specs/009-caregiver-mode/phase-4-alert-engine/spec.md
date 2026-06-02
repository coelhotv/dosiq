# Feature Specification: Alert Engine (Caregiver Mode — Phase 4)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-4-alert-engine`
**Epic**: [Modo Cuidador](../EPIC.md) · **Phase**: 4 · **Depende de**: phase-1 (vínculos), phase-3 (dashboard/canal)
**Created**: 2026-06-02
**Status**: Dev Ready
**Gate de entrada**: G2 — engajamento de dashboard comprovado (ver EPIC)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/DRAFT_CAREGIVER_MODE.md` §Tabela de Eventos & Alertas · §Motor de Notificações Híbrido
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §3. Motor de Alertas Híbrido

---

## Context

O **valor central** do Modo Cuidador para o cuidador é ser **alertado de forma acionável quando o paciente não adere** — *"estou no trabalho e sou avisado que minha mãe não tomou nenhum remédio hoje"*. Sem essa engine, o dashboard (phase-3) é passivo e a promessa de produto não se cumpre.

Esta feature especifica o **motor de detecção e disparo de alertas ao cuidador**: um cron de backend que avalia o estado das `dose_instances`/estoque/prescrições do paciente, resolve o canal escolhido pelo cuidador (`caregiver_links.notification_channel`) e dispara a notificação.

> **Push-first no paciente, alerta ao cuidador como contingência:** o paciente recebe alarme nativo persistente (spec 001) + nagging. O alerta ao cuidador só dispara **após** a janela de tolerância do paciente esgotar (ex.: 30 min sem registro) — evitando ruído e protegendo cotas de canal externo.

> **Não confundir com Fase 7B (WhatsApp bot):** esta engine resolve **qual evento dispara e quando**. O *transporte* por WhatsApp Business é épico à parte (013/014). Aqui, canais nativos/baratos (push, Telegram, e-mail) são suficientes para entregar valor; WhatsApp é plugável depois via o mesmo `notification_channel`.

---

## User Scenarios & Testing

### User Story 1 — Alerta de Não-Adesão (P1)
**Why**: é o coração do valor ao cuidador.
**Independent Test**: simular paciente que não registra dose das 08:00; após 30 min de tolerância, o cuidador `manager` com `notification_channel` configurado recebe alerta acionável uma única vez.

**Acceptance Scenarios**:
1. Given Dona Maria tem dose 08:00 e Ana Paula é `manager` com canal Telegram, When passam 30 min sem registro (status segue `pending`/vira `missed`), Then Ana Paula recebe "Dona Maria ainda não registrou Losartana 50mg (08:00). Que tal ligar?" exatamente uma vez (sem duplicar a cada tick do cron).

### User Story 2 — Digest & Estoque/Receita (P2)
**Why**: alertas proativos de gestão.
**Independent Test**: simular estoque <3 dias e digest semanal; verificar disparo nos delays corretos.

**Acceptance Scenarios**:
1. Given estoque de Losartana acaba em 2 dias, When o cron de estoque detecta, Then o cuidador recebe "Estoque de Losartana de Dona Maria acaba em 2 dias."
2. Given domingo 20h, When o cron de digest roda, Then o cuidador recebe resumo de adesão semanal do paciente.

---

## Edge Cases

- **Idempotência (anti-duplicação):** cada evento dispara **uma vez** por instância/janela. Persistir marca de "alerta enviado" (reusar/estender `notification_log` ou campo em `dose_instances.notified_at`) para não reenviar a cada tick do cron.
- **Canal `none`:** cuidador pode optar por não receber (`notification_channel='none'`) → engine pula o disparo.
- **Timezone:** delays (30 min, digest domingo 20h) calculados no fuso do **paciente** (`user_settings.timezone`), não do cuidador nem do servidor.
- **Vínculo revogado:** se `caregiver_links` foi deletado, nenhum alerta é disparado (RLS/JOIN não encontra cuidador).
- **R-090:** o cron NÃO pode adicionar funções serverless além do budget de 12. Reusar cron existente de notificações/estoque; o engine é um consumidor, não um novo endpoint.

---

## Requirements

### Functional Requirements

- **FR-001:** Cron de backend avalia periodicamente as `dose_instances` dos pacientes com cuidador `manager` vinculado e dispara alerta de **dose atrasada** após a janela de tolerância (default 30 min pós `scheduled_for`).
- **FR-002:** Disparar alerta de **dose perdida** ao marcar `status='missed'`.
- **FR-003:** Disparar alerta de **estoque crítico** (<3 dias) detectado no cron de estoque existente.
- **FR-004:** Disparar alerta de **receita vencendo** (7 dias antes de `prescription_end`).
- **FR-005:** Disparar **digest semanal** de adesão (domingo 20h fuso do paciente) quando adesão < limiar configurável.
- **FR-006:** Disparar notificação de **vínculo revogado** ao cuidador (imediato).
- **FR-007:** Resolver o **canal** por `caregiver_links.notification_channel` (`push`/`telegram`/`email`/`none` — WhatsApp plugável via 7B). Abstração de canal reusa o padrão `INotificationChannel` do bot.
- **FR-008:** **Idempotência** — cada evento dispara uma vez por instância/janela (persistir flag de envio; nunca reenviar por tick).

### Key Entities

- **CaregiverLink:** fonte do cuidador-alvo + `notification_channel`.
- **DoseInstance:** estado (`pending`/`missed`) + `scheduled_for` + flag de alerta enviado.
- **NotificationLog:** registro de envio (idempotência + métricas) — reusa/estende o existente.

---

## Success Criteria

- **SC-001:** Alerta de não-adesão entregue ao cuidador dentro de ≤ 5 min após esgotar a tolerância do paciente, **exatamente uma vez** por instância.
- **SC-002:** Zero funções serverless novas além do budget R-090 (engine reusa crons existentes).
- **SC-003:** 100% dos delays calculados no fuso do paciente (sem off-by-one de timezone).
- **SC-004:** Canal `none` nunca recebe disparo; canal configurado recebe no transporte certo.

---

## Open Questions

- **[NEEDS CLARIFICATION: enum de canal]** `notification_channel` no schema atual é `whatsapp/telegram/both/none`. Para 7A sem Meta, propor `push/telegram/email/none` (WhatsApp entra em 7B). Confirmar enum final com PO (impacta CHECK constraint + Zod).
- **[NEEDS CLARIFICATION: limiar digest]** percentual de adesão que dispara o digest "baixo" (DRAFT sugere <50%).
