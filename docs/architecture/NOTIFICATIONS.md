# 🔔 Sistema de Notificações & Bot Telegram

**Versão:** 5.0.0  
**Última atualização:** 2026-04-29  
**Status:** Produção (Waves N1, N2 & M2.5)

Documentação central do motor de notificações do Dosiq, abrangendo a arquitetura multicanal (Telegram, Push, Web), o sistema de agrupamento inteligente e a lógica de engajamento comportamental.

---

## 📋 Visão Geral

O Dosiq utiliza um **Motor de Notificações Unificado** baseado no princípio **Inbox-First**. Toda e qualquer comunicação com o usuário nasce como um registro no banco de dados e é distribuída por múltiplos canais de acordo com as preferências e a disponibilidade técnica de cada dispositivo.

### Propósitos do Sistema

- **Lembretes de Doses**: Notificações agrupadas por plano de tratamento.
- **Relatórios de Adesão**: Storytelling e nudges comportamentais dinâmicos.
- **Gestão de Estoque**: Alertas preditivos (estoque < 7 dias).
- **Titulação**: Avisos de transição de etapa em protocolos.
- **Interatividade**: Comandos e botões inline no Telegram e App.

---

## 🏗️ Arquitetura do Motor

O sistema opera através de um **Dispatcher** centralizado que abstrai a complexidade de cada canal.

### 1. Princípio Inbox-First
Nenhuma notificação é enviada sem antes ser persistida na tabela `notification_log`. Isso garante que:
- O usuário sempre tenha um histórico acessível via Web/App.
- Possamos medir engajamento (`opened_at`, `action_taken_at`).
- Notificações suprimidas por **Quiet Hours** ainda estejam disponíveis para consulta manual.

### 2. Dispatcher Unificado (`server/notifications/dispatcher/`)
O `dispatchNotification.js` é o hub que coordena o envio para:
- **Telegram**: Via `telegramChannel.js`.
- **Mobile Push (Expo)**: Via `expoPushChannel.js`.
- **Web Push (PWA)**: Via `webPushChannel.js`.

### 3. Agrupamento Inteligente (Wave N1)
Para evitar o "spam" de notificações (múltiplos medicamentos no mesmo horário), o sistema aplica a regra de **Partição por Plano**:
- **Plano de Tratamento**: ≥2 doses de um plano → 1 notificação nomeada ("Plano Cardio (4 meds)").
- **Sobra Consolidada**: Doses avulsas ou de planos com 1 dose → 1 notificação "Suas doses agora".
- **Dose Individual**: Apenas se for a única dose no minuto.

---

## 📨 Tipos de Tarefas Agendadas (`server/bot/tasks.js`)

As tarefas são disparadas por um cron central (`/api/notify`) e processadas com consciência de **Timezone** e **Preferências do Usuário**.

| Tarefa | Gatilho | Descrição |
|--------|---------|-----------|
| **Dose Reminders** | A cada minuto | Verifica doses agendadas, aplica agrupamento e quiet hours. |
| **Stock Alerts** | 09:00 (Local) | Verifica predição de estoque e alerta se < 7 dias. |
| **Daily Digest** | `digest_time` | Resumo completo do dia para usuários em `digest_morning` mode. |
| **Adherence Report** | Dom/Mensal | Relatório com storytelling comparando adesão atual vs. anterior. |
| **Titration Alert** | 08:00 (Local) | Alerta quando um protocolo atinge o dia de troca de dose. |

---

## ⚙️ Controle e Preferências (Wave N2)

O usuário tem controle granular sobre a experiência de notificações em `user_settings`:

### Modos de Notificação
- **Realtime**: Envio imediato (com agrupamento N1).
- **Digest Morning**: Suprime individuais e envia um único resumo matinal.
- **Silent**: Apenas Inbox (sem push/Telegram).

### Quiet Hours (Não Me Incomode)
Define uma janela (ex: 22:00 às 07:00) onde as notificações externas são suspensas, sendo apenas registradas na Inbox.

### Canais Explícitos
- `channel_mobile_push_enabled`
- `channel_web_push_enabled`
- `channel_telegram_enabled`

---

## 🤖 Bot Telegram: Interface Conversacional

O Telegram funciona como um canal de entrega (Push) e uma interface de ação (Bot).

### Comandos Principais
- `/start <token>`: Vincula a conta do app ao chat do Telegram.
- `/status`: Resumo do tratamento atual.
- `/hoje`: Cronograma de doses para o dia.
- `/estoque`: Status detalhado do armário de medicamentos.
- `/registrar`: Fluxo guiado para log manual de doses.

### Interação por Callbacks
As notificações de dose no Telegram incluem botões interativos:
- **✅ Tomar**: Registra o plano/dose instantaneamente (usa RPCs atômicos).
- **⏭️ Pular**: Ignora a dose com registro de motivo.
- **⏰ Adiar**: Re-agenda o lembrete para 30 minutos depois.

---

## 🛠️ Confiabilidade e Observabilidade

### Retry & DLQ
- **Retry**: 3 tentativas com exponential backoff para falhas de rede.
- **DLQ (Dead Letter Queue)**: Notificações que falham permanentemente vão para `failed_notification_queue` para análise admin.

### Rastreabilidade
- **Correlation ID**: Todo dispatch gera um UUID rastreável nos logs da Vercel e Supabase.
- **Status Tracking**: `notification_log` registra `status` (sent, failed, delivered, opened).

---

## 🔗 Documentação Relacionada

- [`plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md`](../../plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md)
- [`docs/architecture/DATABASE.md`](DATABASE.md) - Tabelas `notification_log` e `user_settings`.
- [`server/BOT README.md`](../../server/BOT%20README.md) - Guia de desenvolvimento local do bot.
