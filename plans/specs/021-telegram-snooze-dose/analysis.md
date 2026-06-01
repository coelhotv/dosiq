# Artifact Coverage Analysis: Telegram Dose Snooze (Telegram Only)

**Feature Directory**: `plans/specs/021-telegram-snooze-dose`  
**Created**: 2026-06-01  
**Status**: PASS  

---

## Legacy Source Coverage

| Legacy Section | Migrated To | Notes |
|:---|:---|:---|
| **§Contexto e motivação** | `spec.md` (§Context) & `plan.md` (§Technical Context) | Mapeado o acoplamento do snooze direto à tabela canônica de instâncias. |
| **§Arquitetura da feature** | `plan.md` (§Architecture) | Substituída a arquitetura complexa de jobs temporários por atualizações simples na `dose_instances`. |
| **T1: Migration SQL** | `plan.md` (§1 Helpers) & `tasks.md` (Phase 1) | Decommission total da tabela redundante. Verificado o schema ativo. |
| **T2: _snoozeHelpers.js** | `plan.md` (§1 Helpers) & `tasks.md` (Sprint 1 / Sprint 4) | Detalhado o setup de helper utilitário de elegibilidade e loop de cron. |
| **T3: doseActions.js** | `plan.md` (§2 Handlers) & `tasks.md` (Sprint 2) | Implementação dos callbacks `snooze_:` e `snooze_pick:` com limite de bytes. |
| **T4 a T7: Payloads e canais** | `plan.md` (§3 Payloads) & `tasks.md` (Sprint 3) | Adicionados os decoradores visuais no lembrete e botão no Telegram. |
| **T8: api/notify.js** | `plan.md` (§4 Cron) & `tasks.md` (Sprint 4) | Integração no loop do cron a cada minuto agregada para economizar serverless function. |
| **§Acceptance Criteria / DoD** | `spec.md` (§User Scenarios) & `checklists/requirements.md` | Critérios de aceitação refinados mapeados integralmente. |

---

## Requirement Coverage

| Requirement | Has Task? | Task IDs | Notes |
|:---|:---:|:---|:---|
| **FR-001**: Uso de `dose_instances.snoozed_until` | Yes | `T001`, `T008`, `T012` | Decommission da tabela legada. |
| **FR-002**: Botão `⏰ Adiar` no Telegram | Yes | `T010` | Renderizado em linha única no alertas. |
| **FR-003**: Janela de adiamento limite de 2h | Yes | `T003`, `T007`, `T008` | Cálculo dinâmico das opções fixas válidas. |
| **FR-004**: Elegibilidade clínica de fuso e gap | Yes | `T004`, `T005`, `T007` | Gap mínimo entre doses adjacentes >2h. |
| **FR-005**: Limite de 64 bytes de callback | Yes | `T006`, `T011` | Strings de callbacks curtas mapeadas. |
| **FR-006**: Cron runner `checkSnoozedDoses` | Yes | `T012`, `T013` | Disparador a cada minuto no cron unificado. |
| **FR-007**: Decorador de re-alerta `⏰` | Yes | `T009` | Payload com menção de lembrete adiado. |
| **SC-001**: Exibição do botão inline | Yes | `T010`, `T016` | UI consolidada do alerta de dose individual. |
| **SC-002**: Re-alerta preciso e persistência | Yes | `T012`, `T016` | Gravação e disparo de mensagens no minuto exato. |
| **SC-003**: Conformidade tz-aware | Yes | `T008`, `T016` | Data local e hora confirmadas no fuso correto. |

---

## Constitution Alignment

- **R-020 (Timezone)**: A decisão de gravar `snoozed_until` como UTC absoluto e realizar a formatação local America/Sao_Paulo (ou baseada na timezone do usuário) exclusivamente na renderização do bot no Telegram protege o sistema contra double-shift de fuso horário.
- **R-090 (Hobby serverless functions budget)**: O processamento de re-alertas do snooze ocorre de forma agregada dentro do cron de lembretes existente em `api/notify.js`, eliminando a necessidade de qualquer slot serverless extra na Vercel Hobby, garantindo economia.
- **R-221 (SQP)**: Todas as tarefas de liberação e governança para bumps canônicos e português sob `CHANGELOG.md` foram rigorosamente incluídas na Tasks list (Fase 4), garantindo estabilidade e visibilidade de releases de forma robusta e rastreável.

---

## Gaps

| ID | Severity | Summary | Required Action |
|:---|:---|:---|:---|
| **GAP-01** | **LOW** | Concorrência com quiet hours | Se o usuário estiver em quiet hours no momento em que o snooze vencer, o dispatcher deve silenciar ou reter o re-alerta, em conformidade com as configurações de políticas do usuário. |
| **GAP-02** | **LOW** | Protocolo deletado/inativado | Caso o protocolo seja pausado ou deletado enquanto um snooze estiver pendente, o cron deve descartar o re-alerta de forma silenciosa para evitar confusão clínica. |

---

## Gate Decision

> [!TIP]
> **GATE DECISION: PASS**  
> A feature `021-telegram-snooze-dose` encontra-se reestruturada de forma brilhante sob o novo formato SDD. O acoplamento re-arquitetado diretamente com `dose_instances` simplificou consideravelmente o volume de dados e o processamento de banco de dados, resultando em uma especificação enxuta e robusta.
