# 025 — Correção e Evolução de Notificações e Alarmes

**Feature Directory:** `plans/specs/025-fix-notifications-alarms/`
**Created:** 2026-06-05
**Status**: delivered — PRs #644/#645/#646/#647
**Tier:** 2 (Epic / High-Risk)
**Input:** Relatos de usuários sobre alertas de Telegram inativos após vínculo, notificações duplicadas no iOS, silenciamento de doses não-críticas em blocos mistos e ausência de detalhes clínicos nos lembretes de doses.

---

## Contexto

Após as entregas das especificações `010-native-alarm-v2` e `011-notifications-from-instances`, foram reportados quatro problemas críticos relacionados ao sistema de notificações e alarmes do Dosiq:
1. **Alertas do Telegram inativos**: Ao vincular o Telegram bot via comando `/start`, o campo `telegram_chat_id` é salvo, mas o canal não é ativado no banco de dados e a preferência global de canal não é ajustada de forma consistente.
2. **Duplicidade no iOS**: Dispositivos iOS com alarmes nativos ativados disparavam o alarme local via Notifee e simultaneamente recebiam e exibiam a notificação de push remota da Expo, gerando duplicidade visual e sonora.
3. **Contaminação de Blocos Mistos**: Se um plano possui tratamentos críticos (com alarme ativo) e normais no mesmo horário, o notificador agrupava todos em um único bloco. Como o dispositivo nativo tem `native_alarm_enabled: true`, o push remoto para esse bloco inteiro era suprimido, resultando no silenciamento completo das doses normais (que não tinham alarme local agendado).
4. **Copy e Som não Otimizados**: O texto para doses críticas usava tom de pânico (`🚨 ALERTA CRÍTICO`). Além disso, lembretes de medicamentos isolados não incluíam a dosagem (ex: quantidade e miligramas). Por fim, o áudio customizado `alarm_dose.wav` deve tocar apenas nos alarmes/notificações de doses críticas, enquanto `push_chime.wav` deve tocar nos pushes normais.

---

## User Stories

### US1 — Sincronização de Preferências e Higienização do Banco de Dados (Inbox-First)

**Como** usuário do Dosiq,
**quero** que o sistema nasça com foco na inbox (sem canais invasivos ativos por padrão) e limpe preferências inconsistentes herdadas de versões antigas,
**para que** eu receba lembretes apenas nos canais que eu configurei e ativei explicitamente.

**Acceptance Scenarios:**

```gherkin
Dado um novo usuário criando conta no Dosiq
Quando as configurações padrão do perfil forem inicializadas no banco de dados
Então a coluna `notification_preference` deve nascer NULL (Inbox-First)

Dado um usuário existente com configurações herdadas
Quando o usuário possui preferência para Telegram ativa, mas `telegram_chat_id` está nulo
Então a migração do banco de dados deve desativar o canal Telegram e redefinir a preferência de forma consistente

Dado um usuário iniciando vínculo com o Telegram Bot
Quando o usuário envia o comando `/start` com token válido
Então o bot deve associar `telegram_chat_id`
  E ativar `channel_telegram_enabled = true`
  E atualizar a preferência global `notification_preference` para 'both' (se push mobile estiver ligado) ou 'telegram' (se estiver desligado)
```

---

### US2 — Divisão Física de Blocos de Notificação Críticos vs Normais (Notificador Cron)

**Como** usuário em tratamento no Dosiq com múltiplos medicamentos no mesmo horário,
**quero** que doses normais me notifiquem remotamente e doses críticas toquem meu alarme local de forma independente,
**para que** nenhuma dose normal seja silenciada por estar agrupada com um medicamento essencial.

**Acceptance Scenarios:**

```gherkin
Dado que o notificador cron (_checkRemindersFromInstances) é disparado
Quando existirem doses normais e doses críticas pendentes no mesmo minuto
Então o sistema deve separar as doses críticas das normais
  E gerar blocos independentes para envio (um bloco de críticas e outro de normais)
  E encaminhar cada bloco para o fluxo de despacho correto
```

---

### US3 — Tom Clínico Acolhedor, Sons Customizados e Copy Detalhado

**Como** paciente utilizando o Dosiq,
**quero** receber lembretes claros, com detalhes de dosagem do meu medicamento, e tons acolhedores (sem linguagem de pânico),
**para que** eu tome as doses certas com tranquilidade e meu aparelho emita o som correspondente à urgência.

**Acceptance Scenarios:**

```gherkin
Dado um lembrete para um único medicamento essencial (crítico)
Quando a notificação for gerada
Então o corpo da mensagem deve usar o copy: "💊 Medicamento essencial: hora do seu {Descrição} ({Hora})."

Dado um lembrete para múltiplos medicamentos de um plano essencial (crítico)
Quando a notificação for gerada
Then o corpo da mensagem deve usar o copy: "📋 Uso essencial: hora dos medicamentos do plano {Plano} ({Hora})."

Dado um lembrete para um único medicamento (qualquer criticidade)
Quando formatado na notificação
Então deve conter no corpo a estrutura: "{Nome do Medicamento} {Quantidade} un. {Dosagem por Comprimido}{Unidade de Dosagem}"

Dado o canal de notificações da Expo (Push Remoto)
Quando uma notificação de dose essencial (crítica) for despachada
Então o som configurado deve ser `alarm_dose.wav`
  E o interruptionLevel deve ser `time-sensitive` (no iOS/Android)

Quando uma notificação de dose normal for despachada
Então o som configurado deve ser `push_chime.wav`
  E o interruptionLevel deve ser `active` (padrão)
```

---

## US4 — Mobile Alarme Local Unificado & Gestão de Consentimento (React Native App)

**Como** usuário do aplicativo Dosiq no iOS ou Android,
**quero** que o aplicativo gerencie o agendamento local de alarmes sem duplicidade sonora ou visual de pushes remotos,
**para que** eu receba alertas essenciais pontuais e agrupados para o mesmo minuto.

**Acceptance Scenarios:**

```gherkin
Dado o registro de um dispositivo ativo (iOS ou Android)
Quando o token do dispositivo for enviado ao banco de dados via `registerPushToken.js`
Então a flag `native_alarm_enabled` deve ser salva como `true` no banco de dados (suprimindo pushes remotos de doses essenciais no servidor)

Dado que o usuário tem múltiplos tratamentos críticos no mesmo minuto
Quando o scheduler local agendar os alarmes via Notifee
Então deve ser criado apenas **um único alarme Notifee local**
  E a notificação local deve usar o som customizado `alarm_dose.wav`
  E conter os IDs consolidados e dados estruturados das doses agrupadas no payload
  E no iOS, usar `interruptionLevel: 'timeSensitive'` para bypassar Foco/DND

Dado a tela de alarme em tela cheia (AlarmFullScreen)
Quando um alarme agrupado disparar e o app abrir
Então a tela deve exibir a lista de todos os medicamentos do bundle agrupado
  E ao clicar em "Tomei", deve registrar todas as doses agrupadas em lote no banco de dados
```

---

## Functional Requirements

| ID | Requisito | US |
|----|-----------|:--:|
| FR-01 | Criar migração SQL para remover default `'telegram'` de `notification_preference` e higienizar usuários antigos sem token Telegram | US1 |
| FR-02 | Atualizar o comando `/start` do bot do Telegram para salvar `channel_telegram_enabled = true` e atualizar `notification_preference` de forma consistente | US1 |
| FR-03 | Modificar a query de lembretes no cron `_reminderHelpers.js` para retornar a dosagem unitária (`dosage_per_pill`) das tabelas relacionais | US3 |
| FR-04 | Atualizar a lógica do cron no backend para pré-separar instâncias críticas e normais antes de chamar `partitionDoses` | US2 |
| FR-05 | Atualizar o esquema de dados do Zod (`_payloadSchemas.js`) no notificador para aceitar `critical_alarm` e `dosagePerPill` nos payloads das doses | US3 |
| FR-06 | Implementar copy clínico acolhedor e formatar lembretes de medicamento único com detalhes de dosagem no `buildNotificationPayload.js` | US3 |
| FR-07 | Fiar os áudios e níveis de interrupção (`alarm_dose.wav` para crítica/time-sensitive; `push_chime.wav` para normal/active) no `expoPushChannel.js` | US3 |
| FR-08 | Configurar `native_alarm_enabled` padrão como `true` para iOS e Android no `registerPushToken.js` | US4 |
| FR-09 | Integrar `enablePushAtIntent` ao formulário do protocolo (`ProtocolFormBody.jsx`) para solicitar permissões de notificação sob intenção | US4 |
| FR-10 | Agrupar alarmes essenciais do mesmo minuto no Notifee local no `useAlarmScheduler.js` | US4 |
| FR-11 | Atualizar ações rápidas no `quickDoseRegistration.js` para registrar/descartar doses agrupadas (em lote) | US4 |
| FR-12 | Renderizar a lista de medicamentos agrupados na tela `AlarmFullScreen.jsx` | US4 |
| FR-13 | Ajustar o texto do alarme local em `alarmService.js` para exibir o copy clínico customizado (e formatado com dosagem clínica) das doses essenciais | US3 |

---

## Success Criteria

| ID | Critério | Verificação | Gate |
|----|----------|-------------|:----:|
| SC-01 | Coluna `notification_preference` não possui default no DB | Inspeção do esquema de `user_settings` | G1 |
| SC-02 | Usuários inconsistentes antigos higienizados | Consulta SQL no BD de teste pós-migration | G1 |
| SC-03 | Telegram `/start` atualiza preferências de canal | Vinculação simulada com bot | G1 |
| SC-04 | Doses críticas e normais divididas em blocos separados | Execução de testes unitários do Cron | G1 |
| SC-05 | Payload contém dados de dosagem detalhados e copy clínico | Testes unitários do payload builder | G1 |
| SC-06 | Canal ExpoPush envia som e interrupção corretos | Verificação estática do payload do push enviado à Expo | G1 |
| SC-07 | Dispositivo iOS e Android registram `native_alarm_enabled = true` | Verificação do payload enviado por `registerPushToken` | G2 |
| SC-08 | Botão de alarme essencial solicita permissão contextual | Smoke test de clique no toggle no simulador | G2 |
| SC-09 | Múltiplas doses críticas geram 1 trigger Notifee com payload agrupado | Log do agendador Notifee | G2 |
| SC-10 | Tela cheia do alarme exibe múltiplos medicamentos e confirmação em lote funciona | Teste manual e unitário do `AlarmFullScreen` | G2 |
| SC-11 | validate:agent green em todas as workspaces | `rtk npm run validate:agent` | G3 |
| SC-12 | Build produção OK | `rtk npm run build` | G3 |
| SC-13 | SQP release bump e CHANGELOG atualizados | Inspeção do Git diff / CHANGELOG.md | G4 |

---

## SQP (R-221) — Release Impact

| Campo | Valor |
|-------|-------|
| **Plataformas** | Backend/Infra, Mobile (iOS & Android) |
| **SemVer** | `minor` — adições de funcionalidades de alarmes locais agrupados e novas regras de preferências |
| **Version source** | `apps/mobile/package.json` |
| **CHANGELOG** | `[Unreleased]` → `### Novas Funcionalidades` e `### Correções` |
| **Mobile store-note** | Sim. Notas de atualização informando sobre notificações mais confiáveis e melhorias no alarme de medicamentos essenciais |

---

## Quality Gates com Hard Stop

Cada fase termina com um **HARD STOP** obrigatório. O agente DEVE parar, apresentar resumo estruturado das alterações, e aguardar aprovação explícita do operador antes de prosseguir.

| Gate | Após | Resumo obrigatório |
|:----:|------|---------------------|
| G1 | Fase 1 (Migrations, Bot, Cron, Payloads) | Lista de arquivos de backend modificados + output de testes críticos do servidor |
| G2 | Fase 2 (Mobile Token, Intent Flow, Scheduler, Alarm Screen) | Arquivos nativos e componentes mobile editados + output de testes do front |
| G3 | Fase 3 (Validação full) | Resultado de `validate:agent` + build completo + lint |
| G4 | Fase 4 (SQP + Docs) | Verificação final das notas da release, versão no package.json e log final no journal |

---

## Assumptions

1. Dispositivos iOS que usam Notifee podem emitir som customizado local de 30 segundos contanto que o arquivo `.wav` esteja no app bundle.
2. Apple autorizará os "Critical Alerts" oficiais no futuro, mas o uso de `timeSensitive` via Notifee serve como safety net temporária adequada.
3. Não há limitações de banco de dados para atualizar em lote registros de log para instâncias agrupadas.
4. `alarm_dose.wav` e `push_chime.wav` já existem no diretório de assets no mobile.
