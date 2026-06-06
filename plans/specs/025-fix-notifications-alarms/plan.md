# Plano de Implementação: 025 — Correção e Evolução de Notificações e Alarmes

Este documento define a arquitetura detalhada e o mapeamento dos arquivos para implementar as correções solicitadas nas especificações de alarmes nativos e notificações.

---

## Mapeamento Canônico de Arquivos (Target Files)

| Componente | Caminho do Arquivo | Função / Papel no Épico |
| :--- | :--- | :--- |
| **Banco de Dados** | `docs/migrations/20260605_notification_preference_default.sql` | [NEW] Migration para drop default de `notification_preference` e limpeza de Telegram |
| **Telegram Bot** | `server/bot/commands/start.js` | [MODIFY] Ativar canal Telegram e configurar `notification_preference` |
| **Notificador (Cron)** | `server/bot/_reminderHelpers.js` | [MODIFY] Trazer `dosage_per_pill` e separar blocos críticos e normais |
| **Zod Schemas** | `server/notifications/payloads/_payloadSchemas.js` | [MODIFY] Adicionar `critical_alarm` e `dosagePerPill` aos esquemas de payload |
| **Payload Builder** | `server/notifications/payloads/buildNotificationPayload.js` | [MODIFY] Formatar cópia clínica e incluir detalhes de dosagem |
| **Expo Canal** | `server/notifications/channels/expoPushChannel.js` | [MODIFY] Roteamento de som customizado e interrupção dinâmicos |
| **Push Token Sync** | `apps/mobile/src/platform/notifications/registerPushToken.js` | [MODIFY] Habilitar alarme nativo local (`native_alarm_enabled: true`) por padrão |
| **Protocol Form** | `apps/mobile/src/features/treatments/components/ProtocolFormBody.jsx` | [MODIFY] Usar `enablePushAtIntent` no toggle de alerta crítico |
| **Alarm Scheduler** | `apps/mobile/src/platform/alarms/useAlarmScheduler.js` | [MODIFY] Agrupar alarmes locais por minuto antes de agendar no Notifee e injetar dosagens |
| **Alarm Service** | `apps/mobile/src/platform/alarms/alarmService.js` | [MODIFY] Implementar copy clínico customizado para alarme local essencial e formatar com dosagem clínica |
| **Alarm Actions** | `apps/mobile/src/platform/alarms/quickDoseRegistration.js` | [MODIFY] Registrar e pular tomadas agrupadas em lote (convertido em loop sequencial `for...of` pós-review) |
| **Alarm UI** | `apps/mobile/src/features/dose/screens/AlarmFullScreen.jsx` | [MODIFY] Renderizar lista agrupada de medicamentos na tela de alarme |
| **Relatórios de Adesão** | `server/bot/_adherenceHelpers.js` | [MODIFY] Implementar lógica de ontem vs anteontem, filtro de inatividade/doses vazias e helper de consulta |
| **Agendador Geral** | `server/bot/alerts.js` | [MODIFY] Ajustar crons de execução dos relatórios para as 9h e alertas de estoque para as 10h |
| **Funções Serverless** | `api/notify.js` | [MODIFY] Sincronizar janelas de execução das crons da Vercel para 9h e 10h |
| **Dashboard Mobile** | `apps/mobile/src/features/dashboard/services/dashboardService.js` | [MODIFY] Adicionar `treatment_plan_id` e a relação `treatment_plan` na query `getActiveProtocols` |
| **Documentação Estats** | `plans/adherence_stats_approaches.md` | [NEW] Rascunho com possíveis soluções de performance para persistência e rollups de métricas de adesão no Cron |

---

## Detalhes Técnicos da Arquitetura

### 1. Migração e Limpeza de Dados
Para novos usuários, a coluna `notification_preference` deve ter o valor padrão removido (Drop Default). Novos registros nascerão limpos e poderão ativar os canais sob intenção.
Para usuários existentes que possuem canais inconsistentes, a migração redefinirá o canal Telegram como desativado e ajustará as preferências para `'mobile_push'` ou `'none'` se o token Telegram não estiver presente.

### 2. Separação Física no Cron (`_reminderHelpers.js`)
Atualmente, se doses críticas e normais estão no mesmo minuto, elas entram no mesmo bloco agrupado (plano ou misc). Quando enviamos o push para esse bloco, o device móvel ativo com `native_alarm_enabled = true` suprime o push para o bloco inteiro.
A correção envolve separar `dosesNow` em `criticalDoses` e `nonCriticalDoses` antes do agrupamento via `partitionDoses`. Dessa forma, geramos notificações independentes no backend, permitindo que o push das doses normais chegue normalmente e o das doses críticas seja suprimido (já que estas tocarão o alarme local).

### 3. Fiação de Áudio e Interrupção
No `expoPushChannel.js`, as mensagens enviadas ao Expo Push Service utilizarão o nível de interrupção correto:
- `isCriticalDose ? 'time-sensitive' : 'active'` (iOS fura o DND apenas nas doses essenciais).
- O arquivo de áudio correto será transmitido: `isCriticalDose ? 'alarm_dose.wav' : 'push_chime.wav'`.

### 4. Agrupamento Local no Notifee (`useAlarmScheduler.js`)
Em vez de disparar múltiplos alarmes simultâneos (tendo colisões sonoras), agrupamos todos os itens de alarme com o mesmo epoch timestamp.
- Se houver apenas um alarme na hora: agendamento normal.
- Se houver múltiplos alarmes: agendamos 1 Notifee local com ID da notificação igual ao timestamp (epoch em string), título fixo, e enviamos no dicionário `data` o JSON stringificado das doses agrupadas (`groupedDoses`), a flag `isGrouped: 'true'` e a lista de IDs de instâncias (`doseInstanceIds` separados por vírgula).
Para dar suporte à formatação clínica dos alarmes, o scheduler também injetará `dosagePerPill` e `dosageUnit` no objeto `data` enviado para o `scheduleAlarm`.

### 5. Ações em Lote (`quickDoseRegistration.js`)
Ao processar as ações (`registerTaken` e `registerSkip`) em alarmes agrupados, desestruturamos as chaves e registramos cada dose no Supabase utilizando `Promise.all` e enviamos a atualização de status em lote (para `skipped_user`).

### 6. Ajuste do Copy do Alarme Local (`alarmService.js`)
O alarme local do aplicativo (usando Notifee) deve refletir a mesma clareza e acolhimento clínico definidos para o servidor. 
- Quando disparado para uma dose única essencial, o alarme deve montar a descrição usando `{Nome} ({dosagePerPill}{dosageUnit}) - {dosagePerIntake} un.`, resultando no copy `"💊 Medicamento essencial: hora do seu {Descrição} ({Hora})."`.
- Quando disparado de forma agrupada por plano essencial, deve exibir o copy `"📋 Uso essencial: hora dos medicamentos do plano {Plano} ({Hora})."`.
- Quando agrupado e de origens diversas, deve exibir o copy `"💊 Doses essenciais pendentes para as {Hora}."`.

### 7. Planejamento do Changelog & Releases (R-221/R-243)
Conforme o protocolo SQP (R-221), as seguintes entradas serão adicionadas ao `CHANGELOG.md` sob a seção `[Unreleased]` ao fim do ciclo:

#### Mobile (0.12.0 → 0.13.0)
- **Alarmes Críticos Locais e Supressão de Pushes** (Minor, Spec 025):
  - Habilitada a flag `native_alarm_enabled` por padrão para iOS e Android para supressão automática de pushes remotos de doses críticas e prevenção de duplicidades.
  - Implementado o agrupamento local de alarmes no Notifee (`useAlarmScheduler.js`), consolidando múltiplas doses críticas do mesmo minuto em um único trigger.
  - Atualizada a tela cheia de alarme (`AlarmFullScreen.jsx`) e as ações rápidas (`quickDoseRegistration.js`) para suportar visualização e confirmação/descarte em lote.
  - Ajustadas as cópias de exibição do alarme local em `alarmService.js` para usar o padrão clínico customizado para doses críticas (essenciais) de forma coerente.
  - Integrada a solicitação contextual de permissões de push (`enablePushAtIntent`) ao toggle de alarme essencial do formulário de protocolos (`ProtocolFormBody.jsx`).
  - **Nota de loja relevante:** "Novo: Lembretes mais inteligentes para medicamentos essenciais. Se você tem mais de um remédio no mesmo horário, o alarme agora toca apenas uma vez e permite confirmar todos de uma vez só."

#### Server
- **Reversão de cópias de notificações normais** (Patch, Spec 025):
  - Revertido o texto de lembrete de doses normais para o formato legado original com "cp" (comprimidos) no builder de payloads (`buildNotificationPayload.js`).

### 8. Fase 3: Evolução dos Relatórios de Adesão no Backend
- **Horário das Crons**: O horário de envio de todos os três relatórios de adesão (diário, semanal e mensal) foi movido para **09:00 AM (local)**. A cron de alertas de estoque (`checkStockAlerts`) foi movida para **10:00 AM**.
- **Corte de Inatividade**: Usuários que não possuem nenhum protocolo de tratamento ativo (`active = true`) ou que têm 0 doses planejadas/devidas na janela de análise são filtrados antes do envio, evitando relatórios vazios.
- **Relatório Diário Ontem vs Anteontem**: Como o relatório roda às 9h da manhã, o dia atual tem dados incompletos. Portanto, o relatório foi alterado para avaliar o período de **Ontem (D-1)** em comparação com o dia anterior, **Anteontem (D-2)**, ajustando a propriedade `period` para `'ontem'` e atualizando os textos.
- **Rascunho de Performance (`adherence_stats_approaches.md`)**: Devido ao limite de 60s das Vercel Serverless Functions nas crons, criamos uma análise detalhada sobre abordagens para estatísticas em pushes usando rollups incrementais ou filas de background.

### 9. Fase 4: Correções de Bugs Adicionais e Pós-Review
- **Validação de Ações Zod (`snooze`)**: Correção do crash no Vercel adicionando o ID `'snooze'` como valor válido de ação do Notifee/Telegram no `actionSchema` do Zod (`_payloadSchemas.js`).
- **Query de Tratamentos no Dashboard Mobile**: Corrigido o agrupamento por plano que falhava no device do usuário. A query `getActiveProtocols` em `dashboardService.js` no mobile foi atualizada para trazer `treatment_plan_id` e a relação `treatment_plan` do banco de dados, permitindo que a sincronização local de alarmes (`syncAlarms`) identifique corretamente o plano terapêutico ao agrupar doses no mesmo minuto.
- **Paralelização de Ações Sequenciais**: No `quickDoseRegistration.js`, substituído o uso de `Promise.all` em favor de um loop sequencial `for...of` para as chamadas de `registerDose`, evitando condições de corrida e deadlocks de banco ao consumir estoque FIFO.
- **Refatoração de Protocolos Ativos**: Em `_adherenceHelpers.js`, a verificação redundante de protocolos ativos foi extraída para a função auxiliar `_hasActiveProtocols(userId)`.

---

## Plano de Verificação

### Testes Automatizados
- `rtk env PATH=/Users/coelhotv/.nvm/versions/node/v22.22.3/bin:$PATH npm run test:critical` (Validação completa e testes do core/bot)
- `rtk env PATH=/Users/coelhotv/.nvm/versions/node/v22.22.3/bin:$PATH npx eslint .` (Linting de JS e React Native sem erros)

### Testes Manuais
- Verificar a tabela `user_settings` após rodar a migração no banco de testes.
- Rodar o comando `/start` com o Telegram bot simulado e validar a consistência no banco.
- Simular um alarme de múltiplos medicamentos críticos no mesmo minuto e testar se apenas 1 Notifee local dispara e se a tela cheia do alarme lista todos corretamente.
- Forçar o disparo das crons de relatório às 9h com fake timers ou no banco local de testes e verificar se os dados computados de ontem vs anteontem estão corretos.
