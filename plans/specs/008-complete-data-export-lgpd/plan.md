# Implementation Plan: Complete Data Export (LGPD)

**Feature Directory**: `plans/specs/008-complete-data-export-lgpd`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/008-complete-data-export-lgpd/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §F6.3

---

## Technical Context

Esta feature efetua a consolidação de todas as tabelas locais em cache AsyncStorage no mobile e SWR local na web, formatando as linhas em JSON estruturado ou strings CSV e gravando-as em arquivos do sistema.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Conformidade estrita com as leis de privacidade e portabilidade LGPD. |
| **II. Mobile-First Reliability** | ✅ PASS | Uso de `expo-file-system` nativo para escrita segura no diretório temporário do aplicativo. |
| **IV. Timezone Correctness** | ✅ PASS | Timestamps históricos formatados e mantidos no fuso local do usuário. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/profile/services/exportService.js` | Serviço de escrita local nativo JSON/CSV baseado em `expo-file-system`. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/profile/screens/ExportDataScreen.jsx` | Tela nativa com checkboxes de seleção e gatilho de compartilhamento `expo-sharing`. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/web/src/features/profile/services/webExportService.js` | Mantém/otimiza serviço web baseado em blobs de navegador e downloads. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> A utilização de `expo-file-system` e compartilhamento nativo `expo-sharing` requer compilação nativa. Todo teste local no mobile deve ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Incompatibilidade de Blobs no React Native
* **O Problema:** Frameworks React Native não expõem objetos `Blob` globais com suporte a links `<a download>` dinâmicos, comuns na web.
* **A Solução Mobile:** O `exportService.js` cria o diretório temporário e grava o arquivo de texto bruto contendo a string CSV/JSON no path `FileSystem.cacheDirectory + 'dosiq_export.json'`. Em seguida, o `expo-sharing` compartilha o URI físico.
  ```javascript
  import * as FileSystem from 'expo-file-system';
  import * as Sharing from 'expo-sharing';

  const fileUri = FileSystem.cacheDirectory + 'dosiq-data.json';
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data), {
    encoding: FileSystem.EncodingType.UTF8
  });
  await Sharing.shareAsync(fileUri);
  ```

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile** e **Web**.
* **SemVer Impact:** Classificado como **minor** (painel de privacidade e exportação LGPD no mobile).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web: Atualizar `apps/web/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada da exportação e portabilidade de dados pessoais LGPD.
* **Quality Commands:**
  * Executar `rtk lint` em todos os diretórios.
  * Executar `rtk npm run validate:agent` e garantir sucesso antes do commit final.
