# Análise de Requisitos e Reality Check: 025 — Correção e Evolução de Notificações e Alarmes

Este documento realiza o **Reality Check** obrigatório (C1.5) para validar a consistência de caminhos, assinaturas e compatibilidades no repositório Dosiq antes do início da codificação.

---

## 1. Tabela de Evidências (Reality Check)

| Reivindicação do Plano | Repositório Real (Arquivo:Linha) | Verificado? | Observação |
| :--- | :--- | :--- | :--- |
| `user_settings` (Tabela) | Supabase Schema (PostgreSQL) | ✅ | Tabela existe com as colunas consultadas no banco. |
| `notification_preference` | Supabase schema (PostgreSQL) | ✅ | Tipo `text`, padrão `'telegram'::text`. |
| `handleStart` | [start.js](file:///Users/coelhotv/git/dosiq/server/bot/commands/start.js#L4) | ✅ | Assinatura: `handleStart(bot, msg)` |
| `_checkRemindersFromInstances` | [_reminderHelpers.js](file:///Users/coelhotv/git/dosiq/server/bot/_reminderHelpers.js#L143) | ✅ | Função cron principal baseada em instâncias. |
| `_fetchDueInstancesForReminder` | [_reminderHelpers.js](file:///Users/coelhotv/git/dosiq/server/bot/_reminderHelpers.js#L91) | ✅ | Busca instâncias e faz enrich com relações. |
| `doseReminderDataSchema` | [_payloadSchemas.js](file:///Users/coelhotv/git/dosiq/server/notifications/payloads/_payloadSchemas.js#L115) | ✅ | Zod schema para dados da dose única. |
| `formatDoseReminder` | [buildNotificationPayload.js](file:///Users/coelhotv/git/dosiq/server/notifications/payloads/buildNotificationPayload.js#L158) | ✅ | Constrói payload para kind `dose_reminder`. |
| `sendExpoPushNotification` | [expoPushChannel.js](file:///Users/coelhotv/git/dosiq/server/notifications/channels/expoPushChannel.js#L17) | ✅ | Despacha pushes para dispositivos Expo. |
| `registerPushToken` | [registerPushToken.js](file:///Users/coelhotv/git/dosiq/apps/mobile/src/platform/notifications/registerPushToken.js#L16) | ✅ | Sincroniza token e registra flags do dispositivo. |
| `handleCriticalAlarmToggle` | [ProtocolFormBody.jsx](file:///Users/coelhotv/git/dosiq/apps/mobile/src/features/treatments/components/ProtocolFormBody.jsx#L60) | ✅ | Callback para ligar/desligar alertas críticos. |
| `syncAlarms` | [useAlarmScheduler.js](file:///Users/coelhotv/git/dosiq/apps/mobile/src/platform/alarms/useAlarmScheduler.js#L35) | ✅ | Sincroniza e agenda triggers Notifee para 72h. |
| `registerTaken` | [quickDoseRegistration.js](file:///Users/coelhotv/git/dosiq/apps/mobile/src/platform/alarms/quickDoseRegistration.js#L37) | ✅ | Ação de registrar dose tomada pelo alarme. |
| `AlarmFullScreen` | [AlarmFullScreen.jsx](file:///Users/coelhotv/git/dosiq/apps/mobile/src/features/dose/screens/AlarmFullScreen.jsx#L20) | ✅ | Componente de takeover para a UI do alarme. |

---

## 2. Consistência Cruzada de Arquivos (Cross-File Consistency)

Todos os artefatos estão em plena sintonia:
- **spec.md** define os requisitos e regras (US1–US4).
- **plan.md** mapeia detalhadamente quais partes de código serão modificadas para cumprir estes requisitos.
- **tasks.md** prevê tarefas pontuais correspondendo exatamente aos requisitos funcionais.

---

## 3. Completude da Migração de Dados (Data Migration)

A migração foi projetada para limpar dados de usuários que herdaram preferências inconsistentes:
- Remove o default `'telegram'` de `notification_preference`.
- Limpa canais ativos onde `telegram_chat_id` é nulo, de forma a evitar envios que resultariam em falha/DLQ.

---

## 4. Cobertura de Requisitos (Coverage Check)

- **US1** mapeado para **FR-01** e **FR-02** (Tasks **T001** e **T002**).
- **US2** mapeado para **FR-04** (Task **T004**).
- **US3** mapeado para **FR-03**, **FR-05**, **FR-06**, **FR-07** (Tasks **T003**, **T005**, **T006**, **T007**).
- **US4** mapeado para **FR-08**, **FR-09**, **FR-10**, **FR-11**, **FR-12** (Tasks **T009**, **T010**, **T011**, **T012**, **T013**).
- As tasks de qualidade e documentação (**T008**, **T014**, **T015**, **T016**, **T017**, **T018**, **T019**) garantem o cumprimento do DoD e SQP.

---

## 5. Classificação de Riscos e Status do Gate

- **Constituição**: Sem conflitos detectados. As mudanças respeitam as premissas de Mobile-First, Timezone Correctness e segurança de dados clínicos.
- **Severidade de Gaps**: Zero bugs críticos ou de contratos identificados.
- **Veredito**: **PASS / 100%** (Reality Check concluído com sucesso nas dependências locais e DB).
