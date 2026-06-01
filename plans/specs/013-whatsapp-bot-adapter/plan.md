# Implementation Plan: WhatsApp Bot Adapter

**Feature Directory**: `plans/specs/013-whatsapp-bot-adapter`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/013-whatsapp-bot-adapter/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §3. Motor de Alertas Híbrido, §3. W7.5

---

## Technical Context

Esta feature envolve a refatoração e implementação de padrões estruturais no backend Node.js do Dosiq, codificando os canais adaptadores de notificação e os testes baseados em mock no core/serviço.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | As mensagens enviadas aos canais externos seguem templates restritos e parametrizados, ocultando dados confidenciais do prontuário por design. |
| **II. Mobile-First Reliability** | ✅ PASS | Processamento 100% no servidor backend Node.js, sem impacto no desempenho do aplicativo móvel do usuário. |
| **IV. Timezone Correctness** | ✅ PASS | O disparo de alertas pelo cron é disparado e monitorado no fuso GMT-3 do banco Supabase. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `server/services/notification/INotificationChannel.js` | Interface/Classe abstrata definindo a assinatura comum para canais de notificação. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `server/services/notification/WhatsAppAdapter.js` | Canal adaptador específico contendo chamadas da API Meta Cloud e regras de 24h. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `server/services/notification/TelegramAdapter.js` | Refatora adaptador Telegram existente para herdar a interface comum. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `server/services/notification/notificationManager.js` | Centralizador de chamadas reativas que gerencia cotas e fallback de rede. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |

---

## Architectural Approach

### 1. Adapter Pattern (INotificationChannel)
* **A Assinatura Comum:** A classe `INotificationChannel` força a implementação dos métodos `sendAlert(payload)` e `sendTemplate(templateId, variables)` por todos os adaptadores.
* **Telegram e WhatsApp:** O `TelegramAdapter.js` encapsula a biblioteca do bot existente. O `WhatsAppAdapter.js` efetua requisições HTTP REST diretas na API do Meta Cloud:
  ```javascript
  // WhatsAppAdapter.js snippet
  class WhatsAppAdapter extends INotificationChannel {
    async sendAlert(payload) {
      if (!this.isWithin24HourWindow(payload.chat_id)) {
        return this.sendTemplate('dose_atrasada', payload.variables);
      }
      return this.postMetaAPI('/messages', {
        messaging_product: "whatsapp",
        to: payload.phone,
        text: { body: payload.text }
      });
    }
  }
  ```

### 2. Controle de Cotas Mensais
* **Auditoria de Envios:** Toda entrega concluída com sucesso insere uma linha com status `sent` na tabela `notification_logs` no banco Supabase. Antes de efetuar o request Meta API, o `notificationManager.js` roda query de agregação local filtrando o mês atual. Se a contagem for maior que 800 envios, bloqueia a chamada e executa fallback para o Telegram.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Backend/Server** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (refatoração do motor de notificações e canal WhatsApp).
* **Version Update:**
  * Core: Atualizar `packages/core/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a refatoração do canal de notificações e classe adaptadora de WhatsApp.
* **Quality Commands:**
  * Executar `rtk lint` no backend.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
