# Implementation Plan: Native Alarm Persistent

**Feature Directory**: `plans/specs/001-native-alarm-persistent`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/001-native-alarm-persistent/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md`

---

## Technical Context

O Dosiq mobile utiliza `@notifee/react-native` para orquestrar alarmes e notificações locais persistentes. Esta lib substitui chamadas estáticas de `expo-notifications` locais e permite interagir com os serviços nativos de alarme do Android e iOS de forma precisa.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Notificações e alarmes locais operam com dados em cache local sem expor logs desnecessários. |
| **II. Mobile-First Reliability** | ✅ PASS | Computação de agendamento em segundo plano restringida a look-ahead de 72h para não sobrecarregar recursos do aparelho. |
| **IV. Timezone Correctness** | ✅ PASS | Agendamento usa `parseLocalDate()` para conversão segura de data e hora clínica, prevenindo bugs de GMT-3. |
| **VI. Release and SQP Discipline** | ✅ PASS | Checklist R-221 de SemVer e CHANGELOG embutido como gate mandatório antes de commits e PR. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/platform/alarms/alarmService.js` | Core de agendamento, cancelamento e nagging via Notifee. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md` |
| `apps/mobile/src/platform/alarms/useAlarmScheduler.js` | Hook de agendamento inteligente com janela Look-Ahead de 72 horas. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md` |
| `apps/mobile/src/platform/alarms/AlarmFullScreen.jsx` | Componente de visualização em tela cheia na lock screen (Android full-screen intent). | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md` |
| `apps/mobile/src/platform/alarms/quickDoseRegistration.js` | Mutation offline de registro e descarte de alarmes, com limpeza de snapshots. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md` |
| `apps/mobile/src/features/profile/screens/SettingsScreen.jsx` | Modificado para expor o toggle de ativação dos alarmes clínicos locais. | `plans/backlog-unified_app_2026/EXEC_SPEC_P0_1_ALARME_NATIVO.md` |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA (EXPO GO DECOMMISSION):**  
> A biblioteca `@notifee/react-native` insere código nativo Java/Objective-C complexo. O uso de **Expo Go padrão é incompatível e falhará imediatamente**.
> Os desenvolvedores IA e operadores **devem** rodar e testar exclusivamente via builds locais de desenvolvimento no emulador ou device real:
> - Android: `rtk expo run:android`
> - iOS: `rtk expo run:ios`
> E devem configurar o Config Plugin no `app.config.js` correspondente para injetar as permissões (`SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`) e modos de background no `Info.plist` nativo.

### 2. Bypass DND e Doze Mode
- No Android, o canal do Notifee deve ser criado com `importance: AndroidImportance.HIGH` e `bypassDnd: true`.
- Agendamento exato usa `TriggerType.TIMESTAMP` com `alarmManager: { allowWhileIdle: true }` no Notifee.
- No iOS, seções usam `interruptionLevel: 'timeSensitive'` como fallback caso o entitlement de *Critical Alerts* da Apple (lead time de 2-4 semanas) ainda não tenha sido concedido.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit deste plano de feature deve prever a execução rígida dos seguintes passos do **SQP R-221**:

*   **Identificação de Plataformas:** Esta feature altera exclusivamente a plataforma **Mobile** e a lógica compartilhada em **Shared/Core** (se aplicável).
*   **SemVer Impact:** Classificado como **minor** (nova funcionalidade clínica relevante de alarme persistente no mobile).
*   **Version Update:** Bump da versão do aplicativo mobile no arquivo `apps/mobile/app.config.js` (atualizar a constante `APP_VERSION` ou equivalente).
*   **Changelog:** Adicionar uma entrada em português no arquivo `CHANGELOG.md` sob a seção `[Unreleased]` explicando a chegada dos alarmes nativos via Notifee.
*   **Store Note:** Preparar nota de atualização de loja (Play Store/App Store) focando na segurança que os alarmes trazem no horário correto dos remédios.
*   **Quality Commands:**
    *   `rtk lint` deve rodar limpo antes de qualquer commit.
    *   `rtk npm run validate:agent` deve passar integralmente no diretório `apps/mobile` antes da abertura do PR.
