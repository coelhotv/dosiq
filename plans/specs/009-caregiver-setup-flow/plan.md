# Implementation Plan: Caregiver Setup Flow

**Feature Directory**: `plans/specs/009-caregiver-setup-flow`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/009-caregiver-setup-flow/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §1. W7.1, W7.2

---

## Technical Context

Esta feature gerencia a interface do fluxo de boas-vindas do paciente e do cuidador, a integração com componentes nativos de leitura de câmera no mobile e as mutações locais e sincronização via Supabase no monorepo mobile e core.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Todos os acessos e convites obedecem à RLS, exigindo consentimento explícito e permitindo revogação que apaga as chaves relacionais imediatamente no Supabase. |
| **II. Mobile-First Reliability** | ✅ PASS | Leitor de câmera nativo e Share nativo integrados sem bibliotecas externas lentas. |
| **IV. Timezone Correctness** | ✅ PASS | Importação e conversão de posologia recalculam horários do alarme para o fuso local `parseLocalDate()` do paciente. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/onboarding/screens/WelcomeScreen.jsx` | Tela de primeiro uso contendo botões proeminentes `[ Sou Paciente ]` e `[ Sou Cuidador ]`. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `apps/mobile/src/features/caregiver/screens/QrScannerScreen.jsx` | Tela nativa móvel de escaneamento de QR Code com input manual alternativo. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `apps/mobile/src/features/caregiver/components/ConsentDialog.jsx` | Modal em tela cheia com termos de privacidade LGPD e botões AAA. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `apps/mobile/src/features/profile/screens/CaregiverSettingsScreen.jsx` | Tela de Configurações do Paciente com gerenciador de convites e revogação soberana. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `packages/core/src/repositories/caregiverFlowRepository.js` | Métodos de importação e processamento transacional de grade de medicamentos integrados no core. | `@dosiq/core` integration |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> O scanner de câmera nativo (`expo-camera` ou `react-native-vision-camera`) e as integrações da `Share` API nativa não rodam e causam crashes no Expo Go. O desenvolvimento local exige builds nativos locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Fluxo Desacoplado via Compartilhamento Local
* **O Processo:** Em vez de depender de servidores enviando webhooks de mensagens, o painel do cuidador invoca a Share API do SO. O paciente recebe a mensagem com o link seguro e o abre. O deep link universal direciona o usuário para abrir o Dosiq móvel, acionando a leitura do código no fuso GMT-3.
* **Importação Clíinica:** Ao aceitar o convite, o repositório core faz SELECT em `caregiver_invites` para buscar a grade associada do paciente e insere de forma atômica no AsyncStorage local e no Supabase as instâncias com o `source='caregiver'`.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado como **minor** (fluxo de boas-vindas do paciente e importação via QR Code).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do fluxo simplificado de setup por QR Code e tela de consentimento LGPD.
* **Quality Commands:**
  * Executar `rtk lint` em todos os diretórios.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
