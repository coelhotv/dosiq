# Tasks: Native Alarm Persistent

**Feature Directory**: `plans/specs/001-native-alarm-persistent`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/001-native-alarm-persistent/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/001-native-alarm-persistent/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Verificar se a build de desenvolvimento nativa do Expo está operacional e configurada no aparelho de teste (`rtk expo run:android` / `rtk expo run:ios`). **NÃO USAR EXPO GO.**
- [ ] **T002** [C1] Instalar a dependência `@notifee/react-native` em `apps/mobile/package.json`.
- [ ] **T003** [C1] Configurar as permissões nativas e background modes de notificações persistentes em `app.config.js` (Config Plugin do Notifee).

## Phase 2: Core Implementation

- [ ] **T004** [US1] Criar `apps/mobile/src/platform/alarms/alarmService.js` contendo o core Notifee de criação de canal de alta prioridade, agendamento de alarmes exatos, cancelamento de alarmes e suporte ao Nagging Mode (insistência a cada 5 minutos).
- [ ] **T005** [US1] Criar `apps/mobile/src/platform/alarms/useAlarmScheduler.js` implementando o hook de sincronização com janela de agendamento exato Look-Ahead de **72 horas** baseada nas instâncias de `dose_instances`.
- [ ] **T006** [US1] Criar a UI em tela cheia de alarme para Android `apps/mobile/src/platform/alarms/AlarmFullScreen.jsx` com botões de ação e tamanho otimizado para acessibilidade.
- [ ] **T007** [US1] Criar `apps/mobile/src/platform/alarms/quickDoseRegistration.js` para manipulação de ações em background (mutação Supabase para taken/skipped, dismiss do Notifee e invalidação de AsyncStorage caches).
- [ ] **T008** [US1] Integrar o toggle de controle dos alarmes em `apps/mobile/src/features/profile/screens/SettingsScreen.jsx`.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T009** [C4] Executar `rtk lint` em `apps/mobile/` e resolver qualquer warning ou erro de sintaxe.
- [ ] **T010** [C4] Escrever os testes unitários correspondentes em `apps/mobile/src/platform/alarms/__tests__/alarmService.test.js` e `quickDoseRegistration.test.js`.
- [ ] **T011** [C4] Executar a suíte de validação crítica `rtk npm run validate:agent` e garantir 100% green.
- [ ] **T012** [C4] **Verificação de DoD Independente (Mandatório):** Ler individualmente os arquivos `alarmService.js` e `quickDoseRegistration.js`, validando os trechos exatos de código que lidam com Doze Mode, janela de 72h e a limpeza do AsyncStorage.
- [ ] **T013** [C4] **Smoke PO Manual:** Gerar build no simulador e validar com o PO o disparo e silenciamento de alarme no aparelho de teste.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T014** [C5] Atualizar a versão do aplicativo mobile em `apps/mobile/app.config.js` (`APP_VERSION`).
- [ ] **T015** [C5] Adicionar a entrada descritiva de liberação em português no topo do arquivo `CHANGELOG.md` na seção `[Unreleased]`.
- [ ] **T016** [C5] Registrar a conclusão do SQP R-221 na gravação de C5 no events.jsonl do DEVFLOW.
- [ ] **T017** [C5] Registrar a entrada de journal e atualizar o `state.json` com status `'completed'`.
