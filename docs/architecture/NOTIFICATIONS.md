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

O sistema opera através de um motor desacoplado em **3 Camadas**, garantindo que a lógica de negócio, a formatação visual e a entrega técnica sejam independentes.

### 1. Camada de Negócio (L1 - Business Logic)
Responsável por decidir *quem* notificar e *o que* enviar. Reside em `server/bot/tasks.js` e em handlers de API.
- **Isolamento**: Não conhece regras de formatação Markdown ou protocolos de rede.
- **Contrato**: Envia um objeto `data` (payload bruto) para o Dispatcher.

### 2. Camada de Apresentação (L2 - Canonical Builder)
Responsável por transformar o dado bruto em uma experiência visual rica. Reside em `server/notifications/payloads/buildNotificationPayload.js`.
- **Canônico**: Garante que o mesmo lembrete tenha a mesma "voz" no Telegram, Push e Inbox.
- **Validação**: Usa schemas Zod para garantir que o payload final (`title`, `body`, `deeplink`) esteja correto.
- **Decoração**: Adiciona prefixos (ex: `🔄` para reenvios) e rodapés contextuais.

### 3. Camada de Entrega (L3 - Delivery Dispatcher)
O `dispatchNotification.js` é o hub de execução que coordena o envio multicanal.
- **Resolução de Canais**: Consulta preferências e dispositivos ativos via `resolveChannelsForUser.js`.
- **Gate de Supressão**: Aplica Quiet Hours e Notification Modes centralizadamente.
- **Adaptadores**:
    - **Telegram**: Via `telegramChannel.js`.
    - **Mobile Push (Expo)**: Via `expoPushChannel.js`.
- **Inbox-First**: Todo dispatch gera um registro no `notification_log`.

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

### Resiliência & DLQ (Gate 3.5)
O sistema possui uma camada de proteção contra perda de notificações críticas:

- **Captura Automática (Auto-DLQ)**: O Dispatcher (L3) monitora o sucesso de cada canal. Se todos os canais físicos falharem, a notificação é automaticamente enfileirada na `failed_notification_queue` (Dead Letter Queue).
- **Manual Retry Proxy**: O Admin Panel permite o reenvio manual de falhas. Esse reenvio utiliza o Dispatcher, garantindo que o payload seja re-processado pela L2 (Apresentação), mantendo a consistência visual.
- **Roteamento de Sistema**: Notificações para administradores (ex: resumos da DLQ) utilizam o `SYSTEM_USER_ID`, sendo roteadas automaticamente para o chat de administração configurado.

### Rastreabilidade
- **Correlation ID**: Todo dispatch gera um UUID rastreável nos logs da Vercel e Supabase.
- **Status Tracking**: `notification_log` registra `status` (sent, failed, delivered, opened).

---

## 🔗 Documentação Relacionada

- [`plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md`](../../plans/backlog-notifications/MASTER_PLAN_NOTIFICATIONS_REVAMP.md)
- [`docs/architecture/DATABASE.md`](DATABASE.md) - Tabelas `notification_log` e `user_settings`.
- [`server/BOT README.md`](../../server/BOT%20README.md) - Guia de desenvolvimento local do bot.
