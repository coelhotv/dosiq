# Implementation Plan: Caregiver Dashboard (Caregiver Mode — Phase 3)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-3-caregiver-dashboard`
**Epic**: [Modo Cuidador](../EPIC.md) · **Spec**: [spec.md](./spec.md)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §1. W7.3

---

## Technical Context

Esta feature envolve a criação de componentes de navegação com multi-seleção no aplicativo nativo móvel e o desenvolvimento de um painel web desktop consertado no PWA consumindo SWR queries em fuso local GMT-3.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Isolamento estrito de dados por chaves SWR UUID exclusivas por paciente. |
| **II. Mobile-First Reliability** | ✅ PASS | Dropdown de multi-perfil leve e virtualizado na Home sem lentidões na renderização. |
| **IV. Timezone Correctness** | ✅ PASS | Exibição de horários no painel do cuidador alinhada com o fuso local do dispositivo de cada paciente. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/shared/components/PatientDropdownSelector.jsx` | Componente dropdown de seleção de dependente no topo do Header. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `apps/mobile/src/features/caregiver/screens/CaregiverHomeScreen.jsx` | Tela inicial de cuidador que encapsula a navegação reativa multi-perfil. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `apps/web/src/features/caregiver/screens/WebCaregiverDashboard.jsx` | Painel desktop de cuidador contendo widgets consolidados e monitor de alertas. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `packages/core/src/repositories/caregiverDashboardRepository.js` | Métodos de consultas consolidadas e SWR hooks integrados no core. | `@dosiq/core` integration |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> A sincronização de dados e gerenciamento de sessões seguras Supabase requer compilação nativa. Todo teste local de alternância de perfil deve ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Isolamento de Caches SWR (Multi-Perfil)
* **Estruturação de Chaves:** As consultas do hook de leitura do paciente são parametrizadas dinamicamente:
  ```javascript
  const usePatientData = (patientId) => {
    return useCachedQuery(['@dosiq/patient-snapshot', patientId], () => 
      fetchPatientClinicalData(patientId)
    );
  };
  ```
* **Limpeza e Recarga:** Ao trocar o `patientId` no `PatientDropdownSelector`, a Home reavalia o hook. O SWR garante que o estado de "loading" seja elegante e que dados residuais da mãe não vazem para a tela do pai.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile**, **Web** e **Shared/Core** (`packages/core`).
* **SemVer Impact:** Classificado as **minor** (painel do cuidador consolidado e alternância multi-perfil).
* **Version Update:**
  * Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
  * Web: Atualizar `apps/web/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do seletor de múltiplos perfis no mobile e painel web desktop unificado.
* **Quality Commands:**
  * Executar `rtk lint` no core, web e mobile.
  * Executar `rtk npm run validate:agent` e garantir sucesso antes do commit final.
