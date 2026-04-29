# 💊 Experiência de Notificações e Engajamento

**Versão:** 1.0.0 (Product Perspective)  
**Persona Responsável:** Senior Product Manager  
**Status:** Canonical Reference (Phase 5 / Wave N2+)

As notificações no Dosiq não são apenas lembretes; elas são a **espinha dorsal da retenção (stickiness)** e a interface primária de interação do paciente com seu tratamento. Este documento detalha a estratégia de produto, os sistemas implementados e o roadmap de experiência para este componente crítico.

---

## 🎯 Filosofia de Produto: "Inbox-First"

Nossa abordagem central baseia-se na **responsabilidade de dados** e na **onipresença**.

1.  **Zero Perda de Contexto**: Toda notificação é um registro imutável no `notification_log` antes de ser um push. Se o canal falhar, o valor de produto permanece no App Inbox.
2.  **Accountability**: Medimos o sucesso não pelo "envio", mas pela "ação tomada" (`action_taken_at`).
3.  **Resiliência (DLQ-First)**: Falhas de entrega não são ignoradas. Elas são capturadas por uma Dead Letter Queue (DLQ), permitindo auditoria e reenvio manual ou automático.
4.  **Respeito à Atenção**: O usuário é o dono do seu tempo. Oferecemos ferramentas para reduzir o ruído sem comprometer a adesão (Quiet Hours e Agrupamento).

---

## 🏗️ Matriz de Canais e Formatos

O Dosiq opera uma estratégia multicanal onde cada canal possui um papel psicológico diferente para o usuário:

### 1. Telegram Bot (Power-User & Conversacional)
O canal mais interativo e resiliente. Utilizado por usuários que desejam gerenciar o tratamento sem abrir o navegador/app.
*   **Formatos**: Mensagens ricas com MarkdownV2, botões inline interativos.
*   **Interações**: 
    *   `✅ Tomar`: Registro instantâneo.
    *   `⏰ Adiar`: Soneca inteligente de 30min.
    *   `⏭️ Pular`: Registro de exceção com motivo.
*   **Valor de Produto**: Fricção zero. O registro ocorre dentro da notificação.

### 2. PWA & Mobile Push (Contextual & Ubíquo)
Entrega a sensação de "app nativo". Focado em alertas rápidos e visibilidade na tela de bloqueio.
*   **Formatos**: Alertas do sistema com suporte a ícones e badges (dependendo da plataforma).
*   **Valor de Produto**: Presença constante no dispositivo principal do usuário.

### 3. Web Push (Cross-Device)
Garante que o usuário seja alertado mesmo trabalhando no desktop ou tablet.
*   **Valor de Produto**: Sincronização da jornada do paciente em múltiplos pontos de contato.

### 4. App Inbox (O Centro de Verdade)
A "Central de Notificações" interna no Dashboard.
*   **Formatos**: Lista visual com status (Lida/Não lida), agrupada por relevância.
*   **Valor de Produto**: Histórico auditável. Permite que o usuário revise o que aconteceu durante as "Quiet Hours".

---

## 🔄 Modos de Entrega e Inteligência de Agrupamento

Para evitar a fadiga de notificações (Notification Fatigue), implementamos inteligência de processamento:

### Agrupamento Inteligente (Wave N1)
O sistema não envia 5 pushes se o usuário tem 5 remédios às 08:00. Ele analisa o contexto:
*   **Por Plano de Tratamento**: Se o usuário tem um "Protocolo Hipertensão" com 3 medicamentos, ele recebe: *"Hora do seu Plano Hipertensão (3 meds)"*.
*   **Sobra Consolidada (Misc)**: Medicamentos avulsos no mesmo minuto são agrupados em: *"Suas doses de agora (2 meds)"*.
*   **Individual**: Apenas quando há uma única dose isolada no tempo.

### Modos de Experiência e Supressão Centralizada

O sistema utiliza um **Portão de Supressão Único** (`dispatchNotification.js`) que garante que as preferências do usuário sejam respeitadas em todos os canais:

| Modo | Escopo de Supressão | Comportamento de Entrega |
| :--- | :--- | :--- |
| **Realtime** | Respeita Quiet Hours. | Envio imediato de lembretes e alertas de estoque. Ideal para tratamentos críticos. |
| **Digest** | Suprime Alertas Realtime. | Bloqueia pushes individuais de doses. Envia apenas o Planejador Matinal (`daily_digest`). |
| **Silent** | Suprime TUDO (Push/Bot). | Nenhuma entrega externa. Notificações aparecem apenas no Inbox. |

**Janela de Silêncio (Quiet Hours):** Lembretes gerados entre 22h e 08h são silenciados por padrão, exceto se configurados explicitamente para bypass.

---

## ⚙️ Configurações e Customização (User Control)

O Dosiq oferece um painel de controle granular (Web e App) para garantir o conforto do usuário:

1.  **Quiet Hours (Janela de Silêncio)**: 
    *   O usuário define um intervalo (ex: 22h às 07h).
    *   Notificações geradas nesse período ficam presas no Inbox e não disparam Push/Bot.
2.  **Switches de Canal**: Controle independente para Mobile Push, Web Push e Telegram.
3.  **Configuração de Digest**: Definição do horário preferencial para o resumo diário (ex: 07:30 para ler no café da manhã).

---

## 📊 Tipos de Conteúdo e Storytelling (Retention Hooks)

Não notificamos apenas "tome o remédio". Usamos dados para gerar engajamento:

1.  **Alertas de Estoque Preditivos**: "Seu remédio X acaba em 6 dias. Que tal comprar agora?".
2.  **Relatórios de Adesão (M2.5)**: Comparação semanal/mensal. "Sua adesão subiu 15% esta semana! 🚀".
3.  **Nudges de Titulação**: "Hoje você inicia uma nova fase no seu protocolo. A dose aumentou para 2 comprimidos."
4.  **Storytelling de Saúde**: Mensagens que explicam o *porquê* daquela dose ser importante naquele momento.

---

## 📖 Catálogo de Notificações & Exemplos de Copy

Este catálogo serve como a referência canônica para o tom de voz e os formatos de entrega do Dosiq.

### 1. Lembrete de Dose Individual (`dose_reminder`)
*   **Gatilho**: 1 única dose isolada no tempo.
*   **Canais**: Push, Telegram, Inbox.
*   **Exemplo Compacto (Push)**:
    > 💊 Lembrete de nova dose: Está na hora de tomar 1x de Atorvastatina. Não deixe para depois!
*   **Exemplo Rico (Telegram/Inbox)**:
    > **💊 Lembrete de nova dose**
    > Está na hora de tomar 1x de Atorvastatina. Não deixe para depois!
*   **Ações**: `[ ✅ Tomar ]` `[ ⏰ Adiar ]` `[ ⏭️ Pular ]`

### 2. Lembrete de Plano de Tratamento (`dose_reminder_by_plan`)
*   **Gatilho**: ≥2 doses pertencentes ao mesmo plano (ex: Protocolo ICFEr).
*   **Canais**: Push, Telegram, Inbox.
*   **Exemplo Compacto (Push)**:
    > 💊 Quarteto Fantástico — ICFEr: 4 medicamentos — 08:00
*   **Exemplo Rico (Telegram/Inbox)**:
    > 🌅 **Quarteto Fantástico — ICFEr**
    > 
    > 4 medicamentos agora — 08:00
    > 
    >   💊 Atorvastatina — 1 cp
    >   💊 SeloZok — 1 cp
    >   💊 Sacubitril/Valsartana — 1 cp
    >   💊 Espironolactona — 1 cp
*   **Ações**: `[ ✅ Registrar este plano ]` `[ 📋 Detalhes ]`

### 3. Lembrete de Doses Diversas (`dose_reminder_misc`)
*   **Gatilho**: ≥2 doses sem plano comum agendadas para o mesmo horário.
*   **Canais**: Push, Telegram, Inbox.
*   **Exemplo Compacto (Push)**:
    > 💊 Hora dos medicamentos: 2 medicamentos — 14:00
*   **Exemplo Rico (Telegram/Inbox)**:
    > ☕ **Suas doses agora** — 14:00
    > 
    > 2 medicamentos pendentes:
    > 
    >   • Ômega 3 — 1 cp
    >   • Trimebutina — 1 cp
*   **Ações**: `[ ✅ Registrar todos ]` `[ 📋 Detalhes ]`

### 4. Alerta de Estoque (`stock_alert`)
*   **Gatilho**: Estoque remanescente abaixo do limiar (padrão: 7 dias).
*   **Canais**: Push, Telegram, Inbox.
*   **Exemplo Compacto (Push)**:
    > Estoque baixo: SeloZok está acabando.
*   **Exemplo Rico (Telegram/Inbox)**:
    > 📦 **Estoque Baixo**
    > Seu estoque de SeloZok está acabando (restam aprox. 6 dias).
*   **Ações**: `[ 🛒 Comprar ]` `[ 📋 Ver Estoque ]`

### 5. Planejador Matinal (`daily_digest`)
*   **Gatilho**: Modo Digest Morning ativado (envio no horário configurado).
*   **Canais**: Push, Telegram, Inbox.
*   **Inteligência**: Saudação dinâmica (Bom dia/Boa tarde) e contexto de adesão de ontem.
*   **Exemplo Compacto (Push - Sem Markdown)**:
    > Bom dia, João! Ontem você tomou 3/4 doses. Vamos focar nos 100% hoje? 🚀
*   **Exemplo Rico (Telegram/Inbox - MarkdownV2)**:
    > 📋 **Planejador Matinal — 29/04/2026**
    > 
    > Bom dia, João\! 👋
    > 
    > 📊 **Seu Desempenho de Ontem:**
    > 3/4 doses registradas (75%)
    > 
    > 📝 **Doses para Hoje:**
    > • 08:00 — Atorvastatina
    > • 14:00 — Ômega 3
    > • 20:00 — Vitamina D
    > • 22:00 — Melatonina
    > 
    > Que tal batermos a meta de hoje? 💪
*   **Ações**: `[ 📊 Ver Planejamento ]`

### 6. Relatório de Adesão Noturno (`adherence_report`)
*   **Gatilho**: Envio padrão às 23:00 para usuários (exceto modo `silent`).
*   **Canais**: Push, Telegram, Inbox.
*   **Exemplo Compacto (Push)**:
    > Dia concluído! Você tomou 2 de 4 doses hoje (50%). Amanhã é um novo dia! 💪
*   **Exemplo Rico (Telegram/Inbox)**:
    > 📊 **Relatório de Adesão — 29/04/2026**
    > 
    > Dia concluído, João\! 👋
    > 
    > ✅ **Doses Tomadas:** 2
    > 📅 **Doses Previstas:** 4
    > 📈 **Score do Dia:** 50%
    > 
    > 💪 Não desanime! O importante é recomeçar. Amanhã teremos uma nova chance.

### 7. Atualização de Titulação (`titration_alert`)
*   **Gatilho**: Mudança automática de etapa em um protocolo com titulação.
*   **Canais**: Telegram, Inbox.
*   **Exemplo Rico**:
    > 🎯 **Atualização de Titulação**
    > 
    > Medicamento: **Ramipril**
    > Etapa atual: 2/4
    > 
    > 📈 Próxima etapa: 5mg cp
    > ⏰ Data prevista: 30/04/2026

### 8. Resumo de Falhas de Sistema (`dlq_digest`)
*   **Gatilho**: Execução diária da tarefa de limpeza/auditoria da DLQ.
*   **Canais**: Telegram (Admin), Inbox (Admin).
*   **Destinatário**: Admin (via `SYSTEM_USER_ID`).
*   **Exemplo Rico**:
    > 🛠️ **Resumo da Dead Letter Queue**
    > 
    > Encontramos **3 notificações falhadas** nas últimas 24h que precisam de atenção.
    > 
    >   ❌ **prescription_alert** (User: João) — 08:00
    >   ❌ **daily_digest** (User: Maria) — 07:30
    > 
    > [ 📋 Ver Painel DLQ ]

### 9. Notificações de Reenvio (`isRetry`)
*   **Gatilho**: Reenvio manual através do Admin Panel.
*   **Decoração**: Título com prefixo `🔄` e rodapé explicativo.
*   **Exemplo Rico**:
    > 🔄 **💊 Lembrete de nova dose (Reenvio)**
    > 
    > Está na hora de tomar 1x de Atorvastatina.
    > 
    > _Esta é uma nova tentativa de envio._

---

## 🧠 Lógica de Behavioral Nudges (Gamificação)

O Dosiq utiliza algoritmos de "Nudges" para variar o tom de voz baseado na performance:

| Performance | Sentimento | Exemplo de Copy |
| :--- | :--- | :--- |
| **100%** | Celebração | "🏆 Imbatível! Sua saúde agradece por tanto compromisso." |
| **80-99%** | Incentivo | "📈 Quase lá! Você está indo muito bem. Um pequeno ajuste..." |
| **50-79%** | Estabilidade | "⚖️ No caminho certo. Cada dose conta para a sua melhora." |
| **1-49%** | Empatia | "💪 Não desanime! O importante é recomeçar." |
| **0%** | Acolhimento | "🧘 Respire fundo. Organizar sua rotina é o primeiro passo." |

---

## 📋 Backlog Estratégico (Senior PM Proposals)

Propostas para elevar o componente de notificações a uma ferramenta de **Engajamento Elite**:

### [N3] Humanização e Variabilidade ✅ (Wave N3)
*   **Objetivo**: Evitar a cegueira de notificação por repetição.
*   **Ação**: Implementado motor de saudações dinâmicas e variação de conteúdo baseado em faixas horárias e performance prévia (ontem vs hoje).

### [N4] Gamificação e Streaks
*   **Objetivo**: Aumentar a retenção via aversão à perda.
*   **Ação**: Notificar quando o usuário está prestes a perder um "Streak" (sequência de dias 100%). "Não quebre sua sequência de 12 dias! Tome sua última dose."

### [N5] Notificações de Cuidado Compartilhado (Circle of Care)
*   **Objetivo**: Gerar valor para familiares e cuidadores.
*   **Ação**: Notificar um contato de emergência caso uma dose crítica de um protocolo de risco seja ignorada por mais de 2 horas.

### [N6] Smart Snooze baseada em Contexto
*   **Objetivo**: Reduzir o churn de notificações.
*   **Ação**: Permitir "Adiar para quando chegar em casa" (via geofencing ou tempo inteligente) em vez de apenas um snooze fixo de 30min.

### [N7] Auto-Healing de Notificações
*   **Objetivo**: Eliminar intervenção manual em falhas transitórias.
*   **Ação**: Implementar lógica de retry exponencial automático na DLQ para erros de rede detectados pela Camada de Entrega (L3).

---
*Documento mantido pela equipe de Produto e Engenharia de Notificações.*
