# Implementation Plan: Voice Dose Summary

**Feature Directory**: `plans/specs/017-voice-dose-summary`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/017-voice-dose-summary/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §2. Registro e Resumo de Doses por Voz, §2. V02

---

## Technical Context

Esta feature envolve a integração e uso de motores de síntese de voz (Text-To-Speech) locais embarcados em navegadores e sistemas operacionais móveis, extraindo dados de doses no fuso GMT-3.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Síntese gerada 100% no processador do cliente local, sem vazamento ou streams externos. |
| **II. Mobile-First Reliability** | ✅ PASS | Uso da biblioteca `expo-speech` otimizada no monorepo mobile. |
| **IV. Timezone Correctness** | ✅ PASS | Doses pendentes consolidadas estritamente com fuso local `parseLocalDate()`. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelogs e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/history/components/VoiceSummaryButton.jsx` | Botão nativo acionador de síntese de voz `expo-speech` na Home. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `apps/web/src/features/history/components/WebVoiceSummary.jsx` | Componente web integrado com a SpeechSynthesis API do navegador. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `packages/core/src/services/voiceTextBuilder.js` | Construtor de strings e frases estruturadas pt-BR a partir de array de doses. | `@dosiq/core` optimization |

---

## Architectural Approach

### 1. Build Constraints (Mobile Target)
* **Mobile Compilation:** A biblioteca `expo-speech` consome APIs nativas de síntese. Todos os testes devem ocorrer em simuladores ou aparelhos físicos utilizando Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Algoritmo de Compilação de Frases (Core)
* **A Engine:** O serviço `voiceTextBuilder.js` recebe o array de `dose_instances` de hoje filtrado por status `pending` ou `missed`. Em seguida, gera a string concatenada ordenada cronologicamente (ex: *"Você ainda precisa tomar a Losartana às 22 horas."*). Se o array estiver vazio, retorna a string de parabéns.

### 3. Graceful Fallback (Web)
* **Web SpeechSynthesis:**
  ```javascript
  if (!window.speechSynthesis) {
    this.setState({ isTtsSupported: false }); // Oculta o ícone de áudio da Home
  }
  ```

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile**, **Web** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (funcionalidade de resumo falado de doses pendentes).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web/Core: Atualizar `package.json` em web e core.
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando o Resumo Falado de doses pendentes na Home do mobile e PWA.
* **Quality Commands:**
  * Executar `rtk lint` em todos os diretórios.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
