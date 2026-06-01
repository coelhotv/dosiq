# Implementation Plan: WhatsApp Templates & Webhook

**Feature Directory**: `plans/specs/014-whatsapp-templates-webhook`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/014-whatsapp-templates-webhook/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §3. W7.6, W7.7

---

## Technical Context

Esta feature envolve a reestruturação física do roteamento de endpoints serverless na Vercel e o desenvolvimento de motores de validação criptográfica sha256 em Node.js.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Validação rígida com assinatura Meta sha256 impede injeções de payloads falsos. |
| **II. Mobile-First Reliability** | ✅ PASS | Processamento inteiramente serverless no backend, sem impacto no mobile. |
| **IV. Timezone Correctness** | ✅ PASS | O processamento do timestamp das mensagens recebidas e timestamps de envio ocorrem sob fuso local GMT-3. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `api/webhooks.js` | Endpoint físico único serverless de entrada unificado Vercel. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `api/_adapters/whatsapp.js` | Arquivo interno de tratamento lógico do webhook do WhatsApp. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `api/_adapters/telegram.js` | Arquivo interno de tratamento lógico do webhook do Telegram. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `packages/core/src/templates/whatsappTemplates.js` | Mapeador estruturado dos payloads dos templates aprovados pela Meta. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |

---

## Architectural Approach

### 1. Serverless Limit Optimization (Vercel Hobby)
* **O Roteador Híbrido:** Para não saturar a cota gratuita de 12 funções, o arquivo `api/webhooks.js` lê o tipo de payload (ou via parâmetro de query path `api/webhooks?channel=whatsapp`) e invoca o require correspondente em tempo de execução:
  ```javascript
  // api/webhooks.js snippet
  export default async function handler(req, res) {
    const { channel } = req.query;
    if (channel === 'whatsapp') {
      const { validateSignature } = await import('@core/utils/crypto');
      if (!validateSignature(req)) return res.status(401).send('Unauthorized');
      const { handleWhatsApp } = await import('./_adapters/whatsapp');
      return handleWhatsApp(req, res);
    }
    if (channel === 'telegram') {
      const { handleTelegram } = await import('./_adapters/telegram');
      return handleTelegram(req, res);
    }
    return res.status(404).send('Not Found');
  }
  ```

### 2. Mapeamento de Templates Meta Cloud
* **Templates Utility:** Os payloads das mensagens parametrizadas são estruturados em JSON estrito com correspondência exata das variáveis na ordem correta, prontos para envio via Meta Graph API:
  * `dose_atrasada` template parameters: `[cuidador_nome, paciente_nome, medicamento, horario]`.
  * `estoque_critico` template parameters: `[cuidador_nome, medicamento, paciente_nome, dias]`.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Backend/Server** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (roteador serverless híbrido e templates WhatsApp).
* **Version Update:**
  * Core: Atualizar `packages/core/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a consolidação dos webhooks serverless e cadastro dos templates da Meta Cloud API.
* **Quality Commands:**
  * Executar `rtk lint` no backend.
  * Executar `rtk npm run validate:agent` e garantir sucesso antes do commit final.
