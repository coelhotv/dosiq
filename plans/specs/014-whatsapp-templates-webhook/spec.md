# Feature Specification: WhatsApp Templates & Webhook

**Feature Directory**: `plans/specs/014-whatsapp-templates-webhook`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §3. W7.6, W7.7

---

## Context

Para viabilizar a comunicação passiva com cuidadores de forma econômica sob as limitações da Vercel Hobby (teto rígido de 12 funções serverless), os webhooks de entrada do WhatsApp e do Telegram devem ser agrupados sob o mesmo endpoint unificado de roteamento. Esta feature especifica esse roteador serverless híbrido e define os templates estruturados de mensagens que devem ser submetidos para pré-aprovação junto à Meta Cloud API, blindando a transição com uma estratégia segura de rollback e feature flags.

---

## User Scenarios & Testing

### User Story 1 - Roteamento Inteligente Serverless (Priority: P1)
**Why this priority**: Evita estourar o limite de 12 funções serverless gratuitas da Vercel e gerencia o tráfego com eficiência.
**Independent Test**: Enviar requisições POST simuladas de entrada do Telegram e do WhatsApp para o endpoint `api/webhooks.js`, verificando que o roteador direciona a chamada internamente com sucesso e retorna status `200 - OK`.

**Acceptance Scenarios**:
1. Given o endpoint unificado `api/webhooks.js` em produção, When o servidor do Telegram enviar uma atualização de mensagem do chat, Then o roteador deve direcionar a requisição internamente para `api/_adapters/telegram.js`.
2. When a Meta Cloud API enviar um webhook de notificação de leitura do WhatsApp, Then o roteador deve redirecionar a chamada internamente para `api/_adapters/whatsapp.js`.

### User Story 2 - Submissão e Uso de Templates Utilitários (Priority: P1)
**Why this priority**: Permite disparar mensagens proativas fora da janela de conversação de 24h.
**Independent Test**: Invocar o envio do template `dose_atrasada` fora da janela de 24h, checando se as variáveis parametrizadas (`cuidador_nome`, `paciente_nome`, `medicamento`, `horario`) são injetadas perfeitamente.

**Acceptance Scenarios**:
1. Given que a janela de conversação de 24h com a cuidadora Ana Paula está fechada, When o sistema precisar avisar sobre a Losartana atrasada de Dona Maria, Then o backend deve disparar o payload do template `dose_atrasada` pré-aprovado pela Meta contendo os dados corretos nas variáveis.

---

## Edge Cases

- **Colisão e Indisponibilidade de Endpoint em Produção:** A substituição física do arquivo `api/telegram.js` pelo roteador unificado `api/webhooks.js` pode causar quedas de produção. A implantação exige uma **Feature Flag (Toggle)** no painel do admin e a criação de uma rota temporária alternativa para permitir testes de stress em homologação antes da exclusão do arquivo antigo.
- **Assinatura e Validação de Webhook do WhatsApp:** A Meta Cloud API exige validação de webhook com token de verificação e assinatura criptográfica `sha256` nos cabeçalhos (`x-hub-signature-256`) para impedir requisições maliciosas. O webhook deve verificar e validar a assinatura rigidamente.

---

## Requirements

### Functional Requirements

- **FR-001:** Roteador serverless unificado no endpoint `api/webhooks.js` que gerencia e divide tráfego de entrada.
- **FR-002:** Redirecionamento lógico interno para os arquivos na pasta interna `api/_adapters/`.
- **FR-003:** Validação e segurança rígida de webhook com checagem de assinatura `sha256` da Meta Cloud API.
- **FR-004:** Mapear e preparar payloads para os 4 templates canônicos da Meta: `dose_atrasada`, `estoque_critico`, `digest_semanal` e `receita_vencendo`.
- **FR-005:** Estratégia de Rollback: manter `api/telegram.js` ativo e controlado por Feature Flag administrativa durante a fase de transição.

### Key Entities

- **WebhookPayload:** Requisições brutas recebidas nos endpoints.
- **MetaTemplate:** Definição estruturada de variáveis e categorias da Meta.

---

## Success Criteria

- **SC-001:** Roteamento concluído e resposta de status 200 enviada às APIs externas em menos de 150ms.
- **SC-002:** 100% de segurança contra requisições forjadas nas rotas webhooks (bloqueio imediato em assinaturas sha256 inválidas).
