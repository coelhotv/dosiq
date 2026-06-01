# Feature Specification: Native Alarm Persistent

**Feature Directory**: `plans/specs/001-native-alarm-persistent`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md`

---

## Context

Alarme nativo persistente é a **diferenciação de usabilidade número #1** do Dosiq. Notificações normais em segundo plano são silenciadas por otimizações de bateria do Android (Doze Mode) e Focus/DND no iOS. Pacientes idosos com tratamentos complexos de múltiplos medicamentos dependem de alertas sônicos confiáveis e insistentes que continuam a tocar e exibir controles em tela cheia (full-screen lock screen) para garantir o registro preciso das doses.

---

## User Scenarios & Testing

### User Story 1 - Recebimento de Alarme Invasivo (Priority: P1)
**Why this priority**: Crítico para evitar esquecimento de medicamentos por idosos.
**Independent Test**: Com o celular bloqueado em modo silencioso, agendar dose e validar se o alarme toca alto e exibe a tela cheia de ação na lock screen.

**Acceptance Scenarios**:
1. Given que Dona Maria tem o celular no bolso em modo silencioso/DND, When der o horário exato da Losartana, Then o alarme deve disparar, tocando a melodia clínica `alarm_dose.wav` e exibindo controles grandes e simplificados para fácil toque.

### User Story 2 - Registro Rápido do Alarme (Priority: P1)
**Why this priority**: Evita a fricção de abrir e carregar o app inteiro apenas para registrar check-in.
**Independent Test**: Tocar no botão "Tomei" na lock screen e verificar no Supabase se o status de `dose_instances` correspondente foi atualizado para `'taken'` com a hora correta.

**Acceptance Scenarios**:
1. Given o alarme em tela cheia na lock screen, When Dona Maria tocar em "Tomei", Then o alarme deve ser silenciado, a janela de notificação deve ser descartada, a dose deve ser registrada como tomada no Supabase e os caches locais do mobile devem ser limpos.

---

## Edge Cases

- **Android Doze Mode:** O alarme deve ser agendado usando `AlarmManager` exato para disparar mesmo se o dispositivo estiver inativo (idle).
- **Limite de Alarmes do Android 12+ (API 31):** O SO impõe um limite rígido de 500 alarmes exatos por app. A solução deve limitar o agendamento futuro a uma janela Look-Ahead de no máximo **72 horas** (~3 dias), agendando repetições dinamicamente.
- **Background no iOS:** O agendamento da insistência (snooze/nag) deve ser delegado ao kernel do SO via `notifee.createTriggerNotification`, prevenindo o descarte por encerramento de threads de JS do iOS.

---

## Requirements

### Functional Requirements

- **FR-001:** O alarme local deve tocar continuamente mesmo em modo DND (Android bypass e iOS fallback).
- **FR-002:** Deve exibir uma interface em tela cheia (full-screen intent) na lock screen do Android com botões grandes de ação.
- **FR-003:** O alarme deve disparar reativamente a insistência a cada 5 minutos (nagging) por no máximo 3 tentativas se ignorado.
- **FR-004:** Deve permitir registrar como tomado (`'taken'`) ou pular (`'skipped_user'`) diretamente da notificação/lock screen.
- **FR-005:** Deve invalidar os snapshots de cache local no mobile (`AsyncStorage`) após interações com alarme para garantir a sincronia.

### Key Entities

- **DoseInstance:** Registro transacional materializado da dose (tabela `dose_instances`), contendo campos de status (`pending`, `taken`, `skipped_user`) e horário programado (`scheduled_for`).

---

## Success Criteria

- **SC-001:** 100% de confiabilidade de disparo nos testes em Doze Mode de Android e iOS inativo.
- **SC-002:** Zero loops de agendamento ou vazamento de cota de alarmes exatos (garantido pela janela de 72h).
- **SC-003:** FPS de transição e renderização da tela de alarme full-screen estável ≥ 55fps.

---

## Assumptions

- O refatoramento da Fase 3 de `dose_instances` está concluído, fornecendo a tabela de instâncias materializadas em vez de inferência de logs.
- O time já migrou e roda exclusivamente builds locais de desenvolvimento nativas no mobile.

---

## Open Questions

- *Nenhum.* Todas as especificações técnicas de Notifee e Expo Builds estão homologadas no plano de implementação v1.2.
