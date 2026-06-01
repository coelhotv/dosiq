# Implementation Plan: Medical PDF Report

**Feature Directory**: `plans/specs/007-medical-pdf-report`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/007-medical-pdf-report/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §F6.2

---

## Technical Context

Esta feature realiza a extração local de dados do AsyncStorage snapshot e a compilação visual do layout médico. No mobile nativo, a compilação ocorre através do motor nativo do SO (`expo-print`), e na web via biblioteca dynamic imported `jsPDF`.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Geração puramente local e isolada, sem trafegar dados do histórico por servidores de terceiros. |
| **II. Mobile-First Reliability** | ✅ PASS | Uso de renderizador nativo de visualização do SO, garantindo leveza. |
| **IV. Timezone Correctness** | ✅ PASS | Datas e logs no PDF consolidados via `parseLocalDate()` locais (GMT-3). |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/history/services/pdfGeneratorService.js` | Serviço gerador que compila dados em marcação HTML inline e invoca o `expo-print`. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/history/components/ExportPdfButton.jsx` | Botão nativo que aciona o serviço e abre o menu do `expo-sharing`. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/web/src/features/history/services/webPdfService.js` | Mantém/otimiza dynamic import e compilação do `jsPDF` + `jspdf-autotable` (AP-B03). | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> O uso de `expo-print` e `expo-sharing` requer compilação nativa. Todo teste local no mobile deve ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Geração Nativa por HTML Inline Styling
* **Template HTML:** O serviço `pdfGeneratorService.js` monta uma string HTML estruturada, contendo CSS inline compatível com os padrões do motor WebKit/Blink dos dispositivos.
* **Geração de Arquivo Temporário:** O método `Print.printToFileAsync({ html })` do `expo-print` é chamado, gravando o PDF gerado localmente na pasta de cache temporário do celular (`file:///.../Document.pdf`).
* **Compartilhamento Nativo:** Logo após receber o path local, o serviço invoca `Sharing.shareAsync(uri)` da biblioteca `expo-sharing` para disponibilizar o arquivo no menu de envio do smartphone.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile** e **Web**.
* **SemVer Impact:** Classificado como **minor** (relatório clínico PDF nativo no mobile).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web: Atualizar `apps/web/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada da exportação do Relatório Clínico em PDF no mobile.
* **Quality Commands:**
  * Executar `rtk lint` no core, web e mobile.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
