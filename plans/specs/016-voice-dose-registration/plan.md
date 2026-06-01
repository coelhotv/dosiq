# Implementation Plan: Voice Dose Registration

**Feature Directory**: `plans/specs/016-voice-dose-registration`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/016-voice-dose-registration/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §2. Registro e Resumo de Doses por Voz, §2. V01

---

## Technical Context

Esta feature envolve a vinculação e configuração nativa de bibliotecas de gravação e transcrição de áudio nos ecossistemas iOS e Android, e o desenvolvimento de algoritmos fuzzy em Javascript puro para reuso local no mobile e web.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Transcrição processada localmente em engines embarcadas do SO, sem envio de streams de áudio bruto para APIs de terceiros. |
| **II. Mobile-First Reliability** | ✅ PASS | Config Plugins configuram de forma atômica permissões nativas de microfone. |
| **IV. Timezone Correctness** | ✅ PASS | Registro da dose correspondente baseia-se no fuso local do dispositivo `parseLocalDate()`. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/shared/components/VoiceRecordButton.jsx` | Botão nativo acionador do gravador microfone `react-native-voice`. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `apps/web/src/shared/components/WebVoiceButton.jsx` | Botão web integrado com a API nativa `SpeechRecognition` do navegador. | `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` |
| `packages/core/src/services/fuzzyMatchService.js` | Engine de processamento NLP e distância de Levenshtein unificada. | `@dosiq/core` optimization |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA (CRÍTICO):**  
> O uso de `react-native-voice` exige vinculação nativa de SDKs e a configuração de Config Plugins para permissões (`NSMicrophoneUsageDescription` e `NSSpeechRecognitionUsageDescription` no iOS, e `RECORD_AUDIO` no Android). **O Expo Go padrão causará falhas imediatas.** O desenvolvimento exige compilação de Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Algoritmo Fuzzy Levenshtein (Core)
* **A Engine:** O arquivo `fuzzyMatchService.js` recebe a transcrição bruta (ex: *"Tomei losartan"*) e a higieniza (lowercase, remoção de stopwords como "tomei", "a", "o", "agora"). Em seguida, calcula a distância Levenshtein com os medicamentos ativos do paciente. Se a distância for menor que o teto (`threshold = 2`), homologa o match de forma atômica no fuso local GMT-3.

### 3. Graceful Degradation no PWA/Web
* **Fallback no Safari:**
  ```javascript
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    this.setState({ isSpeechSupported: false }); // Mascara o botão de microfone na UI
  }
  ```

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile**, **Web** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (funcionalidade de registro de dose por voz nativa e web).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web/Core: Atualizar `package.json` em web e core.
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando o registro de doses assistido por voz móvel e Web Speech.
* **Quality Commands:**
  * Executar `rtk lint` em todos os diretórios.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
