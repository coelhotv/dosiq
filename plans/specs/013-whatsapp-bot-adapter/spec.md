# Feature Specification: WhatsApp Bot Adapter

**Feature Directory**: `plans/specs/013-whatsapp-bot-adapter`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §3. Motor de Alertas Híbrido, §3. W7.5

---

## Context

Para garantir robustez e escalabilidade nos canais de comunicação com o cuidador (atualmente focado em Telegram), a infraestrutura do backend de alertas do Dosiq deve ser refatorada utilizando padrões de projeto estruturais. Esta feature especifica o design de arquitetura de canais de notificação através do **Adapter Pattern**, isolando a integração com a **Meta Cloud API** em uma classe adaptadora independente que herda uma interface comum de mensagens, garantindo testes fáceis por Mock e facilidade de manutenção de cotas.

---

## User Scenarios & Testing

### User Story 1 - Roteamento Multi-Canal (Priority: P1)
**Why this priority**: Permite que o cuidador escolha receber alertas por WhatsApp, Telegram ou ambos.
**Independent Test**: Programar um alarme de teste e disparar a notificação no backend, verificando que ela é roteada dinamicamente para os adaptadores ativos com base na configuração do perfil do cuidador.

**Acceptance Scenarios**:
1. Given que a cuidadora Ana Paula configurou no seu painel para receber notificações por WhatsApp, When o webhook de alarme atrasado de Dona Maria for disparado, Then o backend deve rotear a mensagem para a classe `WhatsAppAdapter`.
2. Given que Ana Paula prefere Telegram, When o alerta for acionado, Then o backend deve desviar a entrega para a classe `TelegramAdapter`.

### User Story 2 - Monitoramento de Limite de Cotas (Priority: P2)
**Why this priority**: Evita cobranças indesejadas ultrapassando o limite gratuito de 1.000 conversas mensais da Meta.
**Independent Test**: Mapear a contagem de mensagens enviadas no banco e verificar se o adaptador emite um alerta de limite crítico ou bloqueia disparos não prioritários quando o counter atinge 80% (800 mensagens) no mês.

**Acceptance Scenarios**:
1. Given que o envio de mensagens do Dosiq atingiu 800 envios no mês corrente, When o adaptador de WhatsApp tentar efetuar uma nova entrega automatizada, Then o sistema deve emitir um alerta no canal de logs do admin: *"Cota de WhatsApp crítica (800/1000). Notificações secundárias suspensas."* e desviar tráfego secundário para o Telegram.

---

## Edge Cases

- **Limite de 24h da Meta Cloud API (Customer Service Window):** As mensagens em formato de conversa comum só podem ser enviadas se o cuidador interagiu com o bot nas últimas 24 horas. Se a janela expirar, qualquer notificação avulsa deve ser rejeitada pelo adaptador e enfileirada no banco ou enviada utilizando templates pré-aprovados "Utility".
- **Falha de Rede na API Externa:** Se a Meta Cloud API retornar erro 500 ou time-out durante a entrega, o adaptador de WhatsApp deve enfileirar o disparo em uma fila de Dead Letter Queue (DLQ) para re-tentativa ou fallback imediato para Telegram.

---

## Requirements

### Functional Requirements

- **FR-001:** Refatorar as rotinas do backend implementando o **Adapter Pattern** com a interface canônica `INotificationChannel`.
- **FR-002:** Codificar a classe `WhatsAppAdapter` convertendo os payloads de notificação internos na sintaxe da API de nuvem da Meta.
- **FR-003:** Sistema de monitoramento de volume mensal de conversas Meta com gatilho de bloqueio/alerta administrativo ao alcançar 800 disparos.
- **FR-004:** Regra de contingência para expiração da janela de conversação de 24h da Meta.
- **FR-005:** Mecanismo de fallback dinâmico: falha de entrega no WhatsApp aciona envio automático via Telegram.

### Key Entities

- **NotificationLog:** Auditoria e contagem de disparos por canal.
- **CaregiverLink:** Configurações de canal preferido.

---

## Success Criteria

- **SC-001:** Testabilidade de 100% dos fluxos de notificação sem requisições reais de API (uso obrigatório de Mocks nos testes unitários).
- **SC-002:** Roteamento e fallback dinâmico entre canais executado em menos de 100ms pelo motor do backend.
