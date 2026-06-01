# Implementation Plan: ANVISA Local Interactions

**Feature Directory**: `plans/specs/018-anvisa-interactions-local`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/018-anvisa-interactions-local/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §3. Base de Interações Medicamentas, §3. Implementação
- `plans/backlog-unified_app_2026/ANALISE_FONTES_INTERACOES.md`

---

## Technical Context

Esta feature envolve a construção de uma base de dados estática otimizada em JSON e o desenvolvimento de motores locais assíncronos de busca fuzzy no monorepo core.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Alertas gerados 100% locais sem tráfego de dados confidenciais do prontuário por rede pública. |
| **II. Mobile-First Reliability** | ✅ PASS | Lazy-loading dinâmico garante que o consumo de memória ocorra apenas no submit do formulário. |
| **IV. Timezone Correctness** | ✅ PASS | Validações executadas em tempo de runtime local. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelogs e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `packages/core/src/interactions/interactions.json` | Seed estático contendo os 50-80 pares de interações medicamentosas brasileiras. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `packages/core/src/services/interactionService.js` | Serviço de validação fonética fuzzy e busca de colisões. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `apps/mobile/src/features/medicines/components/SmartAlertModal.jsx` | Modal nativa colorida de advertência e disclaimer de segurança. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `apps/web/src/features/medicines/components/WebSmartAlert.jsx` | Componente web correspondente de exibição de alertas de forma isolada. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> A verificação local de dados exige importações por chaves aliases otimizadas do monorepo. Todo teste de formulário móvel deve ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Lazy-Loading Obrigatório (AP-B03)
* **Import Dinâmico:** No manipulador de submissão do formulário do medicamento no mobile e na web, a engine e o JSON estático de 50-80 pares são carregados dinamicamente via promessa assíncrona para economizar bundle de inicialização:
  ```javascript
  const handleFormSubmit = async (formData) => {
    // Import assíncrono sob demanda (Gate Loop G3)
    const { checkInteractions } = await import('@core/services/interactionService');
    const conflicts = checkInteractions(formData.name, activeMedicines);
    if (conflicts.length > 0) {
      return triggerAlertModal(conflicts);
    }
    saveMedicine(formData);
  };
  ```

### 3. Engine Fuzzy de Colisões
* **Tratamento de Nomes:** O `interactionService.js` higieniza strings ativas (ex: convertendo "Losartan Potássico" para "losartana potassica") e roda loops Levenshtein simples ou indexados para encontrar matches fonéticos aproximados na chave `pair` do JSON, evitando contaminação por pequenos erros de digitação.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile**, **Web** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (módulo local de análise de interações ANVISA).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web/Core: Atualizar `package.json` de web e core.
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada da checagem inteligente local de interações medicamentosas.
* **Quality Commands:**
  * Executar `rtk lint` em todos os diretórios.
  * Executar `rtk npm run validate:agent` e garantir sucesso antes do commit final.
